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

async function loadIndex() {
  try {
    const res = await fetch('content.json');
    postsIndex = await res.json();
  } catch {
    postsIndex = [];
  }
  setPostsData(postsIndex);
  setSearchData(postsIndex);
  setHotkeyPosts(postsIndex);
}

function renderPostCard(post) {
  const tags = renderTagList(post.tags);
  return `<div class="post-card" onclick="location.hash='#/post/${post.slug}'">
    <div class="post-card-date">${post.date}</div>
    <h2 class="post-card-title">${post.title}</h2>
    ${post.description ? `<p class="post-card-desc">${post.description}</p>` : ''}
    ${tags ? `<div class="post-card-tags">${tags}</div>` : ''}
  </div>`;
}

// Route: Home
async function showHome() {
  clearToc();
  closeSearch();
  const content = document.getElementById('content');

  if (postsIndex.length === 0) {
    content.innerHTML = '<div class="empty-state"><p>No posts yet.</p></div>';
    return;
  }

  const sorted = [...postsIndex].sort((a, b) => b.date.localeCompare(a.date));
  content.innerHTML = `<div class="post-list">${sorted.map(renderPostCard).join('')}</div>`;
}

// Route: Post
async function showPost({ slug }) {
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
    const dateStr = meta.date || post.date;

    content.innerHTML = `
      <article class="article">
        <header class="article-header">
          <div class="article-meta">
            <time>${dateStr}</time>
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

    // Scroll to top
    window.scrollTo(0, 0);
  } catch (e) {
    content.innerHTML = `<div class="error-state"><h2>Failed to load post</h2><p>${e.message}</p><p><a href="#/">Go home</a></p></div>`;
    clearToc();
  }
}

// Route: Tag
async function showTag({ tag }) {
  clearToc();
  closeSearch();
  const content = document.getElementById('content');
  const decoded = decodeURIComponent(tag);
  const posts = getPostsByTag(decoded);

  if (posts.length === 0) {
    content.innerHTML = `<div class="empty-state"><h2>No posts tagged "${decoded}"</h2><p><a href="#/">Go home</a></p></div>`;
    return;
  }

  const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date));
  content.innerHTML = `
    <div class="tag-header">
      <h1>Posts tagged <span class="tag-highlight">${decoded}</span></h1>
      <span class="tag-count-label">${posts.length} post${posts.length === 1 ? '' : 's'}</span>
    </div>
    <div class="post-list">${sorted.map(renderPostCard).join('')}</div>
  `;
}

// Route: All Tags
async function showTags() {
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
}

// Initialize
async function init() {
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
