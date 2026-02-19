# Go-live checklist: vk2026 → vanillakiller.com

Use this **one task at a time**. Do each step, then the next.  
You’re moving from `/var/www/html/vk2026` to `/var/www/vanillakiller.com/public_html`. The live site will be **https://vanillakiller.com** (no path).  
Web server: **Apache**. SSL with Let’s Encrypt.

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

Stop and remove the old app from PM2, then start it from the new path:

```bash
pm2 delete vk2026
cd /var/www/vanillakiller.com/public_html
pm2 start server.js --name vk2026
pm2 save
```

**Check:** `pm2 list` shows `vk2026` running; `pm2 logs vk2026 --lines 5` shows no crash.

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

**Check:** Script finishes without errors; `pm2 list` still shows `vk2026` running; https://vanillakiller.com/ loads.

---

## Task 10 – Optional: DNS and cleanup

- In your DNS provider, set **vanillakiller.com** and **www.vanillakiller.com** to point to this server’s IP (A records) if not already.
- Once everything works from the new path, you can remove or archive the old directory:  
  `sudo rm -rf /var/www/html/vk2026` (only after you’re sure the new path is good).

---

## Quick reference after go-live

| What            | Value |
|-----------------|--------|
| App directory   | `/var/www/vanillakiller.com/public_html` |
| Manual deploy   | `cd /var/www/vanillakiller.com/public_html && ./deploy.sh` |
| PM2 app name    | `vk2026` |
| Site URL        | **https://vanillakiller.com** |
| .env            | In `public_html`; keep `SITE_BASE_URL=https://vanillakiller.com` |
| Deploy webhook  | `https://vanillakiller.com/api/webhooks/deploy` |
