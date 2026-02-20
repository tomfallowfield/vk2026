# Form API – running the server

## 1. Install Node.js

Install from [nodejs.org](https://nodejs.org/) or your package manager. Check:

```bash
node -v
npm -v
```

## 2. Install dependencies

```bash
npm install
```

## 3. Environment

Copy the example env and edit:

```bash
cp .env.example .env
```

Set at least:

- `SITE_BASE_URL` – e.g. `http://139.59.113.186/vk2026` or `http://localhost:3000/vk2026`
- `PORT` – e.g. `3000`

Optional (for Mailchimp – contact forms and lead magnets):

- `MAILCHIMP_API_KEY` – from Mailchimp → Account → Extras → API keys
- `MAILCHIMP_SERVER_PREFIX` – e.g. `us19` (the part after the hyphen in your API key)
- `MAILCHIMP_AUDIENCE_ID` – Audience → Settings → Audience name and defaults → Audience ID

Optional (for Notion CRM):

- `NOTION_TOKEN` – integration token from Notion
- `NOTION_DATABASE_ID` – ID of the database to add rows to

## 4. Run the server

```bash
npm start
```

- Site: http://localhost:3000/vk2026  
- API: http://localhost:3000/vk2026/api

Submissions are logged to `logs/submissions.log` (NDJSON).

## 5. Notion

If you use an existing Notion CRM, the property names in `server/lib/notion.js` (Name, Email, Type, Source, Submitted At, Source URL, Message, Website) must match your database. Edit that file to match your schema.

## 6. Mailchimp

**API secrets:** No separate “form API secret” is required. The server uses the values in `.env` (Mailchimp API key, server prefix, audience ID). Keep `.env` out of git and only on the server.

**What gets synced:**

- **All forms** that collect email are added/updated in your Mailchimp audience (same list).
- **Book-a-call** and **website-review** get the tag **`submitted website contact form`**. You can create a segment or automation in Mailchimp for this tag.
- **Lead magnets** get per-form tags from `settings.js` (`lead_magnets`), e.g. `lead-50things`, `lead-offboarding`, `lead-socialproof`. Configure automations in Mailchimp so that when a contact has one of these tags, they receive the right lead-magnet email.

Tags are added without removing existing ones (e.g. someone can have both a lead-magnet tag and “submitted website contact form”).

## 7. Website wiki (Notion)

Documentation for this site is maintained in the repo and can be synced to a Notion page. Edit `docs/wiki-content.js` to change the wiki; then run `node scripts/sync-wiki-to-notion.js` to push to Notion. Create a Notion page (e.g. "VK Website Wiki"), share it with your integration, copy the page ID from the URL, and set NOTION_WIKI_PAGE_ID in .env.

## 8. Deploying to the server

**Auto-deploy (GitHub Actions):** On push to `main`, the workflow in `.github/workflows/deploy.yml` calls your server’s deploy webhook. To use it:

1. On the **server**, set in `.env`:
   - `DEPLOY_WEBHOOK_SECRET` – a random string (e.g. `openssl rand -hex 24`)
2. In **GitHub** → repo → Settings → Secrets and variables → Actions, add:
   - `DEPLOY_WEBHOOK_URL` – full URL, e.g. `https://vanillakiller.com/vk2026/api/webhooks/deploy`
   - `DEPLOY_WEBHOOK_SECRET` – same value as on the server

After that, every push to `main` triggers a deploy (the workflow POSTs to the URL with the secret; the server runs `deploy.sh`).

**Manual deploy:** SSH in and run the script:

```bash
cd /var/www/html/vk2026
./deploy.sh
```

This pulls the latest from `origin main`, runs `npm install --production`, syncs the wiki to Notion (if configured), and restarts the app with pm2.

**First-time analytics (MySQL):** To store events in MySQL and enrich visitors when forms are submitted:

1. On the server, create a database (e.g. `vk2026_analytics`) and run the schema:
   ```bash
   mysql -u your_user -p your_db < server/db/schema.sql
   ```
2. In the server’s `.env`, set:
   - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
3. Redeploy (or `pm2 restart vk2026`).

Without MySQL config, analytics events are still written to `logs/events.log` (you can `tail -f logs/events.log`). For CVR, video views, time on site, bounce rate and drill-down by referrer/UTM, see [docs/ANALYTICS.md](docs/ANALYTICS.md) and `node scripts/analytics-report.js`.
