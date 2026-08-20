<?php
/**
 * Members, passwords and signed-in devices.
 * Passwords go through password_hash(); the plain text is never stored or logged.
 */
declare(strict_types=1);

const CC_PASSWORD_MIN = 8;

function cc_password_problem(string $password): ?string
{
    $len = mb_strlen($password);
    if ($len < CC_PASSWORD_MIN) {
        return 'Use at least ' . CC_PASSWORD_MIN . ' characters.';
    }
    if ($len > 200) {
        return 'That password is too long.';
    }
    // Reject only the genuinely useless ones rather than demanding symbols;
    // length is what matters and rules push people to "Password1!".
    $trivial = ['12345678', '123456789', '1234567890', 'password', 'qwertyui', '11111111'];
    if (in_array(mb_strtolower($password), $trivial, true)) {
        return 'That password is too easy to guess.';
    }
    return null;
}

/**
 * Password guessing has to be throttled or the SMS step buys nothing once an
 * account exists. Counted per number and per connection over a short window.
 * @return array{ok:bool, message?:string}
 */
function cc_login_gate(PDO $pdo, string $phone, string $ip): array
{
    $since = cc_now(-900);   // 15 minutes

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM cc_logins WHERE phone = ? AND ok = 0 AND created_at > ?');
    $stmt->execute([$phone, $since]);
    if ((int) $stmt->fetchColumn() >= 8) {
        return ['ok' => false, 'message' =>
            'Too many failed attempts for this number. Wait fifteen minutes, or reset your password.'];
    }

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM cc_logins WHERE ip = ? AND ok = 0 AND created_at > ?');
    $stmt->execute([$ip, $since]);
    if ((int) $stmt->fetchColumn() >= 25) {
        return ['ok' => false, 'message' => 'Too many attempts from this connection. Try again later.'];
    }

    return ['ok' => true];
}

function cc_login_record(PDO $pdo, string $phone, string $ip, bool $ok): void
{
    $pdo->prepare('INSERT INTO cc_logins (phone, ip, ok, created_at) VALUES (?, ?, ?, ?)')
        ->execute([$phone, $ip, $ok ? 1 : 0, cc_now()]);
}

function cc_member_by_phone(PDO $pdo, string $phone): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM cc_members WHERE phone = ? LIMIT 1');
    $stmt->execute([$phone]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function cc_member_by_id(PDO $pdo, int $id): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM cc_members WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

/** Unique member code, retried on the astronomically unlikely collision. */
function cc_unique_code(PDO $pdo): string
{
    for ($i = 0; $i < 12; $i++) {
        $code = cc_member_code();
        $stmt = $pdo->prepare('SELECT 1 FROM cc_members WHERE code = ? LIMIT 1');
        $stmt->execute([$code]);
        if (!$stmt->fetchColumn()) {
            return $code;
        }
    }
    cc_fail(500, 'code_exhausted', 'Could not allocate a member code.');
}

function cc_member_create(PDO $pdo, string $phone, string $name, string $password): array
{
    $pdo->prepare(
        'INSERT INTO cc_members (phone, name, code, password_hash, verified_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([
        $phone,
        $name,
        cc_unique_code($pdo),
        password_hash($password, PASSWORD_DEFAULT),
        cc_now(),
        cc_now(),
    ]);
    return cc_member_by_phone($pdo, $phone) ?? [];
}

function cc_session_start(PDO $pdo, int $memberId): string
{
    $token = bin2hex(random_bytes(32));
    $pdo->prepare(
        'INSERT INTO cc_sessions (token_hash, member_id, created_at, last_seen, expires_at)
         VALUES (?, ?, ?, ?, ?)'
    )->execute([
        cc_hash_token($token),
        $memberId,
        cc_now(),
        cc_now(),
        cc_now(CC_SESSION_DAYS * 86400),
    ]);
    return $token;
}

/** The bearer token on the request, or null. */
function cc_bearer(): ?string
{
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($h === '' && function_exists('apache_request_headers')) {
        $all = apache_request_headers();
        foreach ($all as $k => $v) {
            if (strcasecmp($k, 'Authorization') === 0) {
                $h = $v;
                break;
            }
        }
    }
    if (stripos($h, 'Bearer ') === 0) {
        return trim(substr($h, 7));
    }
    return null;
}

function cc_session_member(PDO $pdo): ?array
{
    $token = cc_bearer();
    if ($token === null || $token === '') {
        return null;
    }
    $stmt = $pdo->prepare('SELECT * FROM cc_sessions WHERE token_hash = ? LIMIT 1');
    $stmt->execute([cc_hash_token($token)]);
    $s = $stmt->fetch();
    if (!$s || strtotime($s['expires_at'] . ' UTC') < time()) {
        return null;
    }
    $pdo->prepare('UPDATE cc_sessions SET last_seen = ? WHERE id = ?')->execute([cc_now(), $s['id']]);
    return cc_member_by_id($pdo, (int) $s['member_id']);
}

function cc_session_end(PDO $pdo): void
{
    $token = cc_bearer();
    if ($token) {
        $pdo->prepare('DELETE FROM cc_sessions WHERE token_hash = ?')->execute([cc_hash_token($token)]);
    }
}

/** Only ever return these fields — no hash, no internal timestamps. */
function cc_member_public(array $m): array
{
    return [
        'id'       => (int) $m['id'],
        'code'     => (string) $m['code'],
        'name'     => (string) $m['name'],
        'phone'    => cc_display_phone((string) $m['phone']),
        'joined'   => strtotime($m['created_at'] . ' UTC') * 1000,
        'verified' => $m['verified_at'] !== null,
    ];
}
