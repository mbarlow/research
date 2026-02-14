# Research

Private technical research blog. Vanilla JS SPA, markdown-driven, deployed to GitHub Pages.

## Local Development

```bash
bunx serve
```

## Adding Posts

Create a markdown file in `posts/` with YAML frontmatter:

```markdown
---
title: Post Title
date: 2026-02-14
description: Brief description
tags: [tag1, tag2]
---

Your content here...
```

## Building

```bash
node scripts/build-index.js
```

This generates `content.json` and `feed.xml`. The GitHub Action runs this automatically on push.
