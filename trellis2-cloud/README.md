# TRELLIS.2 Cloud GPU Runner

Run Microsoft's TRELLIS.2 image-to-3D model on a rented cloud GPU (vast.ai, RunPod, etc.) with per-second billing.

## Requirements

- Cloud GPU instance with **24GB+ VRAM** (RTX 3090, RTX 4090, A100, etc.)
- Ubuntu/Debian-based Linux
- SSH access

## Cost Estimate

| GPU | $/hr (approx) | 20 min |
|-----|---------------|--------|
| RTX 3090 | $0.20–0.40 | ~$0.10 |
| RTX 4090 | $0.40–0.70 | ~$0.20 |
| A100 80GB | $1.00–2.00 | ~$0.50 |

Both vast.ai and RunPod bill **per second** — you only pay for what you use.

## Quick Start

### 1. Rent a GPU

**vast.ai:**
- Go to https://vast.ai/console/create/
- Filter: GPU RAM >= 24GB, CUDA >= 12.4
- Pick cheapest option (usually RTX 3090)
- Select a Docker image with CUDA (e.g., `nvidia/cuda:12.4.0-devel-ubuntu22.04`)
- Launch and note the SSH connection string

**RunPod:**
- Go to https://www.runpod.io/console/pods
- Deploy a GPU Pod with 24GB+ VRAM
- Use the PyTorch template (includes CUDA + conda)

### 2. Upload script and images

```bash
# Create input directory on the instance
ssh <instance> "mkdir -p /workspace/inputs"

# Upload this script
scp run-trellis2.sh <instance>:/workspace/

# Upload your images
scp ~/my-images/*.png <instance>:/workspace/inputs/
```

### 3. Run

```bash
ssh <instance>
bash /workspace/run-trellis2.sh
```

First run takes ~10-15 minutes for setup (cloning, compiling extensions). Subsequent runs with `SKIP_SETUP=true` start generating immediately.

### 4. Download results

```bash
scp -r <instance>:/workspace/outputs/ ./trellis2-outputs/
```

### 5. STOP THE INSTANCE

This is the most important step. Go to the provider dashboard and **stop or destroy** the instance. Per-second billing only helps if you actually stop it.

## Configuration

All settings are environment variables. Edit them at the top of `run-trellis2.sh` or pass them inline:

```bash
# Process specific images at lower quality (faster)
TEXTURE_SIZE=2048 DECIMATION_TARGET=500000 \
  INPUT_IMAGES="/workspace/inputs/hero.png" \
  bash run-trellis2.sh

# Skip setup on subsequent runs
SKIP_SETUP=true bash run-trellis2.sh

# Skip video rendering (saves time)
RENDER_VIDEO=false bash run-trellis2.sh
```

### Settings Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `WORK_DIR` | `/workspace/trellis2` | Where to clone and run TRELLIS.2 |
| `INPUT_IMAGES` | `/workspace/inputs/*.png` | Input image path(s) or glob pattern |
| `OUTPUT_DIR` | `/workspace/outputs` | Where .glb and .mp4 files are saved |
| `MODEL_ID` | `microsoft/TRELLIS.2-4B` | HuggingFace model ID |
| `TEXTURE_SIZE` | `4096` | Texture map resolution (1024/2048/4096) |
| `DECIMATION_TARGET` | `1000000` | Target face count for final mesh |
| `REMESH` | `true` | Clean up mesh topology |
| `RENDER_VIDEO` | `true` | Generate .mp4 turntable preview |
| `SKIP_SETUP` | `false` | Skip clone/install on repeat runs |

## Tips

- **Batch your images** — upload everything you want to convert before running. Model loading takes ~30s, so batching is much cheaper than one-at-a-time.
- **Lower texture/decimation for test runs** — `TEXTURE_SIZE=1024 DECIMATION_TARGET=100000` to quickly verify things work before committing to full quality.
- **Keep the instance alive between batches** — if you have more images to try, just `SKIP_SETUP=true` and run again. Only destroy when fully done.
- **RTX 3090 is the sweet spot** — cheapest option that meets the 24GB minimum. A100 is overkill unless you need 1536^3 resolution.

## Output Files

For each input image `foo.png`, you get:
- `foo.glb` — Textured 3D mesh with PBR materials (base color, roughness, metallic, opacity). Opens in Blender, three.js, any GLB viewer.
- `foo.mp4` — Turntable preview video (if `RENDER_VIDEO=true`).

## Troubleshooting

**OOM on 24GB card**: Try `TEXTURE_SIZE=2048` and `DECIMATION_TARGET=500000`. The mesh simplification and texture baking are the most memory-hungry steps after inference.

**Setup script fails**: Make sure the instance has CUDA 12.4+ and git. Some minimal Docker images need `apt-get update && apt-get install -y git wget` first.

**bfloat16 errors**: The RTX 3090 supports bf16, but if you see dtype errors, check if PR #135 has been merged. You may need to manually patch dtype handling.
