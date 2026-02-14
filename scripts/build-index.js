#!/usr/bin/env node
// Reads all posts/*.md, extracts frontmatter, writes content.json + feed.xml

import { readdir, readFile, stat, writeFile } from 'fs/promises';
import { join } from 'path';

const POSTS_DIR = join(process.cwd(), 'posts');
const SITE_URL = 'https://mbarlow.github.io/research';
const SITE_TITLE = 'Research';

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: text };
  const meta = {};
  match[1].split('\n').forEach(line => {
    const idx = line.indexOf(':');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
    }
    meta[key] = val;
  });
  return { meta, body: match[2] };
}

function parseOrder(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sortPosts(a, b) {
  const aTs = Date.parse(a.timestamp || '');
  const bTs = Date.parse(b.timestamp || '');
  const byTimestamp = (Number.isFinite(bTs) ? bTs : 0) - (Number.isFinite(aTs) ? aTs : 0);
  if (byTimestamp !== 0) return byTimestamp;

  const byDate = String(b.date).localeCompare(String(a.date));
  if (byDate !== 0) return byDate;

  const aOrder = Number.isFinite(a.order) ? a.order : Number.POSITIVE_INFINITY;
  const bOrder = Number.isFinite(b.order) ? b.order : Number.POSITIVE_INFINITY;
  if (aOrder !== bOrder) return aOrder - bOrder;

  return a.title.localeCompare(b.title);
}

function getFileTimestamp(fileStats) {
  const birthMs = Number(fileStats.birthtimeMs);
  const modifiedMs = Number(fileStats.mtimeMs);
  const tsMs = Number.isFinite(birthMs) && birthMs > 0 ? birthMs : modifiedMs;
  return new Date(tsMs).toISOString();
}

async function build() {
  const files = (await readdir(POSTS_DIR)).filter(f => f.endsWith('.md'));
  const posts = [];

  for (const file of files) {
    const fullPath = join(POSTS_DIR, file);
    const content = await readFile(fullPath, 'utf-8');
    const fileStats = await stat(fullPath);
    const { meta, body } = parseFrontmatter(content);
    const slug = file.replace(/\.md$/, '');

    posts.push({
      slug,
      file,
      title: meta.title || slug,
      date: meta.date || slug.slice(0, 10),
      timestamp: getFileTimestamp(fileStats),
      order: parseOrder(meta.order),
      description: meta.description || '',
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      body: body.slice(0, 500), // excerpt for search
    });
  }

  posts.sort(sortPosts);

  // Write content.json
  await writeFile(join(process.cwd(), 'content.json'), JSON.stringify(posts, null, 2));
  console.log(`Built content.json with ${posts.length} posts`);

  // Write feed.xml (Atom)
  const now = new Date().toISOString();
  const entries = posts.slice(0, 20).map(p => `
  <entry>
    <title>${escapeXml(p.title)}</title>
    <link href="${SITE_URL}/#/post/${p.slug}" rel="alternate"/>
    <id>${SITE_URL}/#/post/${p.slug}</id>
    <updated>${p.timestamp || `${p.date}T00:00:00Z`}</updated>
    <summary>${escapeXml(p.description)}</summary>
  </entry>`).join('');

  const feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${SITE_TITLE}</title>
  <link href="${SITE_URL}" rel="alternate"/>
  <link href="${SITE_URL}/feed.xml" rel="self"/>
  <id>${SITE_URL}/</id>
  <updated>${now}</updated>${entries}
</feed>`;

  await writeFile(join(process.cwd(), 'feed.xml'), feed);
  console.log('Built feed.xml');
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

build().catch(e => {
  console.error('Build failed:', e);
  process.exit(1);
});
