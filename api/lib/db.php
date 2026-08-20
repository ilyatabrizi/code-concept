<?php
/**
 * PDO connection plus a tiny migration runner.
 *
 * Production is MySQL on cPanel. The test suite runs the identical code against
 * SQLite, so the DDL below is emitted per driver. Everything else — queries,
 * placeholders, date handling — is written once and shared.
 */
declare(strict_types=1);

function cc_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $cfg = cc_config();

    // The tests point this at a SQLite file; production never sets it.
    $dsnOverride = getenv('CC_TEST_DSN');
    try {
        if ($dsnOverride !== false && $dsnOverride !== '') {
            $pdo = new PDO($dsnOverride, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
        } else {
            $db = $cfg['db'];
            $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $db['host'], $db['name']);
            $pdo = new PDO($dsn, $db['user'], $db['pass'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        }
    } catch (PDOException $e) {
        cc_log('db connect failed: ' . $e->getMessage());
        cc_fail(500, 'db_unavailable', 'The database is not reachable.');
    }
    cc_migrate($pdo);
    return $pdo;
}

function cc_driver(PDO $pdo): string
{
    return $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
}

/** UTC, and the same string format on both drivers so comparisons sort right. */
function cc_now(int $offsetSeconds = 0): string
{
    return gmdate('Y-m-d H:i:s', time() + $offsetSeconds);
}

const CC_SCHEMA_VERSION = 2;

function cc_migrate(PDO $pdo): void
{
    $sqlite = cc_driver($pdo) === 'sqlite';
    $pk  = $sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY';
    $tail = $sqlite ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    /* MySQL has never accepted IF NOT EXISTS on CREATE INDEX — at any version.
       (MariaDB does, from 10.1.4, which is why this looks harmless on some hosts
       and is a fatal 1064 on others.) Emit it only for SQLite; on MySQL a re-run
       raises 1061 "duplicate key name", which the catch below forgives. */
    $ine = $sqlite ? 'IF NOT EXISTS ' : '';

    $pdo->exec("CREATE TABLE IF NOT EXISTS cc_schema (version INT NOT NULL)$tail");
    $have = (int) ($pdo->query('SELECT version FROM cc_schema LIMIT 1')->fetchColumn() ?: 0);
    if ($have >= CC_SCHEMA_VERSION) {
        return;
    }

    $statements = [
        // ---- who the customer is ------------------------------------------
        // points/lifetime/spend/visits are reserved for when the loyalty rules
        // are settled; nothing writes them yet.
        "CREATE TABLE IF NOT EXISTS cc_members (
            id            $pk,
            phone         VARCHAR(10)  NOT NULL,
            name          VARCHAR(80)  NOT NULL DEFAULT '',
            code          VARCHAR(12)  NOT NULL,
            password_hash VARCHAR(255) NULL,
            verified_at   DATETIME     NULL,
            created_at    DATETIME     NOT NULL,
            points        INT NOT NULL DEFAULT 0,
            lifetime      INT NOT NULL DEFAULT 0,
            spend         INT NOT NULL DEFAULT 0,
            visits        INT NOT NULL DEFAULT 0
        )$tail",
        "CREATE UNIQUE INDEX {$ine}cc_members_phone ON cc_members (phone)",
        "CREATE UNIQUE INDEX {$ine}cc_members_code  ON cc_members (code)",

        // ---- one-time codes -------------------------------------------------
        // Only a keyed hash is stored, never the digits themselves.
        "CREATE TABLE IF NOT EXISTS cc_otp (
            id          $pk,
            phone       VARCHAR(10) NOT NULL,
            code_hash   VARCHAR(64) NOT NULL,
            purpose     VARCHAR(16) NOT NULL,
            attempts    INT NOT NULL DEFAULT 0,
            expires_at  DATETIME NOT NULL,
            consumed_at DATETIME NULL,
            ip          VARCHAR(45) NOT NULL DEFAULT '',
            created_at  DATETIME NOT NULL
        )$tail",
        "CREATE INDEX {$ine}cc_otp_phone ON cc_otp (phone, created_at)",
        "CREATE INDEX {$ine}cc_otp_ip    ON cc_otp (ip, created_at)",

        // ---- proof that a number passed a code ------------------------------
        // Exchanged for a password. Keeps the code and the password in separate
        // requests, so a code can never be replayed to set a password twice.
        "CREATE TABLE IF NOT EXISTS cc_tickets (
            id         $pk,
            token_hash VARCHAR(64) NOT NULL,
            phone      VARCHAR(10) NOT NULL,
            purpose    VARCHAR(16) NOT NULL,
            expires_at DATETIME NOT NULL,
            used_at    DATETIME NULL,
            created_at DATETIME NOT NULL
        )$tail",
        "CREATE UNIQUE INDEX {$ine}cc_tickets_token ON cc_tickets (token_hash)",

        // ---- signed-in devices ---------------------------------------------
        "CREATE TABLE IF NOT EXISTS cc_sessions (
            id         $pk,
            token_hash VARCHAR(64) NOT NULL,
            member_id  INT NOT NULL,
            created_at DATETIME NOT NULL,
            last_seen  DATETIME NOT NULL,
            expires_at DATETIME NOT NULL
        )$tail",
        "CREATE UNIQUE INDEX {$ine}cc_sessions_token  ON cc_sessions (token_hash)",
        "CREATE INDEX {$ine}cc_sessions_member ON cc_sessions (member_id)",

        // ---- password attempts ----------------------------------------------
        // Sending a code is rate limited; guessing a password must be too, or the
        // OTP step buys nothing once an account exists.
        "CREATE TABLE IF NOT EXISTS cc_logins (
            id         $pk,
            phone      VARCHAR(10) NOT NULL,
            ip         VARCHAR(45) NOT NULL DEFAULT '',
            ok         INT NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL
        )$tail",
        "CREATE INDEX {$ine}cc_logins_phone ON cc_logins (phone, created_at)",
        "CREATE INDEX {$ine}cc_logins_ip    ON cc_logins (ip, created_at)",
    ];

    foreach ($statements as $sql) {
        // A re-run of an index that already exists is the only error to forgive.
        try {
            $pdo->exec($sql);
        } catch (PDOException $e) {
            $msg = strtolower($e->getMessage());
            $harmless = str_contains($msg, 'duplicate key name')   // MySQL 1061
                     || str_contains($msg, 'already exists');       // SQLite
            if (!$harmless) {
                cc_log('migration failed: ' . $e->getMessage() . ' :: ' . substr($sql, 0, 120));
                // Never let a schema problem surface as a PHP fatal — the caller
                // would receive HTML where the client expects JSON.
                cc_fail(500, 'db_migration_failed',
                    'The database is not ready. Check the account has CREATE TABLE rights.');
            }
        }
    }

    if ($have === 0) {
        $pdo->prepare('INSERT INTO cc_schema (version) VALUES (?)')->execute([CC_SCHEMA_VERSION]);
    } else {
        $pdo->prepare('UPDATE cc_schema SET version = ?')->execute([CC_SCHEMA_VERSION]);
    }
}
