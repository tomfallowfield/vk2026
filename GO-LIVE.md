# Go-live checklist: vk2026 → vanillakiller.com

Use this **one task at a time**. Do each step, then the next.  
You’re moving from `/var/www/html/vk2026` to `/var/www/vanillakiller.com/public_html`. The live site will be **https://vanillakiller.com** (no path).  
Web server: **Apache**. SSL with Let’s Encrypt.

**Right now you’re still in `html/vk2026`** – use that path for deploy and day-to-day commands until you finish the go-live tasks and switch to `vanillakiller.com/public_html`.

---

## PM2 process names (before you restart)

- **vk-deploy** – **Relic.** Current auto-deploy from GitHub does *not* use a separate PM2 process: GitHub POSTs to your app’s `/api/webhooks/deploy`, and the **same Node app** (the one that serves the site) runs `deploy.sh` internally. You can **remove** `vk-deploy` from PM2 (`pm2 delete vk-deploy`) unless you use it for something else (e.g. a cron job).
- **vk2026** – This is the one Node app (site + forms + API + analytics). We’re renaming it to **vk-form-handler**.
- **vk-analytics** – This repo only has **one** Node process; analytics is built into it. So there is no separate “vk-analytics” app in the codebase. The single app is named **vk-form-handler**. If you have another process on the server you want to call vk-analytics, rename that one separately.

After the steps below you’ll have one app: **vk-form-handler**.

---

## Before you start

- **Backup:** On the server, copy the current app somewhere safe (e.g. `cp -a /var/www/html/vk2026 /var/www/html/vk2026.backup-$(date +%Y%m%d)`).
- **Short downtime:** There will be a few minutes when the site is switching over. Do this when you’re ready.

---

## Task 1 – Create the new directory

SSH to the server, then run:

```bash
sudo mkdir -p /var/www/vanillakiller.com/public_html
sudo chown $(whoami):$(whoami) /var/www/vanillakiller.com/public_html
```

**Check:** `ls -la /var/www/vanillakiller.com/` should show `public_html` owned by you.

---

## Task 2 – Copy the app files (except node_modules and .git)

Still on the server:

```bash
rsync -av --exclude=node_modules --exclude=.git /var/www/html/vk2026/ /var/www/vanillakiller.com/public_html/
```

If you don’t have `rsync`:

```bash
cd /var/www/html/vk2026
tar cf - --exclude=node_modules --exclude=.git . | (cd /var/www/vanillakiller.com/public_html && tar xf -)
```

**Check:** `ls /var/www/vanillakiller.com/public_html` should show `index.html`, `server.js`, `deploy.sh`, etc.

---

## Task 3 – Copy .env and install dependencies in the new location

```bash
cp /var/www/html/vk2026/.env /var/www/vanillakiller.com/public_html/
cd /var/www/vanillakiller.com/public_html
npm install --omit=dev
```

**Check:** `ls node_modules` shows packages; `test -f .env && echo ok` prints `ok`.

---

## Task 4 – Point PM2 at the new directory

(Optional) Remove the old deploy relic and the old app name, then start the app from the new path with the new name:

```bash
pm2 delete vk-deploy 2>/dev/null || true
pm2 delete vk2026 2>/dev/null || true
cd /var/www/vanillakiller.com/public_html
pm2 start server.js --name vk-form-handler
pm2 save
```

**Check:** `pm2 list` shows `vk-form-handler` running; `pm2 logs vk-form-handler --lines 5` shows no crash.

---

## Task 5 – Configure Apache for vanillakiller.com

The app serves the site at **/** and the API at **/api**. Apache will proxy everything to Node on port 3000.

Create or edit the vhost:

```bash
sudo nano /etc/apache2/sites-available/vanillakiller.com.conf
```

Put this in the file (proxy entire site to Node):

```apache
<VirtualHost *:80>
    ServerName vanillakiller.com
    ServerAlias www.vanillakiller.com
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
</VirtualHost>
```

Enable the site and proxy modules, then reload Apache:

```bash
sudo a2ensite vanillakiller.com
sudo a2enmod proxy proxy_http
sudo systemctl reload apache2
```

**Check:** From your laptop: `curl -sI http://vanillakiller.com/` (or your server IP if DNS isn’t updated yet) should return 200.

