<?php
/**
 * One-time codes and the tickets they buy.
 *
 * Codes are stored as a keyed hash (HMAC-SHA256 with a pepper from the config),
 * so reading the database is not enough to use one. They expire, they are single
 * use, and they die after a handful of wrong guesses.
 */
declare(strict_types=1);

function cc_hash_code(string $phone, string $code): string
{
    $pepper = (string) (cc_config()['code_pepper'] ?? '');
    return hash_hmac('sha256', $phone . '|' . $code, $pepper);
}

function cc_hash_token(string $token): string
{
    return hash('sha256', $token);
}

function cc_limits(): array
{
    return (cc_config()['limits'] ?? []) + [
        'code_ttl'          => 120,
        'code_attempts'     => 5,
        'resend_wait'       => 60,
        'per_phone_per_day' => 8,
        'per_ip_per_hour'   => 12,
    ];
}

/**
 * The gates read the very rows cc_otp_issue() writes, and cc_otp_check() reads an
 * attempt counter it then increments. Both are check-then-act: without a lock a
 * burst of simultaneous requests all see the pre-burst state, so one number could
 * be billed for a dozen texts at once, or a code brute-forced far past its five
 * allowed guesses. One short lock covers each, released before anything slow.
 */
function cc_otp_lock(PDO $pdo): bool
{
    if (cc_driver($pdo) === 'mysql') {
        $stmt = $pdo->prepare('SELECT GET_LOCK(?, 5)');
        $stmt->execute(['cc_otp_gate']);
        return (int) $stmt->fetchColumn() === 1;
    }
    // SQLite takes the write lock up front, so no other connection can insert
    // between our reads and ours.
    $pdo->exec('PRAGMA busy_timeout = 5000');
    $pdo->exec('BEGIN IMMEDIATE');
    return true;
}

function cc_otp_unlock(PDO $pdo): void
{
    if (cc_driver($pdo) === 'mysql') {
        $pdo->prepare('SELECT RELEASE_LOCK(?)')->execute(['cc_otp_gate']);
        return;
    }
    // exec('BEGIN IMMEDIATE') is invisible to PDO::inTransaction(), so commit by
    // hand rather than testing for an open transaction.
    $pdo->exec('COMMIT');
}

/**
 * Rate gates, in the order a person would hit them.
 * @return array{ok:bool, error?:string, message?:string, retry_after?:int}
 */
function cc_otp_check_limits(PDO $pdo, string $phone, string $ip): array
{
    $L = cc_limits();

    $stmt = $pdo->prepare(
        'SELECT created_at FROM cc_otp WHERE phone = ? ORDER BY id DESC LIMIT 1'
    );
    $stmt->execute([$phone]);
    $last = $stmt->fetchColumn();
    if ($last) {
        $age = time() - strtotime($last . ' UTC');
        if ($age < $L['resend_wait']) {
            return [
                'ok' => false,
                'error' => 'too_soon',
                'message' => 'A code was just sent. Wait a moment before asking for another.',
                'retry_after' => $L['resend_wait'] - $age,
            ];
        }
    }

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM cc_otp WHERE phone = ? AND created_at > ?');
    $stmt->execute([$phone, cc_now(-86400)]);
    if ((int) $stmt->fetchColumn() >= $L['per_phone_per_day']) {
        return [
            'ok' => false,
            'error' => 'phone_quota',
            'message' => 'Too many codes for this number today. Try again tomorrow, or call the shop.',
        ];
    }

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM cc_otp WHERE ip = ? AND created_at > ?');
    $stmt->execute([$ip, cc_now(-3600)]);
    if ((int) $stmt->fetchColumn() >= $L['per_ip_per_hour']) {
        return [
            'ok' => false,
            'error' => 'ip_quota',
            'message' => 'Too many requests from this connection. Try again later.',
        ];
    }

    return ['ok' => true];
}

/**
 * How many times this connection has asked about a number in the last hour,
 * whether or not a code was actually sent. Requests that are refused early
 * (already registered, no such account) send nothing and so leave no cc_otp
 * row — they are recorded in cc_logins instead, and counted here too, or the
 * "already registered" reply could be used to walk a list of numbers.
 */
function cc_probe_count(PDO $pdo, string $ip): int
{
    $since = cc_now(-3600);
    $a = $pdo->prepare('SELECT COUNT(*) FROM cc_otp WHERE ip = ? AND created_at > ?');
    $a->execute([$ip, $since]);
    $b = $pdo->prepare("SELECT COUNT(*) FROM cc_logins WHERE ip = ? AND ok = 2 AND created_at > ?");
    $b->execute([$ip, $since]);
    return (int) $a->fetchColumn() + (int) $b->fetchColumn();
}

