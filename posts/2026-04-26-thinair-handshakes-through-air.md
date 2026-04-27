---
title: ThinAir — handshakes through the air, files through WebRTC
date: 2026-04-26
order: 50
description: Static, browser-only file transfer. WebRTC moves the bytes. QR codes and audio chirps move the handshake. WIP — QR works, audio mostly doesn't.
tags: [webrtc, qr-codes, audio, fsk, signaling, peer-to-peer, javascript, wip]
---

## Shape

```
File over WebRTC.
Handshake over QR, text, or audio.
No backend. No storage. No account.
```

Static page. <https://mbarlow.github.io/thinair/>

## Why I'm building this

WebRTC has been in browsers for a decade. Two phones can move a file directly. The only hard part is the handshake — getting an SDP offer and answer between them without a server in the middle.

Every commercial "send a file" tool solves this with an account, an upload, or a relay. None of those are necessary. The handshake is small. It can ride a channel you already own.

Three channels:

```
Camera + QR
Microphone + chirp
Copy/paste
```

Once the handshake lands, WebRTC takes over. The static page is the introducer. It never sees the file.

## Layout

```
index.html
src/
  webrtc/   peer.js, file-transfer.js, signaling.js, sdp-pack.js
  qr/       qr-generate.js, qr-scan.js
  audio/    profiles.js, framing.js, chirp-encode.js, chirp-decode.js
  codec/    base.js, checksum.js, compress.js
  ui/       send-view, receive-view, manual-view, diagnostics-view
```

No build step. ES modules. Three CDN libs: `qrcode-generator`, `jsQR`, `pako`.

## SDP packing

Chrome's WebRTC offer is ~720 bytes of SDP. Too big for a usable QR code. Way too big for an audio burst.

`sdp-pack.js` keeps only the dynamic fields and rebuilds the rest from a fixed template at the receiver:

- ufrag, pwd, fingerprint, setup, mid
- ICE candidates
- session id

~720 bytes → ~180 bytes. 3–4× shrink. A whole offer fits in one QR code. An audio burst becomes plausible.

## What works: QR

Phone-to-phone is solid. Sender shows offer QR. Receiver scans, generates answer QR. Sender scans answer. Channel opens.

No app install. No network setup. Two cameras and a webpage.

## What doesn't: audio chirp

4-FSK across 4 parallel sub-bands, 1500–4500 Hz, 60 ms symbols, sustained-tone preamble for sample-accurate sync. CRC-16 per frame. Three repeats.

```js
// audio/profiles.js — birdsong-v1
symbolMs: 60,
gapMs: 12,
repeat: 3,
payloadBytesPerFrame: 32,
bands: [
  [1500, 1700, 1900, 2100],
  [2300, 2500, 2700, 2900],
  [3100, 3300, 3500, 3700],
  [3900, 4100, 4300, 4500],
],
```

When it works, two laptops sing at each other and a file appears. Modem-reincarnated-as-bird. Delightful.

It often doesn't work. Things that break it:

```
Room reverb smearing symbols
Laptop fans inside the lower sub-band
Speaker EQ rolling off above 4 kHz
Voice-tuned mic clipping the preamble sweep
Anyone in the room talking
```

Every fix trades robustness for bitrate. The SDP envelope is already at the edge of what fits in a burst short enough for a human to tolerate. So audio stays as the no-camera fallback. QR is the path that ships.

## Constraints (v1)

```
Both devices online during transfer
No TURN — restrictive networks fail
Google STUN is the only external helper
Audio carries small payloads only
```

## Next

- Explicit FEC instead of brute-force repetition.
- Profile negotiation — fast first, slow on CRC fail.
- Diagnostics view that plays the preamble and reports what the room did to it.

## What I'm actually exploring

Cameras and microphones weren't designed as data links. They're good enough to bootstrap one. The static page is just the introducer. Everything load-bearing happens off-server, through the air.

WIP. <https://github.com/mbarlow/thinair>.
