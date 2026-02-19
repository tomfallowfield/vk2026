# Migration script (automated content import)

A Node script (`scripts/migrate-to-strapi.js`) will parse your existing content and POST it to Strapi's API. No manual copy/paste.

## Prerequisites

- Strapi running at `http://localhost:1337` (or `STRAPI_URL` from env)
- Content types and components created (schema in place)
- API token: Strapi Admin → Settings → API Tokens → Create (full access for migration)

## What it migrates

| Source | Action |
|--------|--------|
| settings.js | Parse `SITE_SETTINGS`, PUT to `/api/site-setting` (single type) |
| index.html FAQs | Parse `.faq` blocks (question + answer), POST each to `/api/faqs` |
| index.html Testimonials | Parse testimonial blocks (quote, author, role, avatar path), POST to `/api/testimonials` |
| index.html Pricing tiers | Parse pricing panels (core, leadmagnet, multipage), POST to `/api/pricing-tiers` |
| index.html Lead magnets | Parse resource cards, POST to `/api/lead-magnets` |
| index.html Hero + sections | Parse hero, pricing section headers, FAQ headers, footer; PUT to `/api/home` |

## Images

- **LinkedIn faces:** Store `photo` as string (filename, e.g. `arthur jones.jpg`). Frontend keeps using `images/li_mugs/`.
- **Testimonial avatars:** Store as string path (e.g. `images/testimonial_mugs/arthur.jpg`) or optionally upload to Strapi media. Migration script uses paths initially.

## How to run

```bash
STRAPI_URL=http://localhost:1337 STRAPI_TOKEN=your-token node scripts/migrate-to-strapi.js
```

## Flow

1. Read `settings.js`, extract `SITE_SETTINGS` (eval or regex/parser).
2. Read `index.html`, use regex or cheerio to extract FAQ, testimonial, pricing, resource blocks.
3. Authenticate with Strapi (API token in `Authorization: Bearer` header).
4. PUT `/api/site-setting`, POST to `/api/faqs`, `/api/testimonials`, `/api/pricing-tiers`, `/api/lead-magnets`, PUT `/api/home`.
5. Log success/failures. Spot-check a few entries in Strapi admin.

## Idempotency

Running twice will create duplicates for collection types. Options:

- Run once on empty Strapi (recommended), or
- Add `--clear` flag to delete existing entries first, or
- Skip migration for collection types that already have entries.
