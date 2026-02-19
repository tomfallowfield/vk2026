#!/usr/bin/env node
/**
 * Sync the website wiki (docs/wiki-content.js) to Notion.
 * Requires: NOTION_TOKEN and NOTION_WIKI_PAGE_ID in .env
 *
 * Default: add-only, no overwrites. Existing content in Notion is never removed.
 * - Root: intro blocks are appended only when the root page is empty.
 * - Child pages: created and filled only when missing; existing pages are left as-is.
 * Use --force to replace all wiki content from the repo (overwrites Notion edits).
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Client } = require('@notionhq/client');
const config = require('../server/config');
const wikiContent = require('../docs/wiki-content');

const NOTION_MAX_RICH_TEXT_LEN = 2000;
const NOTION_APPEND_CHUNK = 100;

const force = process.argv.includes('--force');

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

async function setPageContent(client, pageId, blocks) {
  const notionBlocks = blocks.map(toNotionBlock);
  const existing = await getBlockChildren(client, pageId);
  for (const block of existing) {
    await client.blocks.update({ block_id: block.id, archived: true });
  }
  for (let i = 0; i < notionBlocks.length; i += NOTION_APPEND_CHUNK) {
    const chunk = notionBlocks.slice(i, i + NOTION_APPEND_CHUNK);
    await client.blocks.children.append({ block_id: pageId, children: chunk });
  }
}

async function appendPageContent(client, pageId, blocks) {
  const notionBlocks = blocks.map(toNotionBlock);
  for (let i = 0; i < notionBlocks.length; i += NOTION_APPEND_CHUNK) {
    const chunk = notionBlocks.slice(i, i + NOTION_APPEND_CHUNK);
    await client.blocks.children.append({ block_id: pageId, children: chunk });
  }
}

async function main() {
  const token = config.NOTION_TOKEN || process.env.NOTION_TOKEN;
  const rootId = config.NOTION_WIKI_PAGE_ID || process.env.NOTION_WIKI_PAGE_ID;

  if (!token || !rootId) {
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
  const { rootBlocks, pages } = wikiContent;

  const rootChildren = await getBlockChildren(client, rootId);
  const childPageIds = new Map();
  const rootNonChildBlocks = [];

  for (const block of rootChildren) {
    if (block.type === 'child_page' && block.child_page && block.child_page.title) {
      childPageIds.set(block.child_page.title, block.id);
    } else {
      rootNonChildBlocks.push(block);
    }
  }

  if (force) {
    // Overwrite: remove non–child_page blocks on root, then append intro
    for (const block of rootNonChildBlocks) {
      await client.blocks.update({ block_id: block.id, archived: true });
    }
    const rootNotionBlocks = rootBlocks.map(toNotionBlock);
    for (let i = 0; i < rootNotionBlocks.length; i += NOTION_APPEND_CHUNK) {
      const chunk = rootNotionBlocks.slice(i, i + NOTION_APPEND_CHUNK);
      await client.blocks.children.append({ block_id: rootId, children: chunk });
    }
    console.log('Root: intro blocks replaced (--force).');
  } else {
    // Add-only: append intro only when root has no other content
    if (rootNonChildBlocks.length === 0) {
      const rootNotionBlocks = rootBlocks.map(toNotionBlock);
      for (let i = 0; i < rootNotionBlocks.length; i += NOTION_APPEND_CHUNK) {
        const chunk = rootNotionBlocks.slice(i, i + NOTION_APPEND_CHUNK);
        await client.blocks.children.append({ block_id: rootId, children: chunk });
      }
      console.log('Root: intro blocks appended (empty root).');
    } else {
      console.log('Root: left unchanged (already has content).');
    }
  }

  for (const page of pages) {
    let pageId = childPageIds.get(page.title);
    if (!pageId) {
      const created = await client.pages.create({
        parent: { page_id: rootId },
        properties: {
          title: {
            title: [{ text: { content: page.title.slice(0, 2000) } }],
          },
        },
      });
      pageId = created.id;
      childPageIds.set(page.title, pageId);
      await appendPageContent(client, pageId, page.blocks);
      console.log('Created:', page.title);
      continue;
    }
    if (force) {
      await setPageContent(client, pageId, page.blocks);
      console.log('Updated:', page.title);
    } else {
      const existing = await getBlockChildren(client, pageId);
      if (existing.length === 0) {
        await appendPageContent(client, pageId, page.blocks);
        console.log('Filled (was empty):', page.title);
      } else {
        console.log('Skipped (has content):', page.title);
      }
    }
  }

  console.log('Done.', force ? 'Wiki overwritten from repo (--force).' : 'Add-only sync; existing content preserved.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