---

## Task 6 – Get SSL with Let’s Encrypt (Certbot)

```bash
sudo apt install -y certbot python3-certbot-apache
sudo certbot --apache -d vanillakiller.com -d www.vanillakiller.com
```

Follow the prompts (email, agree to terms). Certbot will add HTTPS and usually redirect HTTP → HTTPS.

**Check:** `curl -sI https://vanillakiller.com/` returns 200 and no certificate errors.

---

## Task 7 – Update the deploy script on the server

The repo’s `deploy.sh` is already updated to use the new path. On the server, either pull the change or edit in place:

**Option A – Pull from git (recommended):**

```bash
cd /var/www/vanillakiller.com/public_html
git fetch origin
git checkout main
git pull origin main
```

**Option B – Edit in place:**

```bash
nano /var/www/vanillakiller.com/public_html/deploy.sh
```

Change the line `cd /var/www/html/vk2026` to:

```bash
cd /var/www/vanillakiller.com/public_html
```

**Check:** `head -12 /var/www/vanillakiller.com/public_html/deploy.sh` shows the new path.

---

## Task 8 – Update GitHub deploy webhook URL (for auto-deploy)

In **GitHub** → repo → Settings → Secrets and variables → Actions, set:

- **DEPLOY_WEBHOOK_URL:** `https://vanillakiller.com/api/webhooks/deploy`

Keep **DEPLOY_WEBHOOK_SECRET** the same as in your server `.env`.

---

## Task 9 – Test the deploy script

```bash
cd /var/www/vanillakiller.com/public_html
./deploy.sh
```

**Check:** Script finishes without errors; `pm2 list` still shows `vk-form-handler` running; https://vanillakiller.com/ loads.

---

## Task 10 – Optional: DNS and cleanup

- In your DNS provider, set **vanillakiller.com** and **www.vanillakiller.com** to point to this server’s IP (A records) if not already.
- Once everything works from the new path, you can remove or archive the old directory:  
  `sudo rm -rf /var/www/html/vk2026` (only after you’re sure the new path is good).

---

## Deploy failing?

**See where it failed:** Run the script by hand and watch the output. Use the path where the app actually lives (e.g. still `html/vk2026` until you’ve done go-live):

```bash
cd /var/www/html/vk2026 && ./deploy.sh
```

- **Fails at "Pulling latest" or "Updating to origin/main"** – Server’s `main` may be behind or detached. Check `git status` and `git branch`. The script now uses `git reset --hard origin/main` after fetch so you always match the remote.
- **Fails at "Installing dependencies"** – Run `npm install --omit=dev` yourself and check the error (network, Node version, or a broken dependency).
- **Fails at "Restarting app..."** – PM2 might not have an app named `vk-form-handler` yet. The script now starts it if missing: `pm2 start server.js --name vk-form-handler`. If you use a different path, run that once from the app directory, then `pm2 save`.
- **Webhook returns 202 but nothing happens** – On the server, check `pm2 logs vk-form-handler` and the process that runs the webhook (e.g. the same Node app). Ensure `DEPLOY_WEBHOOK_SECRET` in `.env` matches the secret in GitHub repo secrets.

---

## Quick reference

**Current (still in html/vk2026):**

| What            | Value |
|-----------------|--------|
| App directory   | `/var/www/html/vk2026` |
| Manual deploy   | `cd /var/www/html/vk2026 && ./deploy.sh` |
| PM2 app name    | `vk-form-handler` |
| Site URL        | Your server URL (e.g. `https://yourserver/vk2026/` or IP) |
| .env            | In app dir; set `SITE_BASE_URL` to match how you access the site |
| Deploy webhook  | `https://yourserver/api/webhooks/deploy` (or with `/vk2026` if still under path) |

**After go-live (vanillakiller.com):**

| What            | Value |
|-----------------|--------|
| App directory   | `/var/www/vanillakiller.com/public_html` |
| Manual deploy   | `cd /var/www/vanillakiller.com/public_html && ./deploy.sh` |
| PM2 app name    | `vk-form-handler` |
| Site URL        | **https://vanillakiller.com** |
| Deploy webhook  | `https://vanillakiller.com/api/webhooks/deploy` |