/** ok = 2 marks an existence probe, distinct from a failed password (0). */
function cc_probe_record(PDO $pdo, string $phone, string $ip): void
{
    $pdo->prepare('INSERT INTO cc_logins (phone, ip, ok, created_at) VALUES (?, ?, 2, ?)')
        ->execute([$phone, $ip, cc_now()]);
}

/** Create and store a code. Returns the plain code for sending — nothing else may see it. */
function cc_otp_issue(PDO $pdo, string $phone, string $purpose, string $ip): string
{
    $L = cc_limits();
    $max = (10 ** CC_CODE_LENGTH) - 1;
    $code = str_pad((string) random_int(0, $max), CC_CODE_LENGTH, '0', STR_PAD_LEFT);

    // Any earlier live code for this number stops working the moment a new one
    // is issued, so two codes are never valid at once.
    $pdo->prepare('UPDATE cc_otp SET consumed_at = ? WHERE phone = ? AND consumed_at IS NULL')
        ->execute([cc_now(), $phone]);

    $pdo->prepare(
        'INSERT INTO cc_otp (phone, code_hash, purpose, attempts, expires_at, ip, created_at)
         VALUES (?, ?, ?, 0, ?, ?, ?)'
    )->execute([
        $phone,
        cc_hash_code($phone, $code),
        $purpose,
        cc_now($L['code_ttl']),
        $ip,
        cc_now(),
    ]);

    return $code;
}

/**
 * @return array{ok:bool, error?:string, message?:string, left?:int}
 */
function cc_otp_check(PDO $pdo, string $phone, string $code, string $purpose): array
{
    $L = cc_limits();
    $stmt = $pdo->prepare(
        'SELECT * FROM cc_otp
         WHERE phone = ? AND purpose = ? AND consumed_at IS NULL
         ORDER BY id DESC LIMIT 1'
    );
    $stmt->execute([$phone, $purpose]);
    $row = $stmt->fetch();

    if (!$row) {
        return ['ok' => false, 'error' => 'no_code', 'message' => 'Ask for a new code.'];
    }
    if (strtotime($row['expires_at'] . ' UTC') < time()) {
        return ['ok' => false, 'error' => 'expired', 'message' => 'That code has expired. Ask for a new one.'];
    }
    if ((int) $row['attempts'] >= $L['code_attempts']) {
        $pdo->prepare('UPDATE cc_otp SET consumed_at = ? WHERE id = ?')->execute([cc_now(), $row['id']]);
        return ['ok' => false, 'error' => 'too_many_attempts', 'message' => 'Too many wrong tries. Ask for a new code.'];
    }

    if (!hash_equals((string) $row['code_hash'], cc_hash_code($phone, $code))) {
        $pdo->prepare('UPDATE cc_otp SET attempts = attempts + 1 WHERE id = ?')->execute([$row['id']]);
        $left = $L['code_attempts'] - ((int) $row['attempts'] + 1);
        return [
            'ok' => false,
            'error' => 'wrong_code',
            'message' => 'That code is not right.',
            'left' => max(0, $left),
        ];
    }

    $pdo->prepare('UPDATE cc_otp SET consumed_at = ? WHERE id = ?')->execute([cc_now(), $row['id']]);
    return ['ok' => true];
}

/** Short-lived proof that this number just passed a code. */
function cc_ticket_issue(PDO $pdo, string $phone, string $purpose): string
{
    $token = bin2hex(random_bytes(24));
    $pdo->prepare(
        'INSERT INTO cc_tickets (token_hash, phone, purpose, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)'
    )->execute([cc_hash_token($token), $phone, $purpose, cc_now(900), cc_now()]);
    return $token;
}

/** @return array{ok:bool, phone?:string, error?:string, message?:string} */
function cc_ticket_claim(PDO $pdo, string $token, string $purpose): array
{
    if ($token === '') {
        return ['ok' => false, 'error' => 'no_ticket', 'message' => 'Verify your number first.'];
    }
    $stmt = $pdo->prepare('SELECT * FROM cc_tickets WHERE token_hash = ? LIMIT 1');
    $stmt->execute([cc_hash_token($token)]);
    $row = $stmt->fetch();

    if (!$row || $row['purpose'] !== $purpose) {
        return ['ok' => false, 'error' => 'bad_ticket', 'message' => 'Verify your number again.'];
    }
    if ($row['used_at'] !== null) {
        return ['ok' => false, 'error' => 'ticket_used', 'message' => 'That step is already done. Try signing in.'];
    }
    if (strtotime($row['expires_at'] . ' UTC') < time()) {
        return ['ok' => false, 'error' => 'ticket_expired', 'message' => 'That took too long. Verify your number again.'];
    }

    $pdo->prepare('UPDATE cc_tickets SET used_at = ? WHERE id = ?')->execute([cc_now(), $row['id']]);
    return ['ok' => true, 'phone' => (string) $row['phone']];
}
