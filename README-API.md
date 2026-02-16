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
