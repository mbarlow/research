---
title: Save the Session — bsm, csm, vt for LLM Work Across Projects
date: 2026-04-14
order: 42
description: Three small skills for persisting work session state when you juggle multiple LLM-assisted projects — byobu layouts, Chrome debug tabs, and graceful VT escapes when the compositor dies.
tags: [tooling, claude-code, byobu, chrome, linux, macos, workflow, skills]
---

## The problem

Working with LLMs across several projects multiplies context.

Each project wants its own terminal layout, its own running dev servers, its own open browser tabs, its own Claude Code session. A laptop reboot, a compositor crash, or a screenlock freeze shouldn't burn twenty minutes of re-assembly.

The state is recoverable. The trick is writing it down before you lose it.

```
Current windows     → JSON
Current tabs        → JSON
Current TTY         → one command away
```

Three small skills. Each one does exactly one thing. All three ship a `SKILL.md` so Claude Code can drive them for you.

Repo: [github.com/mbarlow/skills](https://github.com/mbarlow/skills)

## The concept

A work session is three layers:

| Layer | What it holds | Where it lives |
|---|---|---|
| Terminal | windows, cwd, running commands | byobu |
| Browser | open tab URLs | Chrome (via DevTools) |
| Display | which TTY you're looking at | kernel VT layer |

Save each layer to JSON, reload from JSON. Name the saved sets. Keep them in `~/.config/`.

Nothing clever. The value is in having named configs and a single verb — `save`, `load` — per layer.

## bsm — byobu session manager

`bsm` snapshots a byobu session to a JSON file: window indexes, titles, working directories, and the command each pane is running.

```bash
bsm save dev       # snapshot current session as "dev"
bsm list           # show all saved configs
bsm load dev       # kill current, restore "dev"
bsm shutdown       # graceful exit (offers to save first)
```

On load it recreates the session with `byobu new-session`, adds each window, `cd`s into the saved directory, and replays the captured command via `send-keys`.

It captures windows, not pane splits. The simpler contract is on purpose — pane geometry is rarely what you actually need to restore. Cwd + running command is.

Config:

```json
{
  "name": "dev",
  "windows": [
    {"index": 0, "name": "CLAUDE",   "directory": "~/git/…/mbarlow",       "command": "claude"},
    {"index": 1, "name": "SONGNOOK", "directory": "~/git/…/songnook",      "command": "make dev"}
  ]
}
```

Captured command comes from `/proc/<pid>/cmdline` of the pane's first child. Empty for idle shells — that's fine.

Works on Linux and macOS. Dependencies: `byobu`, `jq`, `bash` 4+.

Repo: [github.com/mbarlow/skills/tree/main/bsm](https://github.com/mbarlow/skills/tree/main/bsm)

## csm — chrome session manager

Same shape as `bsm`, but for browser tabs.

```bash
csm start          # launch debug-mode Chrome
# … open tabs …
csm save research  # snapshot
csm stop           # close browser
# … later …
csm load research  # reopen every saved tab in one window
```

Mechanism: Chrome exposes a remote-debugging endpoint at `http://localhost:9222/json` when launched with `--remote-debugging-port=9222`. `csm save` curls that endpoint, filters to `type == "page"`, and writes the URL list. `csm load` relaunches Chrome with every saved URL on the command line.

Only URLs restore. Not form state, scroll position, or SPA-internal routes. That's the whole point — the stored thing is small, text, diffable.

`csm` uses a dedicated `--user-data-dir` so the debug Chrome is separate from your daily browser. Chrome 147+ refuses the debug port on the default profile anyway.

Works on Linux and macOS. Dependencies: any Chromium-based browser, `curl`, `jq`.

Roadmap: pairing with `bsm` so one config restores both a terminal layout and its associated tabs.

Repo: [github.com/mbarlow/skills/tree/main/csm](https://github.com/mbarlow/skills/tree/main/csm)

## vt — graceful VT switching on Linux

This one is Linux-only and exists for a specific failure mode.

Hyprland (or any Wayland compositor) crashes, or screenlock wedges, while a byobu session is mid-work. The graphical session is stuck. You want a bare TTY to kill the compositor, check logs, or just get back to the shell without losing `bsm`-tracked work.

`Ctrl+Alt+F1…F6` are kernel VT switch chords. From inside Wayland, userspace key injectors (`wtype`, `hyprctl dispatch`, `xdotool`) can't trigger them — the events never reach the kernel VT layer. The real tool is `chvt`, which calls `VT_ACTIVATE`.

`chvt` needs `CAP_SYS_TTY_CONFIG`. Normal users don't have it. Options:

| Approach | Verdict |
|---|---|
| Add user to `tty` group | **Doesn't work** — only device access, not VT switch |
| `setcap` on `/usr/bin/chvt` | Works, wiped on every `kbd` upgrade |
| NOPASSWD sudoers rule for `chvt` | Works, survives upgrades, narrow blast radius |
| Setuid wrapper | More moving parts than needed |

`vt` picks the sudoers rule. The installer stages a snippet, validates with `visudo -c`, and installs exactly:

```
<user> ALL=(root) NOPASSWD: /usr/bin/chvt
```

One binary, passwordless, for this user only.

After install:

```bash
vt 3     # jump to TTY3
vt 1     # back to the graphical session
```

When Hyprland locks up: `vt 3`, log in, `pkill -9 Hyprland` (or whatever), `vt 1`. Byobu session is still running. `bsm` layout is intact. Browser tabs are still there under `csm`.

Linux-only by definition — macOS has no equivalent VT layer.

Repo: [github.com/mbarlow/skills/tree/main/vt](https://github.com/mbarlow/skills/tree/main/vt)

## The stack, working together

```
bsm  → terminal layout  (Linux + macOS)
csm  → browser tabs     (Linux + macOS)
vt   → escape hatch     (Linux only)
```

The LLM angle is not the tools themselves. It's that each one ships a `SKILL.md` — a Claude Code skill definition — so Claude can invoke them on your behalf:

> "save my current session as songnook-dev"
> "what chrome sessions do I have saved?"
> "load my research tabs"

Claude reads intent, runs the non-destructive commands, and defers interactive ones back to you. The skill files are symlinked from the repo into `~/.claude/skills/<name>/` at install, so edits in the repo take effect immediately.

## The rules

```
One verb per layer (save, load, list)
JSON configs in ~/.config/
Symlinked skill files, not copied
Interactive commands prompt, non-interactive ones don't
No config is tracked in the repo — that's personal state
```

Small tools. Text on disk. Named sets. The session survives the crash.

Repo: [github.com/mbarlow/skills](https://github.com/mbarlow/skills)
