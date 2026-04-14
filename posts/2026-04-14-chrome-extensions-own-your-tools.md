---
title: Own Your Tools — Three Chrome Extensions, No Store Required
date: 2026-04-14
order: 41
description: Three small MIT-licensed Chrome extensions — pretty-json, recorder, snapshot — built to be installed as unpacked Developer Mode extensions. No store. No telemetry. Your data stays local.
tags: [chrome, extensions, tooling, privacy, open-source, javascript]
---

## Why unpacked

Chrome extensions don't have to come from the Web Store.

`chrome://extensions` → Developer Mode → Load unpacked. Point at a directory. Done.

That one path is the whole argument for this post.

## What the Store costs you

- **Review queue** — days to weeks between code and installed bits
- **Permission theater** — store-distributed extensions prompt for permissions up front, encouraging over-broad manifests
- **Telemetry surface** — many Store extensions phone home. Ad blockers that watch you. Theme packs that ship analytics.
- **Attack surface via sale** — popular extensions get bought and quietly repurposed into tracking or injection. Well-documented pattern.
- **Lock-in** — deleted from the store = your workflow breaks

Load unpacked:

```
No review
No telemetry (you can read the code)
No account required
No account to delete
Your data never leaves the machine
```

Three extensions below. All MIT. All unpacked. All under 500 lines each.

## Pretty JSON

Formats and syntax-highlights JSON responses automatically.

<figure>
  <img src="media/chrome-ext/pretty-json.png" alt="Chrome Pretty JSON screenshot" style="width:100%;height:auto;">
</figure>

Open any URL that returns JSON. Extension detects it. Renders with line numbers and syntax highlighting. Click the icon to switch themes.

**Six built-in themes:**

- Gruvbox Dark
- Catppuccin Dark
- GitHub
- VS Code Dark
- Monokai
- Dracula

Theme preference is stored in `chrome.storage.local`. No server. No sync. Your theme choice stays on your machine.

**Install:**

```bash
git clone git@github.com:mbarlow/chrome-pretty-json.git
# Or grab a zip from the releases page
```

```
1. chrome://extensions
2. Enable Developer Mode (top-right toggle)
3. "Load unpacked" → pick the cloned directory
```

Repo: [github.com/mbarlow/chrome-pretty-json](https://github.com/mbarlow/chrome-pretty-json)

## Recorder

One-click screen and tab recording using Chrome's native `getDisplayMedia()` API.

<figure>
  <video controls preload="metadata" style="width:100%;height:auto;">
    <source src="media/chrome-ext/recorder.webm" type="video/webm">
  </video>
</figure>

No FFmpeg. No native host. No download of a helper app. Chrome already has the machinery — the extension just exposes it.

**Three capture modes, all native Chrome:**

- **Tab** — just the active tab, with audio
- **Window** — a whole Chrome window
- **Entire screen** — desktop capture, same API that Meet and Teams use for screen share

Output: WebM straight to your Downloads folder. No intermediate service. No upload.

**The recording indicator** is a draggable floating element injected into the page. Click it to stop. No chasing a toolbar icon while recording.

**Install:**

```bash
git clone git@github.com:mbarlow/chrome-recorder.git
```

Then same three-step load-unpacked dance.

**Why it matters:** screen recorders that ship compiled binaries are an enormous privacy surface. Every frame passes through code you can't audit. This one is ~300 lines of JS using a documented browser API. You can read all of it in ten minutes.

Repo: [github.com/mbarlow/chrome-recorder](https://github.com/mbarlow/chrome-recorder)

## Snapshot

Drag-select any region of a page, save as PNG, optionally annotate with highlights.

<figure>
  <img src="media/chrome-ext/snapshot.png" alt="Chrome Snapshot screenshot" style="width:100%;height:auto;">
</figure>

Click and drag. Visual guides show the selection rectangle and coordinates live. Release to capture.

**What makes it different from built-in screenshot tools:**

- **Colored highlight annotations** — draw attention boxes before saving
- **Clipboard or PNG** — paste directly into Slack/Linear, or save as a file
- **Right-click context menu integration** — no popup, no modal
- **Esc to cancel** — no commitment to the drag

Shortcut: `Ctrl+Shift+S` (Mac: `Cmd+Shift+S`).

Saved PNGs are plain files. No watermark. No upload. No account.

**Install:**

```bash
git clone git@github.com:mbarlow/chrome-snapshot.git
```

Load unpacked.

Repo: [github.com/mbarlow/chrome-snapshot](https://github.com/mbarlow/chrome-snapshot)

## Manifest V3, briefly

All three use Manifest V3 — the current extension spec. Translating the privacy story to concrete manifest permissions:

| Extension | Permissions | Why |
|---|---|---|
| pretty-json | `storage`, `activeTab` | Save theme choice; run on the current tab |
| recorder | `tabCapture`, `desktopCapture`, `downloads`, `offscreen` | Native capture APIs + save |
| snapshot | `activeTab`, `storage`, `contextMenus` | Draw overlay; save settings; right-click menu |

No `<all_urls>`. No `webRequest`. No `cookies`. No network origins outside the page you're actively using.

## The workflow

```
Developer Mode on (once, ever)
Clone each repo into ~/src/extensions/
Load unpacked → ~/src/extensions/chrome-pretty-json
Load unpacked → ~/src/extensions/chrome-recorder
Load unpacked → ~/src/extensions/chrome-snapshot
```

Update = `git pull` + reload the extension. No store approval. No breaking change a vendor decided for you.

## The summary

Three small, MIT-licensed, audit-in-a-sitting Chrome extensions.

- **pretty-json** — themed JSON formatter, six palettes
- **recorder** — native Chrome capture, tab/window/screen, WebM out
- **snapshot** — drag-select, highlight, save PNG or clipboard

All load unpacked. All run locally. No store, no telemetry, no account.

Own your tools.
