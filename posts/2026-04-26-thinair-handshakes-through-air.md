---
title: ThinAir — Handshakes Through the Air, Files Through WebRTC
date: 2026-04-26
order: 50
description: A static, browser-only file transfer app. WebRTC moves the bytes. QR codes and audio chirps move the handshake. No backend, no storage, no account. WIP — QR works, audio is cool but error-prone.
tags: [webrtc, qr-codes, audio, fsk, signaling, peer-to-peer, javascript, wip]
---

## The pitch

```
The file moves over WebRTC.
The handshake moves through QR codes, text, and audio chirps.
No storage backend.
No uploaded files on a server.
No account.
No paid service.
```

Live: <https://mbarlow.github.io/thinair/>

Two devices. One file. Pair them. Transfer. Close the tab.

## Why bother

Every "send a file" service in 2026 wants an account, an upload, a TURN server, or a subscription. WebRTC has been in browsers for over a decade. It can move a file directly between two phones. The only hard part is the handshake — exchanging an SDP offer and answer without a server in between.

ThinAir's whole bet is that the handshake can travel through *physical channels* you already have:

- **A camera staring at a QR code.**
- **A microphone listening to a chirp.**
- **Copy/paste, when both fail.**

After the handshake lands, WebRTC takes over. Bytes flow peer-to-peer. The static page on GitHub Pages was the introducer. It does not see the file.

## What's in the repo

```
index.html
src/
  app.js, router.js
  webrtc/   peer.js, file-transfer.js, signaling.js, sdp-pack.js
  qr/       qr-generate.js, qr-scan.js
  audio/    profiles.js, framing.js, chirp-encode.js, chirp-decode.js
  codec/    base.js, checksum.js, compress.js
  ui/       send-view, receive-view, manual-view, diagnostics-view, ...
```

No build step. Vanilla ES modules. Three CDN libs: `qrcode-generator`, `jsQR`, `pako`. Total surface area is small enough to read in an afternoon.

## The SDP packing trick

A Chrome WebRTC offer is around 720 bytes of SDP. That is too much for a single QR code at any usable density, and *way* too much for an audio chirp. So `sdp-pack.js` strips the offer down to the dynamic fields and rebuilds the rest from a fixed template at the receiver:

- ufrag, pwd, fingerprint, setup, mid
- ICE candidates (foundation, component, transport, priority, addr, port, type)
- session id

That packs ~720 bytes down to ~180 bytes. Combined with base64url for QR or raw bytes for audio, you get a 3–4× shrink. Enough that a single QR code carries the whole offer, and an audio burst becomes plausible.

## What works: QR pairing

Phone-to-phone is solid. Sender shows offer QR. Receiver scans, generates answer QR. Sender scans answer. Channel opens. File flies.

The flow feels like magic the first time. Two phones, no network configuration, no app install — just a webpage and two cameras.

## What's beautiful but error-prone: the audio chirp

The audio path uses 4-FSK in 4 parallel sub-bands, 1500–4500 Hz, 60 ms symbols with 12 ms gaps and a sustained-tone preamble for sample-accurate sync. One byte per symbol slot. Three repeats for redundancy. CRC-16 on every frame.

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

When it works, two laptops sitting on a table sing at each other for a few seconds and a file appears on one of them. It sounds like a 1990s modem reincarnated as a small bird. People in the room laugh. It is genuinely delightful.

When it does not work — and it often does not — the failure mode is silent and frustrating. Things that break it:

- Room reverb smearing symbols into each other.
- Laptop fans inside the same band as the lower sub-band.
- Speaker EQ rolling off above 4 kHz.
- A microphone that's already gain-staged for voice and clips on the preamble sweep.
- Any second human in the room who decides this is the moment to talk.

There are knobs to fix all of this — symbol timing, band placement, repeat count, FEC, narrower bands. But every choice trades robustness against bitrate, and the SDP envelope is already at the edge of what fits in an audio burst short enough that a person will tolerate it.

So the audio path stays as a "wow" demo and a fallback when neither device has a camera. QR is the production path.

## Constraints (v1)

- Both devices online during transfer. No relay, no storage.
- Audio carries small payloads only — full WebRTC offers usually need QR or text.
- No TURN. Restrictive networks will fail.
- Google STUN as the only external helper.

## What's next

- Tighter audio framing with explicit FEC instead of brute-force repetition.
- Automatic profile negotiation — start with the short fast one, fall back to the slow robust one if CRC fails.
- A "manual paste" view for the case where someone is on a corporate network that blocks STUN.
- A diagnostics view that just plays the preamble and tells you what your room is doing to it.

## The shape of the idea

The interesting part of ThinAir is not the code. It is the principle:

```
Move the bulk over the network you have.
Move the handshake over the channel you can see, hear, or touch.
```

Cameras and microphones are universal. They were not designed as data links, but they are *good enough* to bootstrap a real one. ThinAir is the smallest version of that idea I could ship as a static page.

WIP. Repo: <https://github.com/mbarlow/thinair>.
