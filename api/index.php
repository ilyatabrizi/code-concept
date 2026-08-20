<?php
/**
 * Code Concept API — front controller.
 *
 * Signing up
 *   POST /api/otp/request     {phone, purpose:"signup"}      -> code by SMS
 *   POST /api/otp/verify      {phone, code, purpose}         -> one-use ticket
 *   POST /api/account/create  {phone, ticket, name, password}-> member + session
 *
 * Coming back
 *   POST /api/account/login   {phone, password}              -> member + session
 *   GET  /api/account/me      Authorization: Bearer <token>
 *   POST /api/account/logout
 *
 * Forgotten password
 *   POST /api/otp/request     {phone, purpose:"reset"}
 *   POST /api/otp/verify      {phone, code, purpose:"reset"}
 *   POST /api/account/reset   {phone, ticket, password}
 *
 * GET  /api/health            plain status, no secrets
 */
declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/sms.php';
require __DIR__ . '/lib/otp.php';
require __DIR__ . '/lib/auth.php';

cc_cors();

$route = trim((string) ($_GET['route'] ?? ''), '/');
if ($route === '') {
    // Fall back to the path when the rewrite is unavailable.
    $path = parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH) ?: '';
    $route = trim(preg_replace('#^.*?/api/#', '', $path) ?? '', '/');
}
$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$body = cc_body();
$ip = cc_client_ip();

// ---------------------------------------------------------------- health -----
if ($route === 'health') {
    $cfg = cc_config();
    $sms = $cfg['sms'] ?? [];
    $dbOk = true;
    try {
        cc_db()->query('SELECT 1');
    } catch (Throwable $e) {
        $dbOk = false;
    }
    cc_json([
        'ok'        => true,
        'service'   => 'code-concept',
        'schema'    => CC_SCHEMA_VERSION,
        'database'  => $dbOk ? 'connected' : 'unavailable',
        // states, never values
        'sms'       => [
            'configured'  => !empty($sms['api_key']) && !str_starts_with((string) $sms['api_key'], 'PUT-'),
            'template_set' => (int) ($sms['template_id'] ?? 0) > 0,
            'dry_run'     => (bool) ($sms['dry_run'] ?? true),
        ],
        'time'      => cc_now(),
    ]);
}

if ($method !== 'POST' && $route !== 'account/me') {
    cc_fail(405, 'method_not_allowed', 'Use POST for this endpoint.');
}

$pdo = cc_db();

