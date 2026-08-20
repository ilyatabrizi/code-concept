<?php
/**
 * Shared setup: config, errors, JSON helpers, CORS.
 * Everything under api/ goes through here.
 */
declare(strict_types=1);

// Never leak a stack trace to a caller; log instead.
ini_set('display_errors', '0');
error_reporting(E_ALL);

const CC_CODE_LENGTH = 5;
const CC_SESSION_DAYS = 90;

function cc_config(): array
{
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }
    /* Only ever above the web root. The second candidate exists so a local
       checkout can run without a cPanel layout, but neither may sit inside a
       directory the server publishes — a config in public_html is downloadable
       by anyone who guesses the name, and that file holds the SMS key. */
    $docRoot = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? '')) ?: '';
    foreach ([dirname(__DIR__, 3), dirname(__DIR__, 2)] as $dir) {
        $path = $dir . '/cc-config.php';
        if (!is_readable($path)) {
            continue;
        }
        $real = realpath($path) ?: $path;
        if ($docRoot !== '' && str_starts_with($real, $docRoot . DIRECTORY_SEPARATOR)) {
            cc_log('REFUSED config inside the web root: ' . $real);
            cc_fail(500, 'config_exposed',
                'The configuration file is inside the public folder. Move it one level above public_html.');
        }
        $loaded = require $path;
        if (!is_array($loaded)) {
            cc_fail(500, 'server_misconfigured', 'The configuration file did not return an array.');
        }
        $cfg = $loaded;
        return $cfg;
    }
    cc_fail(500, 'server_misconfigured',
        'Configuration file not found. Copy cc-config.sample.php to /home/codeconc/cc-config.php.');
}

/** Log somewhere only the account owner can read. */
function cc_log(string $message): void
{
    $cfg = cc_config();
    $path = $cfg['sms']['log'] ?? (dirname(__DIR__, 3) . '/cc-sms.log');
    @file_put_contents(
        $path,
        '[' . gmdate('Y-m-d H:i:s') . "Z] " . $message . "\n",
        FILE_APPEND | LOCK_EX
    );
}

function cc_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Uniform error shape: { ok:false, error:"slug", message:"..." } */
function cc_fail(int $status, string $slug, string $message, array $extra = []): void
{
    cc_json(array_merge(['ok' => false, 'error' => $slug, 'message' => $message], $extra), $status);
}

function cc_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function cc_str(array $src, string $key, int $max = 200): string
{
    $v = $src[$key] ?? '';
    if (!is_scalar($v)) {
        return '';
    }
    return mb_substr(trim((string) $v), 0, $max);
}

function cc_client_ip(): string
{
    // Shared hosting sits behind LiteSpeed; trust the proxy header only when
    // the connection itself is local.
    $remote = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $fwd = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
    if ($fwd !== '' && in_array($remote, ['127.0.0.1', '::1'], true)) {
        $first = trim(explode(',', $fwd)[0]);
        if (filter_var($first, FILTER_VALIDATE_IP)) {
            return $first;
        }
    }
    return $remote;
}

/**
 * Iranian mobiles, reduced to the 10 digits sms.ir expects: 9XXXXXXXXX.
 * Accepts 09146306050, +989146306050, 989146306050, 9146306050 and any
 * spacing or dashes in between. Returns '' when it is not a mobile number.
 */
function cc_normalise_phone(string $raw): string
{
    $d = preg_replace('/\D+/', '', $raw) ?? '';
    if ($d === '') {
        return '';
    }
    if (str_starts_with($d, '0098')) {
        $d = substr($d, 4);
    } elseif (str_starts_with($d, '98') && strlen($d) === 12) {
        $d = substr($d, 2);
    }
    $d = ltrim($d, '0');
    return preg_match('/^9\d{9}$/', $d) === 1 ? $d : '';
}

/** How the number is shown back to a person. */
function cc_display_phone(string $tenDigits): string
{
    return '0' . substr($tenDigits, 0, 3) . ' ' . substr($tenDigits, 3, 3) . ' ' . substr($tenDigits, 6);
}

function cc_cors(): void
{
    $cfg = cc_config();
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowed = $cfg['allowed_origins'] ?? [];
    if ($origin !== '' && in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
        header('Access-Control-Max-Age: 600');
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

/** Member codes shown on the card. No ambiguous glyphs. */
function cc_member_code(): string
{
    $alphabet = '23456789ACDEFGHJKLMNPQRSTUVWXYZ';
    $out = '';
    for ($i = 0; $i < 6; $i++) {
        $out .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }
    return 'CC-' . $out;
}
