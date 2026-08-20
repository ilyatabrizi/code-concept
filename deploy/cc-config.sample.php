<?php
/**
 * Code Concept — server configuration.
 *
 * COPY THIS FILE TO:  /home/codeconc/cc-config.php
 * (one level ABOVE public_html, so the web server can never serve it)
 *
 * Then chmod it to 600 in cPanel File Manager → Permissions.
 * It holds live secrets and must never be committed to the repo.
 */

return [

    // ---- database -----------------------------------------------------------
    // cPanel → MySQL Databases. Create a database and a user, then grant that
    // user ALL PRIVILEGES on the database. cPanel prefixes both with your
    // account name, e.g. codeconc_cc and codeconc_ccuser.
    'db' => [
        'host' => 'localhost',
        'name' => 'codeconc_cc',
        'user' => 'codeconc_ccuser',
        'pass' => 'PUT-THE-DATABASE-PASSWORD-HERE',
    ],

    // ---- sms.ir -------------------------------------------------------------
    // Panel → برنامه‌نویسان → لیست کلیدهای API for the key.
    // Panel → ارسال سریع to create the verify template; it gives you the id.
    'sms' => [
        'api_key'     => 'PUT-THE-SMS-IR-API-KEY-HERE',

        // The numeric TemplateId of your verify template.
        'template_id' => 0,

        // The placeholder name inside that template, without the # marks.
        // If the template reads "کد ورود شما: #CODE#" then this is CODE.
        'param_name'  => 'CODE',

        // true  = do NOT send a real SMS; write the code to the log below.
        //         Use this to test the whole flow without spending credit.
        // false = send for real. MUST be false in production.
        'dry_run'     => true,

        // Where dry-run codes and send failures are recorded. Outside the web
        // root, so it is never downloadable.
        'log'         => '/home/codeconc/cc-sms.log',
    ],

    // ---- security -----------------------------------------------------------
    // Random string, at least 32 characters. Used to hash the one-time codes so
    // a database leak alone does not reveal them. Generate one with:
    //   php -r "echo bin2hex(random_bytes(32));"
    // Changing it invalidates every code in flight — harmless, they last 2 min.
    'code_pepper' => 'PUT-A-LONG-RANDOM-STRING-HERE',

    // Origins allowed to call this API.
    'allowed_origins' => [
        'https://codeconceptcafe.com',
        'https://www.codeconceptcafe.com',
    ],

    // ---- limits -------------------------------------------------------------
    // Each SMS costs credit, so these are what stop someone draining the
    // account with a loop. Loosen only with a good reason.
    'limits' => [
        'code_ttl'          => 120,  // seconds a code stays valid
        'code_attempts'     => 5,    // wrong guesses before the code dies
        'resend_wait'       => 60,   // seconds before the same number may resend
        'per_phone_per_day' => 8,    // codes to one number in 24h
        'per_ip_per_hour'   => 12,   // codes from one IP in an hour
    ],
];
