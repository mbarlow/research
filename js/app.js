// Entry point — init and wire everything up

import { addRoute, initRouter } from './router.js';
import { initTheme } from './theme.js';
import { parseFrontmatter, renderMarkdown, enhance, extractHeadings } from './renderer.js';
import { initNav, updateThemeIcon } from './components/nav.js';
import { renderToc, clearToc } from './components/toc.js';
import { setPostsData, getAllTags, getPostsByTag, renderTagCloud, renderTagList } from './components/tags.js';
import { initSteps } from './components/steps.js';
import { setSearchData, initSearch, closeSearch } from './search.js';
import { initHotkeys, setHotkeyPosts } from './hotkeys.js';
import { initMedia, initLightbox } from './media.js';

let postsIndex = [];

function scrollTopNow() {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

function stabilizeScrollTop() {
  scrollTopNow();
  requestAnimationFrame(scrollTopNow);
  setTimeout(scrollTopNow, 0);
  setTimeout(scrollTopNow, 120);
  setTimeout(scrollTopNow, 360);
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

  return String(a.title).localeCompare(String(b.title));
}

function formatTime(timestamp) {
  const dt = new Date(timestamp || '');
  if (!Number.isFinite(dt.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(dt);
}

function formatPostDateTime(post, overrideDate) {
  const datePart = overrideDate || post.date || '';
  const timePart = formatTime(post.timestamp);
  if (!datePart) return timePart;
  return timePart ? `${datePart} · ${timePart}` : datePart;
}

function getTimeAttrValue(post, overrideDate) {
  const fromTimestamp = new Date(post.timestamp || '');
  if (Number.isFinite(fromTimestamp.getTime())) return fromTimestamp.toISOString();
  if (overrideDate || post.date) return `${overrideDate || post.date}T00:00:00Z`;
  return '';
}

async function loadIndex() {
  try {
    const res = await fetch('content.json');
    postsIndex = await res.json();
  } catch {
    postsIndex = [];
  }
  postsIndex = [...postsIndex].sort(sortPosts);
  setPostsData(postsIndex);
  setSearchData(postsIndex);
  setHotkeyPosts(postsIndex);
}

function renderPostCard(post) {
  const tags = renderTagList(post.tags);
  const dateTime = formatPostDateTime(post);
  return `<div class="post-card" onclick="location.hash='#/post/${post.slug}'">
    <div class="post-card-date">${dateTime}</div>
    <h2 class="post-card-title">${post.title}</h2>
    ${post.description ? `<p class="post-card-desc">${post.description}</p>` : ''}
    ${tags ? `<div class="post-card-tags">${tags}</div>` : ''}
  </div>`;
}

// Route: Home
async function showHome() {
  stabilizeScrollTop();
  clearToc();
  closeSearch();
  const content = document.getElementById('content');

  if (postsIndex.length === 0) {
    content.innerHTML = '<div class="empty-state"><p>No posts yet.</p></div>';
    return;
  }

  const sorted = [...postsIndex].sort(sortPosts);
  content.innerHTML = `<div class="post-list">${sorted.map(renderPostCard).join('')}</div>`;
  stabilizeScrollTop();
}

// Route: Post
async function showPost({ slug }) {
  stabilizeScrollTop();
  closeSearch();
  const content = document.getElementById('content');
  const post = postsIndex.find(p => p.slug === slug);

  if (!post) {
    content.innerHTML = '<div class="error-state"><h2>Post not found</h2><p><a href="#/">Go home</a></p></div>';
    clearToc();
    return;
  }

  content.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const res = await fetch(`posts/${post.file}`);
    const md = await res.text();
    const { meta, body } = parseFrontmatter(md);
    const html = renderMarkdown(body);

    const tags = renderTagList(meta.tags || post.tags);
    const dateStr = formatPostDateTime(post, meta.date || post.date);
    const dateAttr = getTimeAttrValue(post, meta.date || post.date);

    content.innerHTML = `
      <article class="article">
        <header class="article-header">
          <div class="article-meta">
            <time datetime="${dateAttr}">${dateStr}</time>
            ${tags ? `<div class="article-tags">${tags}</div>` : ''}
          </div>
          <h1 class="article-title">${meta.title || post.title}</h1>
          ${meta.description ? `<p class="article-description">${meta.description}</p>` : ''}
        </header>
        <div class="article-body">${html}</div>
      </article>
      <footer class="article-footer">
        <a href="#/" class="back-link">&larr; All posts</a>
      </footer>
    `;

    // Enhance: Prism, Mermaid, Three.js, etc.
    await enhance(content);

    // TOC
    const headings = extractHeadings(content);
    renderToc(headings);

    // Steps
    initSteps(content);

    // Media
    initMedia(content);

    // Ensure route starts at top even after async renders/layout changes.
    stabilizeScrollTop();
  } catch (e) {
    content.innerHTML = `<div class="error-state"><h2>Failed to load post</h2><p>${e.message}</p><p><a href="#/">Go home</a></p></div>`;
    clearToc();
  }
}

// Route: Tag
async function showTag({ tag }) {
  stabilizeScrollTop();
  clearToc();
  closeSearch();
  const content = document.getElementById('content');
  const decoded = decodeURIComponent(tag);
  const posts = getPostsByTag(decoded);

  if (posts.length === 0) {
    content.innerHTML = `<div class="empty-state"><h2>No posts tagged "${decoded}"</h2><p><a href="#/">Go home</a></p></div>`;
    return;
  }

  const sorted = [...posts].sort(sortPosts);
  content.innerHTML = `
    <div class="tag-header">
      <h1>Posts tagged <span class="tag-highlight">${decoded}</span></h1>
      <span class="tag-count-label">${posts.length} post${posts.length === 1 ? '' : 's'}</span>
    </div>
    <div class="post-list">${sorted.map(renderPostCard).join('')}</div>
  `;
  stabilizeScrollTop();
}

// Route: All Tags
async function showTags() {
  stabilizeScrollTop();
  clearToc();
  closeSearch();
  const content = document.getElementById('content');
  const tags = getAllTags();

  if (tags.length === 0) {
    content.innerHTML = '<div class="empty-state"><h2>No tags yet</h2><p><a href="#/">Go home</a></p></div>';
    return;
  }

  content.innerHTML = `
    <div class="tags-page">
      <h1>All Tags</h1>
      <div class="tag-cloud">${renderTagCloud(tags)}</div>
    </div>
  `;
  stabilizeScrollTop();
}

// Initialize
async function init() {
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  initTheme();
  initNav();
  initLightbox();
  initSearch();
  initHotkeys();

  await loadIndex();

  addRoute('/', showHome);
  addRoute(/^\/post\/(?<slug>.+)$/, showPost);
  addRoute(/^\/tag\/(?<tag>.+)$/, showTag);
  addRoute('/tags', showTags);

  initRouter();
}

init();
