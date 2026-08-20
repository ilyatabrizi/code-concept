# Turning on SMS sign-up

Five steps in cPanel and the sms.ir panel. Nothing here needs SSH.

## 1. Create the database

cPanel → **MySQL Databases**

1. Create a database, e.g. `cc` — cPanel makes it `codeconc_cc`
2. Create a user, e.g. `ccuser` — becomes `codeconc_ccuser`. Use a long password.
3. **Add User To Database** → tick **ALL PRIVILEGES**

Nothing else. The tables build themselves on the first API call.

## 2. Put the config above the web root

Upload `deploy/cc-config.sample.php` to **`/home/codeconc/`** — the folder that
*contains* `public_html`, not inside it. Rename it to **`cc-config.php`**.

That location matters: anything inside `public_html` can be downloaded by
anyone who guesses the filename. One level up cannot.

Then edit it and fill in:

| Field | Where it comes from |
|---|---|
| `db.name`, `db.user`, `db.pass` | what you just created in step 1 |
| `sms.api_key` | sms.ir → برنامه‌نویسان → لیست کلیدهای API |
| `sms.template_id` | the numeric id of your verify template (step 3) |
| `sms.param_name` | the placeholder inside that template, without the `#` |
| `code_pepper` | any long random string — 40+ characters of gibberish |

Finally: right-click the file → **Permissions** → set to **600**.

## 3. Create the verify template

sms.ir panel → **ارسال سریع**. Write the message with a placeholder, e.g.

```
کد ورود شما به کد کانسپت: #CODE#
```

Save it, wait for approval, and note the **TemplateId**. If your placeholder is
`#CODE#` then `param_name` in the config is `CODE`.

## 4. Upload and test in dry-run

The config ships with `'dry_run' => true`. In that mode **no SMS is sent** — the
code is written to `/home/codeconc/cc-sms.log` instead. Use it to prove the
whole flow without spending credit.

1. Upload the site (see `deploy/README.md`)
2. Visit `https://codeconceptcafe.com/api/health` — you should see JSON with
   `"database":"connected"`. If not, the database credentials are wrong.
3. Go to the site → **Card** → Create account → enter a name and your number
4. Open `cc-sms.log` in File Manager, read the 5-digit code, type it in
5. Set a password. The card should appear.

## 5. Go live

Edit `cc-config.php` and set `'dry_run' => false`. Sign up with a real number —
the SMS should arrive within seconds.

If it does not, `cc-sms.log` records the reason sms.ir gave. The two usual
causes are no credit on the account, or a template that has not been approved.

---

## What is protected, and what is not

Codes are five digits, valid for two minutes, single use, and die after five
wrong guesses. Only a keyed hash is stored, so reading the database does not
reveal a live code.

Sending is rate limited — one code per number per minute, eight per number per
day, twelve per connection per hour. **These limits are what stop someone
draining your SMS credit with a script.** Change them in the config only with a
reason.

Passwords go through PHP's `password_hash()`. Changing a password signs every
other device out.

The API key never reaches a browser. It is read on the server from the config
file above the web root, and never appears in a response or a log.

## Endpoints

| Route | Purpose |
|---|---|
| `GET  /api/health` | status, no secrets |
| `POST /api/otp/request` | send a code |
| `POST /api/otp/verify` | check a code, returns a one-use ticket |
| `POST /api/account/create` | ticket + password → account |
| `POST /api/account/login` | number + password |
| `POST /api/account/reset` | ticket + new password |
| `GET  /api/account/me` | who is signed in |
| `POST /api/account/logout` | end this session |

## What this does not do yet

Only **identity** is on the server: who someone is, their number, their
password, their member code. Orders and points are still stored per device,
because the loyalty rules are still being decided. When those are settled,
orders move to the same database and points follow.
