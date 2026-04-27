---
title: ThinAir — handshakes through the air, files through WebRTC
date: 2026-04-26
order: 50
description: Static, browser-only, installable file transfer. WebRTC moves the bytes. QR codes move the handshake. No backend, no cloud, no account.
tags: [webrtc, qr-codes, pwa, signaling, peer-to-peer, javascript]
---

## Shape

```
File over WebRTC.
Handshake over QR.
No backend. No storage. No account.
```

Static page. Installable. <https://mbarlow.github.io/thinair/>

## Why I'm building this

WebRTC has been in browsers for a decade. Two devices can move a file directly. The only hard part is the handshake — getting an SDP offer and answer between them without a server in the middle.

Every commercial "send a file" tool solves this with an account, an upload, or a relay. None of those are necessary. The handshake is small. It can ride a channel both devices already own — their cameras.

## How it works now

Two devices. Two cameras. One QR each direction:

```
sender:   open ThinAir → tap Send → file picker
                        → page becomes a QR
receiver: open ThinAir → tap Receive → camera opens
                        → scan sender QR
                        → page becomes the answer QR
                        → device chirps a 3-tone cue
sender:   mic hears the cue → camera opens automatically
                        → scan answer QR → channel opens
both:     transfer progress bar → done
```

Sender to receiver: QR. Receiver to sender: QR. The audio cue isn't carrying data — it's just a "your turn" tap on the shoulder so the sender's UI flips to scan mode without a button press.

## What changed in this push

```
PWA install (manifest, service worker, icons)
Single linear flow — no nav bar, no menus
Send auto-opens file picker, supports multiple files
QR shatters into tiles between steps (random animation each time)
Step-done audio cue, not a data carrier
Multi-file queue protocol over the data channel
File picker → QR → camera → progress, that's the whole UI
```

The audio modem is still in the repo, but it's hidden. Section at the bottom of this post.

## SDP packing

Chrome's WebRTC offer is ~720 bytes of SDP. Too big for a single comfortable QR.

`sdp-pack.js` keeps only the dynamic fields and rebuilds the rest from a fixed template at the receiver:

- ufrag, pwd, fingerprint, setup, mid
- ICE candidates
- session id

~720 bytes → ~180 bytes. 3–4× shrink. The whole offer fits in one QR. Single frame, no animation needed for capacity.

## Multi-file protocol

One ordered data channel, JSON control + binary payload:

```
sender → batch  { count, totalBytes }
sender → meta   { i, name, type, size, chunkSize }
sender → ...binary chunks (64 KiB each, throttled by bufferedAmount)
sender → file-done { i }
... next file
sender → done
```

Receiver downloads each file as it lands; sender shows aggregate + per-file progress. No archive packing — the receiver gets each file as a separate blob.

## What's deliberately not here

```
No TURN — restrictive networks fail. Use the LAN.
No backend file storage. Files only travel peer-to-peer.
No account. No telemetry.
No build step. Vanilla ES modules.
```

If you're on the same Wi-Fi, the mDNS host candidate gives you a direct LAN path and the transfer is wire-speed. Cross-network depends on whether STUN can punch through.

## Layout

```
index.html
manifest.webmanifest
service-worker.js
icon.svg, icon-maskable.svg
src/
  app.js
  ui/   app-flow.js, animations.js, util.js, diagnostics-view.js
  webrtc/   peer.js, file-transfer.js, signaling.js, sdp-pack.js
  qr/       qr-generate.js, qr-scan.js
  audio/    cue.js                     ← step-done tone burst
            chirp-encode.js,
            chirp-decode.js,
            profiles.js, framing.js,
            control.js                 ← experimental modem (hidden)
  codec/    base.js, checksum.js, compress.js
```

CDN libs: `qrcode-generator`, `jsQR`, `pako`. Build SHA injected on every Pages deploy and shown in the corner pill so you can verify what's running.

---

## Appendix: the audio modem (cool, not practical)

I built an audio-frequency-shift-keying modem to carry the entire SDP envelope through speaker → mic. Goal: a working "no camera" path. It's a neat experiment that I left in the repo because the protocol is fun and the failure modes are educational, but it's no longer in the main flow.

### Modem design

```js
// audio/profiles.js — birdsong-v1
symbolMs: 60,
gapMs: 12,
payloadBytesPerFrame: 32,
bands: [
  [1500, 1700, 1900, 2100],
  [2300, 2500, 2700, 2900],
  [3100, 3300, 3500, 3700],
  [3900, 4100, 4300, 4500],
],
sweepStartHz: 800, sweepEndHz: 4800, sweepMs: 150, sweepGapMs: 50,
perToneAmplitude: 0.22,
```

- **4 parallel sub-bands × 4-FSK each**, 1 byte per 60 ms symbol slot.
- **Linear FM sweep preamble** (800 → 4800 Hz, 150 ms). Receiver runs an I/Q matched filter against pre-computed cos/sin templates of the same chirp; |corr| peaks sample-accurately at the end of the received sweep, giving a stable symbol-grid origin.
- **CRC-16 framing**, magic byte `0xAA`, length-prefixed frames.
- **NACK back-channel**: receiver chirps which seq numbers it's missing, sender replays just those frames.

### Why it doesn't ship

```
Phone speakers roll off above 4 kHz.
Laptop mics low-pass aggressively for voice.
Browser audio pipelines silently filter ultrasonic content even with
  noiseSuppression: false.
Room reverb smears symbol boundaries.
Sample-rate mismatches between encoder and decoder.
Cheap hardware ≠ flat frequency response.
```

In the bench loopback (encoder buffer fed straight into the decoder) it's perfect through 20% white noise. Across a real room with a real phone speaker and a real laptop mic, even with the matched-filter sync and the NACK loop, you have to hold the speaker basically touching the mic, and even then it's intermittent. The SDP envelope is too many bits to push through a channel that wasn't designed as a data link.

### What the experiment taught me

- **Sample-accurate sync is the thing.** Energy-edge detection on a sustained tone has ~30 ms slop in a 60 ms symbol window — half the symbols straddle boundaries. A chirp-sweep matched filter drops sync error to microseconds. That single change took the modem from "never decodes a frame" to "decodes byte-perfect on clean signal." Sync, not throughput, is what makes audio modems hard.
- **Hardware roll-off is the dominant noise floor**, not room ambient. The top sub-band (3.9–4.5 kHz) is where most cheap speakers and voice-tuned mics give up; you don't notice until you measure.
- **NACK is cheaper than repeats.** A 5-byte NACK chirp is ~1.3 s. A full payload cycle is ~17 s. Even if it takes one NACK round, that's a third of two blind cycles.
- **Cute UX matters.** I picked the songbird-style tones over modem squeals because the chirp had to be tolerable to hear repeatedly. Users tolerated the wait when the device sounded like it was *trying*.

The modem code is still in `src/audio/{chirp-encode,chirp-decode,profiles,framing,control}.js`. The dispatcher in the main flow doesn't reach it. Anyone curious can read the source.

The lesson, restated: **cameras and microphones weren't designed as data links**. Cameras are good enough that QR works first try. Microphones plus consumer speakers are at the edge of what physics gives you, and chasing the last percent of reliability is several days of DSP work for a feature most users never need.

ThinAir ships with QR.

<https://github.com/mbarlow/thinair>
