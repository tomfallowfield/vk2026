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

## Task 6b – Redirects: HTTP → HTTPS and www → non-www

**HTTP → HTTPS:** When you ran Certbot, it likely asked “Redirect HTTP to HTTPS?” — if you chose Yes, port 80 already redirects to HTTPS. If not, the port-80 vhost should contain something like `Redirect permanent / https://vanillakiller.com/`.

**www → non-www:** So that `https://www.vanillakiller.com` goes to `https://vanillakiller.com`, add a redirect in the **HTTPS** vhost (the one Certbot created, e.g. `vanillakiller.com-le-ssl.conf`).

On the server:

```bash
sudo nano /etc/apache2/sites-available/vanillakiller.com-le-ssl.conf
```

Inside the `<VirtualHost *:443>...</VirtualHost>` block, add these lines **right after** the opening `<VirtualHost *:443>` (before `ServerName` is fine):

```apache
    RewriteEngine On
    RewriteCond %{HTTP_HOST} ^www\.(.+)$ [NC]
    RewriteRule ^ https://%1%{REQUEST_URI} [R=301,L]
```

Enable `rewrite` if needed, then reload Apache:

```bash
sudo a2enmod rewrite
sudo systemctl reload apache2
```

**Check:**  
`curl -sI https://www.vanillakiller.com/` → `Location: https://vanillakiller.com/` and **301**.  
`curl -sI http://vanillakiller.com/` → **301** to `https://vanillakiller.com/`.

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

## Before you change DNS – checklist

Tick these off so nothing’s missing when the domain flips to your server:

**On the server**

- [ ] App lives in `/var/www/vanillakiller.com/public_html` with latest code (`git pull` if needed).
- [ ] `.env` exists there and has `SITE_BASE_URL=https://vanillakiller.com` (and other secrets: Mailchimp, Notion, `DEPLOY_WEBHOOK_SECRET`, etc.).
- [ ] PM2: `vk-form-handler` is running (`pm2 list`); you’ve run `pm2 save`.
- [ ] Apache vhost for vanillakiller.com (port 80) is enabled and reloaded; test:  
  `curl -sI -H "Host: vanillakiller.com" http://139.59.113.186/` → **200 OK**.

**GitHub (repo Settings → Secrets and variables → Actions)**

- [ ] **DEPLOY_WEBHOOK_URL** = `https://vanillakiller.com/api/webhooks/deploy` (no `/vk2026`, same as new site URL).
- [ ] **DEPLOY_WEBHOOK_SECRET** = same value as `DEPLOY_WEBHOOK_SECRET` in server `.env`.

**After DNS**

- [ ] Change DNS: A records for `vanillakiller.com` and `www.vanillakiller.com` → your server IP (`139.59.113.186`).
- [ ] When propagated, run Certbot:  
  `sudo certbot --apache -d vanillakiller.com -d www.vanillakiller.com`.

**Optional**

- [ ] PM2 starts on reboot: `pm2 startup` (if not already done).

---

## Task 10 – Optional: DNS and cleanup

- In your DNS provider, set **vanillakiller.com** and **www.vanillakiller.com** to point to this server’s IP (A records) if not already.
- Once everything works from the new path, you can remove or archive the old directory:  
  `sudo rm -rf /var/www/html/vk2026` (only after you’re sure the new path is good).

---

## Auto-deploy not working? (push to main, no deploy)

GitHub doesn’t email you when a workflow fails unless you turn on notifications. Check in this order:

**1. Did the workflow run?**  
Repo → **Actions** tab. Find the “Deploy on push” workflow. Did it run for your last push?  
- **No run** – Push might have been to a different branch (workflow only runs on `main`). Or Actions are disabled for the repo.  
- **Run failed (red)** – Click the run and open “Trigger deploy”. You’ll see the `curl` error: **401** = secret mismatch (fix `DEPLOY_WEBHOOK_SECRET` in repo Secrets and in server `.env`); **connection refused / timeout** = wrong `DEPLOY_WEBHOOK_URL` or server/firewall.  
- **Run succeeded (green)** – The webhook returned 202, so the problem is on the **server**: `deploy.sh` ran in the background and may have failed. Go to step 2.

**2. Run deploy on the server and watch output:**

```bash
cd /var/www/vanillakiller.com/public_html && ./deploy.sh
```

If that fails, the same failure happened when the webhook ran (and was only logged on the server). Fix the error; next push will then deploy. You can also check `pm2 logs vk-form-handler` for “Deploy script error” or “Deploy completed successfully”.

**3. Secrets (Settings → Secrets and variables → Actions)**  
- **DEPLOY_WEBHOOK_URL** = `https://vanillakiller.com/api/webhooks/deploy`  
- **DEPLOY_WEBHOOK_SECRET** = exactly the same string as `DEPLOY_WEBHOOK_SECRET` in the server’s `.env`

---

## Deploy script failing when run by hand

**See where it failed:** Run the script and watch the output:

```bash
cd /var/www/vanillakiller.com/public_html && ./deploy.sh
```

- **Fails at "Pulling latest" or "Updating to origin/main"** – Server’s `main` may be behind or detached. Check `git status` and `git branch`. The script uses `git reset --hard origin/main` after fetch so you match the remote.
- **Fails at "Installing dependencies"** – Run `npm install --omit=dev` yourself and check the error (network, Node version, or a broken dependency).
- **Fails at "Restarting app..."** – PM2 might not have an app named `vk-form-handler` yet. The script starts it if missing. Run `pm2 start server.js --name vk-form-handler` from the app directory once, then `pm2 save`.
- **Webhook returns 202 but deploy doesn’t happen** – On the server, check `pm2 logs vk-form-handler` for “Deploy script error” or “Deploy completed successfully”. Ensure `DEPLOY_WEBHOOK_SECRET` in `.env` matches the secret in GitHub repo Secrets.

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

**Slack deploy logging:** To log deployments (and failures) to a Slack channel, set `SLACK_WEBHOOK_URL` in the server `.env` to an [Incoming Webhook](https://api.slack.com/messaging/webhooks) URL. You’ll get messages when a deploy starts, when it completes, and when it fails (with error detail). Optional: add `SLACK_WEBHOOK_URL` to the repo’s GitHub Actions secrets to get a Slack alert if the deploy *trigger* fails (e.g. wrong URL or 401).
