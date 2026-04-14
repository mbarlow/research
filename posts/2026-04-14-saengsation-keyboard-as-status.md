---
title: Saengsation — The Keyboard as System Status
date: 2026-04-14
order: 40
description: A Go-only RGB LED controller for the Keychron V7 that mirrors what Claude Code is doing — waiting, acknowledged, working, idle — via keyboard lighting.
tags: [go, keychron, rgb, hid, qmk, claude-code, linux, tooling]
---

<figure class="media-wide">
  <img src="media/saengsation/keys.jpg" alt="Keychron V7 under saengsation">
</figure>

## The idea

Peripheral status is ambient data. The keyboard is already in your field of view. Use it.

`saengsation` turns the Keychron V7 into a status indicator. Claude is waiting for input → the keys glow red. I hit enter → green breathing fade. Claude starts thinking → rainbow spiral. Claude stops → dim blue pulse.

No alt-tab. No terminal glance. Peripheral vision does the work.

> แสง (saeng) = light. Sensation = the rest.

## Why build one

The existing options were bad.

- **Via web app** — Chrome-only, manual, no scripting surface
- **QMK CLI** — requires flashing firmware to change a color
- **Open-source HID libraries in Python** — pulled in `hidapi`, `libusb`, half a dozen C deps, plus a venv
- **Rust crates** — worked but heavy for a 300-line tool

I wanted:

```
One static binary
Zero C dependencies
Zero Python
Drop into PATH
```

Go, direct `/dev/hidraw`, done.

## The protocol

Keychron V7 runs QMK firmware with the VIA protocol v10. VIA uses a raw HID interface (usage page `0xFF60`, interface 1) for out-of-band control.

Four commands cover everything I need:

| Command | Byte |
|---|---|
| `ViaSet` | `0x07` |
| `ViaGet` | `0x08` |
| `ViaSave` | `0x09` (persist to EEPROM) |

Four channels under `ViaSet`:

| Channel | Byte | Payload |
|---|---|---|
| Brightness | `0x80` | 0–255 |
| Effect | `0x81` | QMK effect ID |
| Speed | `0x82` | 0–3 |
| Color | `0x83` | hue, saturation (0–255 each) |

Set a breathing blue:

```
0x07 0x81 0x02        // effect = breathing
0x07 0x83 0xAA 0xFF   // color  = hue 170, sat 255
0x07 0x80 0x80        // brightness = 128
```

That's the whole API surface. Everything else is ergonomics.

## Finding the device

Linux exposes raw HID as `/dev/hidrawN`. You can't hardcode N — it renumbers on reboot.

Walk sysfs. Match VID:PID. Check the interface number.

```go
const (
    VID             = 0x3434
    PID             = 0x0370
    RawHIDInterface = 1
)

// hidID = "0003:00003434:00000370"
for _, entry := range matches {
    uevent := readFile(entry + "/device/uevent")
    if !contains(uevent, "HID_ID="+hidID) continue
    ifNum := readFile(parent(resolveSymlink(entry)) + "/bInterfaceNumber")
    if atoi(ifNum) == RawHIDInterface {
        return "/dev/" + basename(entry)
    }
}
```

No C library. No udev event listener. Just files.

## Non-root access

`/dev/hidraw*` is root-owned by default. Fix with a udev rule:

```
# /etc/udev/rules.d/99-saengsation.rules
KERNEL=="hidraw*", ATTRS{idVendor}=="3434", ATTRS{idProduct}=="0370", \
    MODE="0660", GROUP="plugdev", TAG+="uaccess"
```

Plus the user in `plugdev`. `make setup` wires all of it.

## Named states

Raw commands don't scale. I want names.

A state bundles effect + color + brightness + speed behind one identifier:

```json
{
  "focus": {
    "description": "Deep work — breathing blue",
    "effect": "breathing",
    "hue": 170,
    "sat": 255,
    "brightness": 80,
    "speed": 1
  }
}
```

`saengsation state set focus` is the whole CLI contract.

Built-in states cover the common cases:

| State | Feel |
|---|---|
| `focus` | Breathing blue — deep work |
| `alert` | Solid red — attention |
| `chill` | Rainbow cycle |
| `meeting` | Off |
| `matrix` | Digital rain, green |
| `night` | Solid dim warm |

Defaults are embedded in the binary. User overrides live at `~/.config/saengsation/states.json`. Same keys win from the user file.

## The Claude Code integration

This is the part I actually built the tool for.

Claude Code emits lifecycle events — prompt-submit, stop, subagent-stop, etc. A hook is a shell script that runs on those events. Map each event to a keyboard state:

| Event | State | Visual |
|---|---|---|
| User prompt submit | `acknowledged` | Green breathing fade (received your input) |
| Stop (waiting for next input) | `waiting` | Solid red (waiting on you) |
| SubagentStop / PostToolUse | `working` | Rainbow spiral (processing) |
| Background idle | `idle` | Dim blue pulse |

The hook itself is 12 lines:

```bash
#!/usr/bin/env bash
set -euo pipefail

cat > /dev/null &           # drain stdin so Claude doesn't hang

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SAENGSATION="${SAENGSATION:-$(dirname "$SCRIPT_DIR")/saengsation}"
STATE="${1:-idle}"

"$SAENGSATION" state set "$STATE" 2>/dev/null &
exit 0
```

Fire and forget. Background. Never blocks Claude.

`make hooks` merges the event → state mapping into `~/.claude/settings.json` via `jq`, preserving anything already there.

## The lifecycle, stacked

```
Type a prompt              → green breathes in
Submit                     → rainbow spiral (Claude working)
Spiral stops               → red (Claude waiting)
Type next prompt           → green breathes in
Close terminal             → dim blue pulse (idle)
```

After a day with it, the red glow becomes a physical cue. I look at the keyboard before the screen. When the spiral stops I already know the answer is ready.

## The EEPROM gotcha

`ViaSave` persists the current state to EEPROM. The keys boot into that state on any machine, independent of saengsation.

Dim or dark states persisted to EEPROM are a footgun.

Save `meeting` to EEPROM (brightness = 0). Unplug. Plug into a laptop without saengsation. Keyboard looks dead.

Fix:

```
saengsation state set chill --save
```

Bright rainbow cycle in EEPROM = keyboard boots visible on any machine. No lights → plug into a machine with saengsation and run this.

## What's under the hood

| File | Lines | Role |
|---|---|---|
| `keychron.go` | 278 | VIA protocol + sysfs device discovery |
| `main.go` | 338 | CLI |
| `states.go` | 143 | Load/save/embed states |
| `effects.go` | 46 | QMK effect name → ID table |

Under 1K lines of Go. One binary. One udev rule. One JSON file for user states.

## The summary

Direct HID to the keyboard. Named states as the CLI contract. Hooks wire keyboard lighting to Claude Code's event stream.

The keyboard becomes ambient status.

Repo: [github.com/mbarlow/saengsation](https://github.com/mbarlow/saengsation)
