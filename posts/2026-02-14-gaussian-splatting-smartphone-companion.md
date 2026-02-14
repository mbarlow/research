---
title: Companion - Gaussian Splatting from Smartphone Photos (Local RTX 3060 Workflow)
date: 2026-02-14
order: 2.5
description: Companion guide: capture photos on a phone, reconstruct/train locally, and load your splat in the blog viewer on RTX 3060 12GB.
tags: [graphics, gaussian-splatting, workflow, colmap, rtx3060]
---

## Why This Companion Exists

This is the practical companion to the Gaussian splatting notes post. It answers one question: **how do I go from phone photos to a usable splat locally?**

> [!note]
> Target machine: **RTX 3060 12GB VRAM + 32GB system RAM**.

## Requirements

| Component | Minimum | Recommended |
|---|---|---|
| GPU | 8GB VRAM | RTX 3060 12GB |
| System RAM | 16GB | 32GB |
| Storage | 15GB free | 25GB free |
| OS | Linux/WSL2 | Ubuntu 22.04+ |

## Capture Checklist (No LiDAR)

- 80 to 200 photos
- Strong overlap between adjacent shots
- Slow movement around the subject
- Stable lighting and exposure lock if possible
- Remove blurry photos before reconstruction

## Source Photo Strip

Place your real inputs here (this strip currently uses placeholders):

<div class="photo-strip">
  <figure><img src="media/gaussian-splats/source/shot-01.svg" alt="Source shot 01"><figcaption>Shot 01</figcaption></figure>
  <figure><img src="media/gaussian-splats/source/shot-02.svg" alt="Source shot 02"><figcaption>Shot 02</figcaption></figure>
  <figure><img src="media/gaussian-splats/source/shot-03.svg" alt="Source shot 03"><figcaption>Shot 03</figcaption></figure>
  <figure><img src="media/gaussian-splats/source/shot-04.svg" alt="Source shot 04"><figcaption>Shot 04</figcaption></figure>
  <figure><img src="media/gaussian-splats/source/shot-05.svg" alt="Source shot 05"><figcaption>Shot 05</figcaption></figure>
  <figure><img src="media/gaussian-splats/source/shot-06.svg" alt="Source shot 06"><figcaption>Shot 06</figcaption></figure>
  <figure><img src="media/gaussian-splats/source/shot-07.svg" alt="Source shot 07"><figcaption>Shot 07</figcaption></figure>
  <figure><img src="media/gaussian-splats/source/shot-08.svg" alt="Source shot 08"><figcaption>Shot 08</figcaption></figure>
</div>

## End-to-End Steps

````steps
### Step 1: Install dependencies

```bash
sudo apt update
sudo apt install -y git cmake build-essential ninja-build ffmpeg python3-venv libgl1 colmap
```

### Step 2: Set up Gaussian Splatting repo

```bash
git clone https://github.com/graphdeco-inria/gaussian-splatting.git
cd gaussian-splatting
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 3: Put photos in input folder

```bash
mkdir -p data/desk/input
cp ~/Pictures/desk/*.jpg data/desk/input/
```

### Step 4: Run conversion (COLMAP pipeline)

```bash
python convert.py -s data/desk
```

### Step 5: Train with 3060-safe defaults

```bash
python train.py \
  -s data/desk \
  -m output/desk \
  --resolution 2 \
  --data_device cpu \
  --test_iterations -1 \
  --iterations 15000 \
  --densify_until_iter 9000
```

### Step 6: Copy trained splat output for this blog viewer

```bash
cp output/desk/point_cloud/iteration_15000/point_cloud.ply \
  /home/mbarlow/git/github.com/mbarlow/research/media/gaussian-splats/output/scene.ply
```

Then change the embed path in this post from `train.splat` to `scene.ply` when you want to view your own result.
````

> [!tip]
> If training fails with OOM, reduce photos first, then keep `--resolution 2` and retry.

## Interactive Splat Viewer

<div data-scene="gaussian-splat-viewer.js" data-splat="media/gaussian-splats/output/train.splat" data-splat-fallback="media/gaussian-splats/output/example-nike.splat" style="width:100%;height:460px;"></div>

<p class="scene-hint">Default demo path: <code>media/gaussian-splats/output/train.splat</code> (fallback: <code>example-nike.splat</code>). Swap to <code>scene.ply</code> after your own training run.</p>

> [!note]
> Bundled samples in this repo:
> - `media/gaussian-splats/output/train.splat` (downloaded from antimatter demo assets)
> - `media/gaussian-splats/output/example-nike.splat` from `https://media.reshot.ai/models/nike_next/model.splat`

## Quick Debug Q&A

```chat
user: I only see the fallback sample and not my own result.
llm: Your trained file path is likely wrong. Confirm exact filename and location: `media/gaussian-splats/output/scene.ply`.

user: Reconstruction quality is poor.
llm: Capture quality is usually the bottleneck. Remove blurry shots, increase overlap, and avoid rapid lighting changes.

user: Is this expected to be fast on 3060?
llm: Yes for small-to-medium scenes. Start with 80 to 120 photos, then scale up once your first run works.
```

## Generation Metadata

- Assistant: Codex
- Model: GPT-5
- Generation date: 2026-02-14

## Prompt Used to Generate This Post

```text
Write a companion blog article to an existing Gaussian splatting theory post. The companion must be practical and simple: smartphone capture checklist (no LiDAR), local free-tool workflow (COLMAP + graphdeco Gaussian Splatting), explicit requirements for RTX 3060 12GB + 32GB RAM, step-by-step commands, troubleshooting, source image strip section, and a threejs viewer embed section with fallback sample splat. Keep it readable and execution-oriented. End with metadata Assistant=Codex and Model=GPT-5 and append the generation prompt.
```
