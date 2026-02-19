# CMS schema for VK2026 Strapi

This folder contains schema definitions and API code to copy into `cms/src/` after running `create-strapi-app`.

## Setup

1. Upgrade Node to 20+ (see docs/STRAPI-SETUP.md)
2. Create Strapi: `npx create-strapi-app@latest cms --quickstart`
3. Create admin user on first run
4. Copy schema: `node scripts/copy-cms-schema.js`
5. Restart Strapi: `cd cms && npm run develop`
6. In Strapi Admin: Settings → Users & Permissions → Public → enable find for site-setting, faqs, testimonials, lead-magnets
7. Create API token: Settings → API Tokens → Create (full access for migration)
8. Run migration: `STRAPI_TOKEN=xxx node scripts/migrate-to-strapi.js`

## CORS

In `cms/config/middlewares.js`, add your frontend origins to `cors.origin`:

```js
cors: {
  enabled: true,
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://vanillakiller.com', 'https://www.vanillakiller.com'],
  // ...
}
```

Or use `STRAPI_CORS_ORIGINS` env var if supported.
