# Deploying to codeconceptcafe.com (Limoo Host / cPanel)

`htaccess` is the Apache config that ships as `.htaccess` in `public_html`.
It is kept here without the leading dot so it stays visible in git and in
Finder. The packaging step renames it.

It handles:

- forcing https (the PWA install and service worker require it)
- `www` → apex
- MIME types some shared hosts miss (`.webmanifest`, `.woff2`, `.webp`)
- `ErrorDocument 404 /404.html`, which bounces into the hash router
- long cache for hashed assets, `no-cache` for the shell

## Building the upload package

    python3 build.py          # stamps ?v= hashes on the CSS/JS and the sw cache name
    python3 deploy/package.py # writes ~/Downloads/codeconceptcafe.zip

Then in cPanel File Manager: `public_html` → delete the old files (keep
`cgi-bin`) → Upload the zip → Extract → delete the zip. Turn on
**Settings → Show Hidden Files** first, or `.htaccess` stays invisible.
