#!/usr/bin/env node
/**
 * Sync the website wiki (docs/wiki-content.js) to a Notion page.
 * Requires: NOTION_TOKEN and NOTION_WIKI_PAGE_ID in .env
 *
 * 1. In Notion, create a page (e.g. "VK Website Wiki")
 * 2. Share it with your integration (Settings → Connections → Add connection)
 * 3. Copy the page ID from the URL: notion.so/workspace/PAGE_ID?...
 * 4. Add NOTION_WIKI_PAGE_ID=<PAGE_ID> to .env
 * 5. Run: node scripts/sync-wiki-to-notion.js
 *
 * This replaces the page body with the wiki content from the repo.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Client } = require('@notionhq/client');
const config = require('../server/config');
const wikiContent = require('../docs/wiki-content');

const NOTION_MAX_RICH_TEXT_LEN = 2000;
const NOTION_APPEND_CHUNK = 100;

function richTextChunks(str) {
  const s = String(str || '');
  const out = [];
  for (let i = 0; i < s.length; i += NOTION_MAX_RICH_TEXT_LEN) {
    out.push({ type: 'text', text: { content: s.slice(i, i + NOTION_MAX_RICH_TEXT_LEN), link: null } });
  }
  return out.length ? out : [{ type: 'text', text: { content: ' ', link: null } }];
}

function toNotionBlock(item) {
  const type = item.type;
  const text = item.text != null ? String(item.text) : '';
  const richText = richTextChunks(text);

  if (type === 'heading_1') {
    return { type: 'heading_1', heading_1: { rich_text: richText, is_toggleable: false } };
  }
  if (type === 'heading_2') {
    return { type: 'heading_2', heading_2: { rich_text: richText, is_toggleable: false } };
  }
  if (type === 'heading_3') {
    return { type: 'heading_3', heading_3: { rich_text: richText, is_toggleable: false } };
  }
  if (type === 'paragraph') {
    return { type: 'paragraph', paragraph: { rich_text: richText } };
  }
  if (type === 'bulleted_list_item') {
    return { type: 'bulleted_list_item', bulleted_list_item: { rich_text: richText } };
  }
  if (type === 'code') {
    return { type: 'code', code: { rich_text: richText, language: item.language || 'plain text' } };
  }
  if (type === 'divider') {
    return { type: 'divider', divider: {} };
  }
  return { type: 'paragraph', paragraph: { rich_text: richText } };
}

async function getBlockChildren(client, blockId) {
  const all = [];
  let cursor;
  do {
    const res = await client.blocks.children.list({ block_id: blockId, start_cursor: cursor, page_size: 100 });
    all.push(...res.results);
    cursor = res.next_cursor;
  } while (cursor);
  return all;
}

async function main() {
  const token = config.NOTION_TOKEN || process.env.NOTION_TOKEN;
  const pageId = config.NOTION_WIKI_PAGE_ID || process.env.NOTION_WIKI_PAGE_ID;

  if (!token || !pageId) {
    console.error('Missing NOTION_TOKEN or NOTION_WIKI_PAGE_ID.');
    console.error('');
    console.error('Setup:');
    console.error('  1. In Notion, create a page (e.g. "VK Website Wiki").');
    console.error('  2. Share it with your integration (page ⋮ → Connections → Add).');
    console.error('  3. Copy the page ID from the URL (the 32-char part before ?).');
    console.error('  4. In .env set: NOTION_WIKI_PAGE_ID=<that-id>');
    console.error('  5. Run: node scripts/sync-wiki-to-notion.js');
    process.exit(1);
  }

  const client = new Client({ auth: token });
  const blocks = wikiContent.map(toNotionBlock);

  console.log('Fetching existing blocks on wiki page...');
  const existing = await getBlockChildren(client, pageId);
  console.log('Deleting', existing.length, 'existing blocks...');
  for (const block of existing) {
    await client.blocks.update({ block_id: block.id, archived: true });
  }

  console.log('Appending', blocks.length, 'wiki blocks...');
  for (let i = 0; i < blocks.length; i += NOTION_APPEND_CHUNK) {
    const chunk = blocks.slice(i, i + NOTION_APPEND_CHUNK);
    await client.blocks.children.append({ block_id: pageId, children: chunk });
  }

  console.log('Done. Wiki page updated.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
