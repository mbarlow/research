#!/usr/bin/env bash
# =============================================================================
# TRELLIS.2 Cloud GPU Runner
# =============================================================================
# Configurable script for running TRELLIS.2 image-to-3D on a rented cloud GPU.
# Designed for vast.ai / RunPod / any SSH-accessible Linux box with 24GB+ VRAM.
#
# Usage:
#   1. Edit the CONFIG section below
#   2. scp this script + your images to the cloud instance
#   3. Run: bash run-trellis2.sh
# =============================================================================

set -euo pipefail

# =============================================================================
# CONFIG — edit these before running
# =============================================================================

# Directory where TRELLIS.2 will be cloned and run
WORK_DIR="${WORK_DIR:-/workspace/trellis2}"

# Input images — space-separated paths or a directory
# Examples:
#   INPUT_IMAGES="/workspace/inputs/character.png"
#   INPUT_IMAGES="/workspace/inputs/*.png"
INPUT_IMAGES="${INPUT_IMAGES:-/workspace/inputs/*.png}"

# Output directory for generated .glb and .mp4 files
OUTPUT_DIR="${OUTPUT_DIR:-/workspace/outputs}"

# Model variant (only one available currently)
MODEL_ID="${MODEL_ID:-microsoft/TRELLIS.2-4B}"

# Export settings
TEXTURE_SIZE="${TEXTURE_SIZE:-4096}"        # Texture resolution: 1024, 2048, 4096
DECIMATION_TARGET="${DECIMATION_TARGET:-1000000}"  # Target face count for mesh
REMESH="${REMESH:-true}"                    # Clean up mesh topology: true/false
RENDER_VIDEO="${RENDER_VIDEO:-true}"        # Generate .mp4 preview: true/false

# Skip setup if already done (set to true on subsequent runs)
SKIP_SETUP="${SKIP_SETUP:-false}"

# =============================================================================
# SETUP
# =============================================================================

log() { echo "[trellis2] $(date '+%H:%M:%S') $*"; }

if [ "$SKIP_SETUP" = "false" ]; then
    log "Starting setup..."

    # Install conda if not present
    if ! command -v conda &>/dev/null; then
        log "Installing miniconda..."
        wget -q https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /tmp/miniconda.sh
        bash /tmp/miniconda.sh -b -p "$HOME/miniconda3"
        eval "$($HOME/miniconda3/bin/conda shell.bash hook)"
        conda init bash
        rm /tmp/miniconda.sh
    else
        eval "$(conda shell.bash hook)"
    fi

    # Clone repo
    if [ ! -d "$WORK_DIR" ]; then
        log "Cloning TRELLIS.2..."
        git clone -b main https://github.com/microsoft/TRELLIS.2.git --recursive "$WORK_DIR"
    fi

    cd "$WORK_DIR"

    # Run official setup
    log "Running setup.sh (this takes a while on first run)..."
    . ./setup.sh --new-env --basic --flash-attn --nvdiffrast --nvdiffrec --cumesh --o-voxel --flexgemm

    log "Setup complete."
else
    log "Skipping setup (SKIP_SETUP=true)"
    eval "$(conda shell.bash hook)"
    conda activate trellis2
    cd "$WORK_DIR"
fi

# =============================================================================
# GENERATE
# =============================================================================

mkdir -p "$OUTPUT_DIR"

# Write the generation script
cat > /tmp/trellis2_generate.py << 'PYTHON_EOF'
import os
os.environ['OPENCV_IO_ENABLE_OPENEXR'] = '1'
os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"

import sys
import glob
import json
import cv2
import imageio
from pathlib import Path
from PIL import Image
import torch
from trellis2.pipelines import Trellis2ImageTo3DPipeline
from trellis2.utils import render_utils
from trellis2.renderers import EnvMap
import o_voxel

# Read config from environment
model_id = os.environ["MODEL_ID"]
output_dir = Path(os.environ["OUTPUT_DIR"])
texture_size = int(os.environ["TEXTURE_SIZE"])
decimation_target = int(os.environ["DECIMATION_TARGET"])
remesh = os.environ["REMESH"].lower() == "true"
render_video = os.environ["RENDER_VIDEO"].lower() == "true"
input_patterns = sys.argv[1:]

# Resolve input files
input_files = []
for pattern in input_patterns:
    input_files.extend(glob.glob(pattern))
input_files = sorted(set(input_files))

if not input_files:
    print("ERROR: No input images found. Check INPUT_IMAGES config.")
    sys.exit(1)

print(f"Found {len(input_files)} image(s) to process:")
for f in input_files:
    print(f"  - {f}")

# Load model
print(f"\nLoading model: {model_id}")
pipeline = Trellis2ImageTo3DPipeline.from_pretrained(model_id)
pipeline.cuda()

# Load environment map for video rendering
envmap = None
hdri_path = "assets/hdri/forest.exr"
if render_video and os.path.exists(hdri_path):
    envmap = EnvMap(torch.tensor(
        cv2.cvtColor(cv2.imread(hdri_path, cv2.IMREAD_UNCHANGED), cv2.COLOR_BGR2RGB),
        dtype=torch.float32, device='cuda'
    ))

# Process each image
results = []
for img_path in input_files:
    name = Path(img_path).stem
    print(f"\n{'='*60}")
    print(f"Processing: {img_path}")
    print(f"{'='*60}")

    try:
        image = Image.open(img_path)
        mesh = pipeline.run(image)[0]
        mesh.simplify(16777216)

        # Export GLB
        glb_path = output_dir / f"{name}.glb"
        glb = o_voxel.postprocess.to_glb(
            vertices=mesh.vertices,
            faces=mesh.faces,
            attr_volume=mesh.attrs,
            coords=mesh.coords,
            attr_layout=mesh.layout,
            voxel_size=mesh.voxel_size,
            aabb=[[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]],
            decimation_target=decimation_target,
            texture_size=texture_size,
            remesh=remesh,
            remesh_band=1,
            remesh_project=0,
            verbose=True
        )
        glb.export(str(glb_path), extension_webp=True)
        print(f"Saved: {glb_path}")

        # Render video preview
        if render_video and envmap is not None:
            mp4_path = output_dir / f"{name}.mp4"
            video = render_utils.make_pbr_vis_frames(
                render_utils.render_video(mesh, envmap=envmap))
            imageio.mimsave(str(mp4_path), video, fps=15)
            print(f"Saved: {mp4_path}")

        results.append({"file": img_path, "status": "ok", "glb": str(glb_path)})

        # Free memory between images
        del mesh, glb
        torch.cuda.empty_cache()

    except Exception as e:
        print(f"FAILED: {img_path} — {e}")
        results.append({"file": img_path, "status": "error", "error": str(e)})
        torch.cuda.empty_cache()

# Summary
print(f"\n{'='*60}")
print("RESULTS SUMMARY")
print(f"{'='*60}")
for r in results:
    status = "OK" if r["status"] == "ok" else f"FAIL: {r['error']}"
    print(f"  {r['file']} — {status}")
print(f"\nOutputs in: {output_dir}")
PYTHON_EOF

log "Starting generation..."
# shellcheck disable=SC2086
python /tmp/trellis2_generate.py $INPUT_IMAGES

log "Done. Outputs are in: $OUTPUT_DIR"
log ""
log "Download your files with:"
log "  scp -r <user>@<host>:$OUTPUT_DIR/ ./trellis2-outputs/"
log ""
log "REMINDER: Stop/destroy your cloud instance to stop billing!"