switch ($route) {

    // ------------------------------------------------------------- otp -------
    case 'otp/request': {
        $phone = cc_normalise_phone(cc_str($body, 'phone', 32));
        $purpose = cc_str($body, 'purpose', 16) ?: 'signup';
        if (!in_array($purpose, ['signup', 'reset'], true)) {
            cc_fail(400, 'bad_purpose', 'Unknown purpose.');
        }
        if ($phone === '') {
            cc_fail(400, 'bad_phone', 'Enter a valid Iranian mobile number.');
        }

        /* Telling the caller "already registered" is worth it — the app sends them
           straight to sign-in instead of a dead end. But it reveals whether a
           number is on file, so the probe is counted and capped per connection.
           A rejected probe issues no code, so it has to be recorded explicitly,
           or the counter it is checked against would never grow. */
        if (cc_probe_count($pdo, $ip) >= (int) cc_limits()['per_ip_per_hour']) {
            cc_fail(429, 'ip_quota', 'Too many requests from this connection. Try again later.');
        }

        $existing = cc_member_by_phone($pdo, $phone);
        if ($purpose === 'signup' && $existing && $existing['password_hash'] !== null) {
            cc_probe_record($pdo, $phone, $ip);
            cc_fail(409, 'already_registered',
                'This number already has an account. Sign in with your password instead.');
        }
        if ($purpose === 'reset' && !$existing) {
            cc_probe_record($pdo, $phone, $ip);
            cc_fail(404, 'no_account', 'No account uses this number yet. Create one instead.');
        }

        /* Gate and issue together, or simultaneous requests all pass the gate
           at once and every one of them bills an SMS. Nothing inside the try may
           call cc_fail(): it exits, and exit() skips finally, which on SQLite
           would leave the transaction open and roll the insert back. */
        if (!cc_otp_lock($pdo)) {
            cc_fail(503, 'busy', 'Too many requests right now. Try again in a moment.');
        }
        try {
            $gate = cc_otp_check_limits($pdo, $phone, $ip);
            $code = $gate['ok'] ? cc_otp_issue($pdo, $phone, $purpose, $ip) : '';
        } finally {
            cc_otp_unlock($pdo);
        }
        if (!$gate['ok']) {
            cc_fail(429, $gate['error'], $gate['message'],
                isset($gate['retry_after']) ? ['retry_after' => $gate['retry_after']] : []);
        }
        $sent = cc_sms_send_code($phone, $code);
        if (!$sent['ok']) {
            // Nothing was delivered, so retire the code immediately — it must not
            // sit there waiting to be guessed. The row itself stays, so a failing
            // provider cannot be hammered: the cooldown and the quotas still count
            // this attempt.
            $pdo->prepare('UPDATE cc_otp SET consumed_at = ? WHERE phone = ? AND consumed_at IS NULL')
                ->execute([cc_now(), $phone]);
            cc_fail(502, 'sms_failed', 'Could not send the code. Try again shortly.');
        }

        $L = cc_limits();
        cc_json([
            'ok'          => true,
            'sent_to'     => cc_display_phone($phone),
            'expires_in'  => $L['code_ttl'],
            'resend_in'   => $L['resend_wait'],
            'code_length' => CC_CODE_LENGTH,
            'dry_run'     => !empty($sent['dry_run']),
        ]);
    }

    case 'otp/verify': {
        $phone = cc_normalise_phone(cc_str($body, 'phone', 32));
        $code = preg_replace('/\D+/', '', cc_str($body, 'code', 16)) ?? '';
        $purpose = cc_str($body, 'purpose', 16) ?: 'signup';
        if ($phone === '' || $code === '') {
            cc_fail(400, 'bad_request', 'Enter the code we sent you.');
        }
        // Same reasoning as above: parallel guesses would each read the same
        // attempt count and sail past the five-try limit.
        if (!cc_otp_lock($pdo)) {
            cc_fail(503, 'busy', 'Too many requests right now. Try again in a moment.');
        }
        try {
            $check = cc_otp_check($pdo, $phone, $code, $purpose);
            $ticket = $check['ok'] ? cc_ticket_issue($pdo, $phone, $purpose) : '';
        } finally {
            cc_otp_unlock($pdo);
        }
        if (!$check['ok']) {
            cc_fail(400, $check['error'], $check['message'],
                isset($check['left']) ? ['attempts_left' => $check['left']] : []);
        }
        cc_json(['ok' => true, 'ticket' => $ticket, 'expires_in' => 900]);
    }

    // --------------------------------------------------------- account -------
    case 'account/create': {
        // Check the easy things first. Claiming the ticket consumes it, and a
        // rejected password would otherwise cost the customer a second SMS.
        $name = cc_str($body, 'name', 80);
        $password = (string) ($body['password'] ?? '');
        if (mb_strlen($name) < 2) {
            cc_fail(400, 'bad_name', 'Please add your name.');
        }
        if ($problem = cc_password_problem($password)) {
            cc_fail(400, 'bad_password', $problem);
        }

        $claim = cc_ticket_claim($pdo, cc_str($body, 'ticket', 64), 'signup');
        if (!$claim['ok']) {
            cc_fail(400, $claim['error'], $claim['message']);
        }
        $phone = $claim['phone'];

        $existing = cc_member_by_phone($pdo, $phone);
        if ($existing && $existing['password_hash'] !== null) {
            cc_fail(409, 'already_registered', 'This number already has an account.');
        }
        if ($existing) {
            $pdo->prepare('UPDATE cc_members SET name = ?, password_hash = ?, verified_at = ? WHERE id = ?')
                ->execute([$name, password_hash($password, PASSWORD_DEFAULT), cc_now(), $existing['id']]);
            $member = cc_member_by_id($pdo, (int) $existing['id']);
        } else {
            $member = cc_member_create($pdo, $phone, $name, $password);
        }

        cc_json([
            'ok'     => true,
            'token'  => cc_session_start($pdo, (int) $member['id']),
            'member' => cc_member_public($member),
        ]);
    }

    case 'account/login': {
        $phone = cc_normalise_phone(cc_str($body, 'phone', 32));
        $password = (string) ($body['password'] ?? '');
        if ($phone === '' || $password === '') {
            cc_fail(400, 'bad_request', 'Enter your number and password.');
        }
        $gate = cc_login_gate($pdo, $phone, $ip);
        if (!$gate['ok']) {
            cc_fail(429, 'too_many_attempts', $gate['message']);
        }

        $member = cc_member_by_phone($pdo, $phone);

        // Same wording and roughly the same work whether or not the number
        // exists, so this cannot be used to discover who is registered.
        if (!$member || $member['password_hash'] === null) {
            password_verify($password, '$2y$10$usesomesillystringfoxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
            cc_login_record($pdo, $phone, $ip, false);
            cc_fail(401, 'bad_credentials', 'That number and password do not match.');
        }
        if (!password_verify($password, (string) $member['password_hash'])) {
            cc_login_record($pdo, $phone, $ip, false);
            cc_fail(401, 'bad_credentials', 'That number and password do not match.');
        }
        cc_login_record($pdo, $phone, $ip, true);
        if (password_needs_rehash((string) $member['password_hash'], PASSWORD_DEFAULT)) {
            $pdo->prepare('UPDATE cc_members SET password_hash = ? WHERE id = ?')
                ->execute([password_hash($password, PASSWORD_DEFAULT), $member['id']]);
        }

        cc_json([
            'ok'     => true,
            'token'  => cc_session_start($pdo, (int) $member['id']),
            'member' => cc_member_public($member),
        ]);
    }

    case 'account/reset': {
        $password = (string) ($body['password'] ?? '');
        if ($problem = cc_password_problem($password)) {
            cc_fail(400, 'bad_password', $problem);   // before the ticket is spent
        }
        $claim = cc_ticket_claim($pdo, cc_str($body, 'ticket', 64), 'reset');
        if (!$claim['ok']) {
            cc_fail(400, $claim['error'], $claim['message']);
        }
        $member = cc_member_by_phone($pdo, $claim['phone']);
        if (!$member) {
            cc_fail(404, 'no_account', 'No account uses this number.');
        }
        $pdo->prepare('UPDATE cc_members SET password_hash = ?, verified_at = ? WHERE id = ?')
            ->execute([password_hash($password, PASSWORD_DEFAULT), cc_now(), $member['id']]);
        // A password change signs every other device out.
        $pdo->prepare('DELETE FROM cc_sessions WHERE member_id = ?')->execute([$member['id']]);

        cc_json([
            'ok'     => true,
            'token'  => cc_session_start($pdo, (int) $member['id']),
            'member' => cc_member_public(cc_member_by_id($pdo, (int) $member['id'])),
        ]);
    }

    case 'account/me': {
        $member = cc_session_member($pdo);
        if (!$member) {
            cc_fail(401, 'not_signed_in', 'Sign in again.');
        }
        cc_json(['ok' => true, 'member' => cc_member_public($member)]);
    }

    case 'account/logout': {
        cc_session_end($pdo);
        cc_json(['ok' => true]);
    }
}

cc_fail(404, 'unknown_route', 'No such endpoint.');
