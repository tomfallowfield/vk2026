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

Optional (for Mailchimp lead magnets):

- `MAILCHIMP_API_KEY`
- `MAILCHIMP_SERVER_PREFIX` (e.g. `us19`)
- `MAILCHIMP_AUDIENCE_ID`

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

Configure an automation (or segment) in Mailchimp so that when a contact has tag `lead-50things`, `lead-offboarding`, or `lead-socialproof`, they receive the correct lead-magnet email. The API only adds/updates the contact and sets the tag.
