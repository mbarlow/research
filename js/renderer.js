// Markdown rendering pipeline
// frontmatter → marked → enhance (Prism, Mermaid, Three.js, etc.)

import { marked } from 'marked';

// Parse YAML-like frontmatter from markdown
export function parseFrontmatter(text) {
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

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderCalloutIcon(type) {
  const icons = {
    note: `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6.25"></circle>
      <line x1="8" y1="7" x2="8" y2="11"></line>
      <circle class="callout-icon-fill" cx="8" cy="4.8" r="0.9"></circle>
    </svg>`,
    warning: `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M8 2.5L14 13H2L8 2.5Z"></path>
      <line x1="8" y1="6" x2="8" y2="9.6"></line>
      <circle class="callout-icon-fill" cx="8" cy="11.5" r="0.85"></circle>
    </svg>`,
    tip: `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M8 2.7A4.05 4.05 0 0 0 5.5 9.9c.4.33.68.73.8 1.2h3.4c.12-.47.4-.87.8-1.2A4.05 4.05 0 0 0 8 2.7Z"></path>
      <line x1="6.1" y1="12.35" x2="9.9" y2="12.35"></line>
      <line x1="6.6" y1="13.8" x2="9.4" y2="13.8"></line>
    </svg>`,
    danger: `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M5 1.8h6l3.2 3.2v6L11 14.2H5L1.8 11V5L5 1.8Z"></path>
      <line x1="8" y1="4.7" x2="8" y2="9.2"></line>
      <circle class="callout-icon-fill" cx="8" cy="11.4" r="0.85"></circle>
    </svg>`,
  };
  return icons[type] || icons.note;
}

function renderChat(text) {
  const lines = text.split('\n');
  let messages = [];
  let current = null;

  for (const line of lines) {
    const roleMatch = line.match(/^(user|assistant|system):\s*(.*)/i);
    if (roleMatch) {
      if (current) messages.push(current);
      current = { role: roleMatch[1].toLowerCase(), text: roleMatch[2] };
    } else if (current) {
      current.text += '\n' + line;
    }
  }
  if (current) messages.push(current);

  const html = messages.map(m => {
    const roleLabel = m.role.charAt(0).toUpperCase() + m.role.slice(1);
    return `<div class="chat-message chat-${m.role}">
      <div class="chat-role">${roleLabel}</div>
      <div class="chat-text">${marked.parse(m.text.trim())}</div>
    </div>`;
  }).join('');

  return `<div class="chat-block">${html}</div>`;
}

function renderSteps(text) {
  const steps = text.split(/^###\s+/gm).filter(Boolean);
  const html = steps.map((step, i) => {
    const lines = step.trim().split('\n');
    const title = lines[0];
    const body = lines.slice(1).join('\n').trim();
    return `<div class="step" data-step="${i + 1}">
      <div class="step-header">
        <span class="step-number">${i + 1}</span>
        <span class="step-title">${title}</span>
        <span class="step-toggle">+</span>
      </div>
      <div class="step-body">${marked.parse(body)}</div>
    </div>`;
  }).join('');

  return `<div class="steps-block" data-total="${steps.length}">
    <div class="steps-progress"><div class="steps-progress-bar"></div></div>
    ${html}
  </div>`;
}

// Configure marked with v12 positional-args API
const renderer = {
  // heading(text, level, raw)
  heading(text, level) {
    const id = text.replace(/<[^>]*>/g, '').toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
    return `<h${level} id="${id}"><a class="heading-anchor" href="#${id}">#</a>${text}</h${level}>`;
  },

  // image(href, title, text)
  image(href, title, text) {
    let sizeClass = '';
    let cleanAlt = text || '';
    if (cleanAlt.includes('|wide')) {
      sizeClass = ' class="media-wide"';
      cleanAlt = cleanAlt.replace('|wide', '').trim();
    } else if (cleanAlt.includes('|narrow')) {
      sizeClass = ' class="media-narrow"';
      cleanAlt = cleanAlt.replace('|narrow', '').trim();
    }

    const ext = href.split('.').pop().toLowerCase();
    if (['mp4', 'webm', 'ogg'].includes(ext)) {
      return `<div${sizeClass}><video controls preload="none" data-lazy-video="${href}">
        <source src="${href}" type="video/${ext}">
      </video>${title ? `<figcaption>${title}</figcaption>` : ''}</div>`;
    }

    const caption = title ? `<figcaption>${title}</figcaption>` : '';
    return `<figure${sizeClass}><img src="${href}" alt="${cleanAlt}" loading="lazy" data-lightbox>${caption}</figure>`;
  },

  // code(code, infostring, escaped)
  code(code, infostring) {
    const lang = (infostring || '').match(/^\S*/)?.[0];
    if (lang === 'mermaid') {
      return `<div class="mermaid-block" data-mermaid>${escapeHtml(code)}</div>`;
    }
    if (lang === 'chat') {
      return renderChat(code);
    }
    if (lang === 'steps') {
      return renderSteps(code);
    }
    const langClass = lang ? ` class="language-${lang}"` : '';
    return `<pre><code${langClass}>${escapeHtml(code)}</code></pre>`;
  },

  // blockquote(quote)
  blockquote(quote) {
    const calloutMatch = quote.match(/^\s*<p>\[!(note|warning|tip|danger)\]\s*/i);
    if (calloutMatch) {
      const type = calloutMatch[1].toLowerCase();
      const labels = { note: 'Note', warning: 'Warning', tip: 'Tip', danger: 'Danger' };
      const content = quote.replace(calloutMatch[0], '<p>');
      return `<div class="callout callout-${type}">
        <div class="callout-title"><span class="callout-icon">${renderCalloutIcon(type)}</span> ${labels[type]}</div>
        <div class="callout-content">${content}</div>
      </div>`;
    }
    return `<blockquote>${quote}</blockquote>`;
  },
};

marked.use({ gfm: true, breaks: false, renderer });

export function renderMarkdown(md) {
  return marked.parse(md);
}

// Post-processing: Prism, Mermaid, Three.js, media
export async function enhance(container) {
  // Prism syntax highlighting
  container.querySelectorAll('pre code[class*="language-"]').forEach(el => {
    Prism.highlightElement(el);
  });

  // Mermaid diagrams
  const mermaidBlocks = container.querySelectorAll('[data-mermaid]');
  if (mermaidBlocks.length > 0) {
    try {
      const { default: mermaid } = await import('mermaid');
      mermaid.initialize({
        startOnLoad: false,
        theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default',
        fontFamily: 'var(--font-body)',
      });
      for (let i = 0; i < mermaidBlocks.length; i++) {
        const el = mermaidBlocks[i];
        const code = el.textContent;
        const id = `mermaid-${Date.now()}-${i}`;
        try {
          const { svg } = await mermaid.render(id, code);
          el.innerHTML = svg;
          el.classList.add('mermaid-rendered');
        } catch (e) {
          el.innerHTML = `<pre><code>${escapeHtml(code)}</code></pre>`;
          el.classList.remove('mermaid-rendered');
          console.warn('Mermaid block failed to render:', e);
        }
      }
    } catch (e) {
      console.warn('Mermaid rendering failed:', e);
    }
  }

  // Three.js scene embeds
  const sceneBlocks = container.querySelectorAll('[data-scene]');
  for (const el of sceneBlocks) {
    const src = el.getAttribute('data-scene');
    try {
      const canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      el.appendChild(canvas);
      el.classList.add('scene-container');
      const module = await import(`../scenes/${src}`);
      if (module.init) {
        const cleanup = module.init(canvas, el);
        if (cleanup) {
          const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
              for (const node of m.removedNodes) {
                if (node === el || node.contains?.(el)) {
                  cleanup();
                  observer.disconnect();
                }
              }
            }
          });
          observer.observe(el.parentElement || document.body, { childList: true, subtree: true });
        }
      }
    } catch (e) {
      el.innerHTML = `<div class="scene-error">Scene failed to load: ${src}</div>`;
      console.warn('Scene load failed:', e);
    }
  }

  // Lazy video loading
  container.querySelectorAll('[data-lazy-video]').forEach(video => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        video.preload = 'metadata';
        observer.disconnect();
      }
    }, { threshold: 0.1 });
    observer.observe(video);
  });
}

// Extract headings for TOC
export function extractHeadings(container) {
  const headings = [];
  container.querySelectorAll('h2, h3, h4').forEach(el => {
    headings.push({
      id: el.id,
      text: el.textContent.replace(/^#\s*/, ''),
      level: parseInt(el.tagName[1]),
    });
  });
  return headings;
}
