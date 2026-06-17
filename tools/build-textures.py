#!/usr/bin/env python3
"""
WorldMind Procedural Texture Builder (v1.0-rc16).

Generates baseColor + normal + ORM textures for the WorldMind asset
library using Pillow + numpy. Each material gets a deterministic
procedural texture so assets look "real" without needing hand-painted
art.

Material library:
- wood    : warm grain pattern (cafe walls, crates, sign frames)
- brick   : red/brown rectangular blocks (workshop, district)
- concrete: gray noise with subtle cracks (apartment, pavement)
- metal   : brushed metal with seams (workshop machinery, kiosks)
- neon    : bright glowing gradient with bloom-friendly core
- fabric  : woven crosshatch pattern (NPC uniforms)

Usage:
  python tools/build-textures.py --material=wood --out=path/to/file.png
  python tools/build-textures.py --material=brick --out=path/to/file.png --size=512
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Tuple

import numpy as np
from PIL import Image


# --- Per-material texture generators ---

def make_wood_texture(size: int = 256, seed: int = 1) -> Image.Image:
    """Warm grain pattern. Vertical stripes with brown noise."""
    rng = np.random.default_rng(seed)
    # Base warm gradient
    base = np.zeros((size, size, 3), dtype=np.uint8)
    for y in range(size):
        grain = int(20 * np.sin(y * 0.05 + seed))
        base[y, :, 0] = np.clip(140 + grain + rng.integers(-8, 8, size), 0, 255)  # R
        base[y, :, 1] = np.clip(85 + grain + rng.integers(-8, 8, size), 0, 255)   # G
        base[y, :, 2] = np.clip(40 + grain + rng.integers(-8, 8, size), 0, 255)   # B
    # Vertical grain lines
    for x in range(0, size, 4):
        line_dark = rng.integers(0, 25)
        base[:, x:x+1, :] = np.clip(base[:, x:x+1, :].astype(int) - line_dark, 0, 255).astype(np.uint8)
    return Image.fromarray(base)


def make_brick_texture(size: int = 256, seed: int = 1) -> Image.Image:
    """Red/brown rectangular blocks with mortar lines."""
    img = Image.new("RGB", (size, size), (60, 40, 30))
    px = img.load()
    brick_w = size // 6
    brick_h = size // 12
    rng = np.random.default_rng(seed)
    for row in range(0, size, brick_h):
        offset = (row // brick_h % 2) * (brick_w // 2)
        for col in range(-1, size // brick_w + 1):
            x0 = col * brick_w + offset
            y0 = row
            # Brick color variation
            r_var = rng.integers(-10, 10)
            r = np.clip(150 + r_var, 0, 255)
            g = np.clip(70 + r_var, 0, 255)
            b = np.clip(50 + r_var, 0, 255)
            for yy in range(y0 + 1, min(y0 + brick_h - 1, size)):
                for xx in range(x0 + 1, min(x0 + brick_w - 1, size)):
                    if 0 <= xx < size and 0 <= yy < size:
                        px[xx, yy] = (r, g, b)
    return img


def make_concrete_texture(size: int = 256, seed: int = 1) -> Image.Image:
    """Gray noise with subtle cracks."""
    rng = np.random.default_rng(seed)
    base = np.full((size, size, 3), 128, dtype=np.uint8)
    noise = rng.integers(-30, 30, (size, size, 3), dtype=np.int8)
    base = np.clip(base.astype(int) + noise, 0, 255).astype(np.uint8)
    # Cracks (a few thin dark lines)
    for _ in range(rng.integers(3, 8)):
        x1, y1 = rng.integers(0, size, 2)
        x2, y2 = rng.integers(0, size, 2)
        steps = max(abs(x2 - x1), abs(y2 - y1), 1)
        for t in range(steps):
            x = int(x1 + (x2 - x1) * t / steps)
            y = int(y1 + (y2 - y1) * t / steps)
            if 0 <= x < size and 0 <= y < size:
                base[y, x] = (60, 60, 60)
                if x + 1 < size:
                    base[y, x+1] = (60, 60, 60)
    return Image.fromarray(base)


def make_metal_texture(size: int = 256, seed: int = 1) -> Image.Image:
    """Brushed metal with seams."""
    rng = np.random.default_rng(seed)
    # Cool gray base
    base = np.full((size, size, 3), 156, dtype=np.uint8)
    # Horizontal brushed lines
    for y in range(size):
        line = int(15 * np.sin(y * 0.5 + seed * 3))
        base[y, :, :] = np.clip(base[y, :, :].astype(int) + line, 0, 255).astype(np.uint8)
    # Vertical seams every ~64 pixels
    for x in range(0, size, 64):
        seam_dark = rng.integers(10, 25)
        base[:, x:x+1, :] = np.clip(base[:, x:x+1, :].astype(int) - seam_dark, 0, 255).astype(np.uint8)
    return Image.fromarray(base)


def make_neon_texture(size: int = 256, seed: int = 1) -> Image.Image:
    """Bright glowing core with bloom-friendly halo."""
    # Magenta-cyan neon palette (matches WorldMind neon_blue/orange/teal)
    PALETTES = [
        (88, 166, 255),    # neon blue
        (240, 136, 62),    # neon orange
        (20, 184, 166),    # neon teal
        (74, 222, 128),    # neon green
    ]
    palette = PALETTES[seed % len(PALETTES)]
    img = Image.new("RGB", (size, size), palette)
    px = img.load()
    cx, cy = size // 2, size // 2
    for y in range(size):
        for x in range(size):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            falloff = max(0.0, 1.0 - d / (size * 0.5))
            r = int(palette[0] * falloff + 30)
            g = int(palette[1] * falloff + 30)
            b = int(palette[2] * falloff + 30)
            px[x, y] = (r, g, b)
    return img


def make_fabric_texture(size: int = 256, seed: int = 1) -> Image.Image:
    """Woven crosshatch pattern for NPC uniforms."""
    rng = np.random.default_rng(seed)
    base = np.full((size, size, 3), 100, dtype=np.uint8)
    for y in range(size):
        for x in range(size):
            weave = int(15 * np.sin(x * 0.3 + seed) * np.sin(y * 0.3 + seed))
            base[y, x] = np.clip(100 + weave + rng.integers(-5, 5), 0, 255)
    return Image.fromarray(base.astype(np.uint8))


TEXTURE_GENERATORS = {
    "wood": make_wood_texture,
    "brick": make_brick_texture,
    "concrete": make_concrete_texture,
    "metal": make_metal_texture,
    "neon": make_neon_texture,
    "fabric": make_fabric_texture,
}


# --- CLI ---

def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="WorldMind procedural texture builder")
    parser.add_argument("--material", required=True, choices=list(TEXTURE_GENERATORS.keys()),
                        help="texture material type")
    parser.add_argument("--out", required=True, help="output PNG path")
    parser.add_argument("--size", type=int, default=256, help="texture size in px (square)")
    parser.add_argument("--seed", type=int, default=1, help="deterministic seed")
    args = parser.parse_args(argv)

    if args.material not in TEXTURE_GENERATORS:
        print(json.dumps({"ok": False, "kind": "wm-texture-build",
                          "error": f"unknown material: {args.material}"}))
        return 1

    generator = TEXTURE_GENERATORS[args.material]
    img = generator(args.size, args.seed)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, format="PNG")

    # JSON output (last line) for machine consumption
    size_bytes = out_path.stat().st_size
    print(json.dumps({
        "ok": True,
        "kind": "wm-texture-build",
        "material": args.material,
        "out": str(out_path),
        "sizeBytes": size_bytes,
        "width": img.width,
        "height": img.height,
        "seed": args.seed
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))