# Strapi CMS setup

Strapi requires **Node.js 20+**. Your current Node is 16.x. Upgrade first:

```bash
# Option 1: Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# Restart terminal, then:
nvm install 20
nvm use 20

# Option 2: Using Homebrew (macOS)
brew install node@20
```

Then create the Strapi project:

```bash
cd /path/to/vk2026
npx create-strapi-app@latest cms --quickstart
```

This creates `cms/` with SQLite. On first run, create your admin user in the browser.

After Strapi is created, run the schema copy script:

```bash
node scripts/copy-cms-schema.js
```

To run Strapi with Content API routes (needed for migration):

```bash
cd cms && npm run build && npm run start
```

Strapi 5 TS compilation does not copy API `.js` files to `dist/`; the build runs a post-copy step. Use `npm run develop` only for admin UI work; for migration, use `npm run build && npm run start`.

In another terminal, after Strapi is running:

```bash
STRAPI_TOKEN=your-api-token node scripts/migrate-to-strapi.js
```

## Going live / turning Strapi off

To launch without Strapi (static HTML + settings.js only), omit the `data-strapi-url` attribute on the load-cms.js script tag in `index.html`. The site will use settings.js and leave all content as static HTML. When you are ready to use Strapi again, add `data-strapi-url="https://your-strapi-url.com"` (or `http://localhost:1337` for local dev) back to the script tag.
