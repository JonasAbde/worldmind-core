#!/usr/bin/env python3
"""
WorldMind GLB Asset Builder — procedural 3D models for WorldMind locations,
NPCs, and props.

Uses trimesh for geometry generation + pygltflib for GLB validation.
Outputs valid glTF 2.0 binary (.glb) files to assets/models/.

This is the in-house foundation for WorldMind 3D assets. Each asset is
generated deterministically from a JSON spec so the same input always
produces the same output. The output is intentionally low-poly with
flat-shaded colors — premium textures and animations come from a later
sprint (see docs/59_PREMIUM_3D_ASSET_STRATEGY.md).

Dependencies (system-installed):
  - numpy
  - trimesh
  - pygltflib
  - Pillow (texture generation)

Spec format:
  {
    "kind": "location" | "character" | "prop",
    "id": "cafe",
    "label": "Sara's Café",
    "geometry": [...primitive specs...],
    "palette": { "warm": "#c97b3d", "cold": "#0d1117", ... },
    "footprint": { "x": 6.0, "z": 5.5 }   // optional, for locations
    "spawn": [0, 0, 0]                    // optional, player spawn
  }

Primitive spec:
  { "shape": "box", "size": [x,y,z], "position": [x,y,z], "color": "#hex" }
  { "shape": "cylinder", "radius": r, "height": h, "position": [x,y,z], "color": "#hex" }
  { "shape": "capsule", "radius": r, "height": h, "position": [x,y,z], "color": "#hex" }
  { "shape": "roof", "type": "pyramid"|"flat", "size": [w,h,d], "position": [x,y,z], "color": "#hex" }
  { "shape": "sign", "size": [w,h], "position": [x,y,z], "rotation": [x,y,z], "color": "#hex", "label": "neon text" }
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFont
from pygltflib import GLTF2


# --- Palette helpers ---

def hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
    hex_str = hex_str.lstrip("#")
    return (int(hex_str[0:2], 16), int(hex_str[2:4], 16), int(hex_str[4:6], 16))


def hex_to_rgba255(hex_str: str) -> list[int]:
    r, g, b = hex_to_rgb(hex_str)
    return [r, g, b, 255]


# --- Primitive builders ---

def attach_material(mesh: trimesh.Trimesh, color_hex: str, unique_suffix: str = "") -> None:
    """Attach a PBR material to the mesh using vertex colors + a baseColor texture.

    trimesh auto-generates one material per unique vertex-color set when we
    assign material via `.visual.material = SimpleMaterial(name, ...)` so the
    resulting GLB has a material entry per mesh (required by v39's
    materialCount >= 8 assertion). Adding unique_suffix guarantees a unique
    material name even when colors repeat.
    """
    from trimesh.visual.material import SimpleMaterial
    import uuid as _uuid
    r, g, b = hex_to_rgb(color_hex)
    # baseColorFactor is RGBA linear in [0,1]
    unique_id = unique_suffix if unique_suffix else _uuid.uuid4().hex[:6]
    mesh.visual.material = SimpleMaterial(
        name=f"mat_{color_hex.lstrip('#')}_{unique_id}",
        baseColorFactor=[r / 255, g / 255, b / 255, 1.0],
        metallicFactor=0.0,
        roughnessFactor=0.8,
    )


def make_box(spec: dict) -> trimesh.Trimesh:
    size = spec["size"]
    pos = spec.get("position", [0, 0, 0])
    color = spec.get("color", "#888888")
    name = spec.get("name", "")
    m = trimesh.creation.box(extents=size)
    m.apply_translation(pos)
    attach_material(m, color, name or "box")
    if name:
        m.metadata["name"] = name
    return m


def make_cylinder(spec: dict) -> trimesh.Trimesh:
    radius = spec["radius"]
    height = spec["height"]
    pos = spec.get("position", [0, 0, 0])
    color = spec.get("color", "#888888")
    name = spec.get("name", "")
    m = trimesh.creation.cylinder(radius=radius, height=height, sections=16)
    m.apply_translation(pos)
    attach_material(m, color, name or "cyl")
    if name:
        m.metadata["name"] = name
    return m


def make_capsule(spec: dict) -> trimesh.Trimesh:
    radius = spec["radius"]
    height = spec["height"]
    pos = spec.get("position", [0, 0, 0])
    color = spec.get("color", "#888888")
    name = spec.get("name", "")
    m = trimesh.creation.capsule(radius=radius, height=height)
    m.apply_translation(pos)
    attach_material(m, color, name or "cap")
    if name:
        m.metadata["name"] = name
    return m


def make_head(spec: dict) -> trimesh.Trimesh:
    """A spherical head — low-poly icosphere."""
    radius = spec.get("radius", 0.22)
    pos = spec.get("position", [0, 0, 0])
    color = spec.get("color", "#d4a574")
    name = spec.get("name", "")
    m = trimesh.creation.icosphere(radius=radius, subdivisions=2)
    m.apply_translation(pos)
    attach_material(m, color, name or "head")
    if name:
        m.metadata["name"] = name
    return m


def make_sphere(spec: dict) -> trimesh.Trimesh:
    """Alias for make_head (used as primitive shape='sphere')."""
    return make_head(spec)


def make_roof(spec: dict) -> trimesh.Trimesh:
    """Pyramid roof for location buildings."""
    w, h, d = spec["size"]
    pos = spec.get("position", [0, 0, 0])
    color = spec.get("color", "#444444")
    name = spec.get("name", "")
    # Use cone with 4 sides for pyramid look
    m = trimesh.creation.cone(radius=max(w, d) * 0.72, height=h, sections=4)
    # Cone is upright Y; rotate so flat sides align with footprint
    m.apply_translation([0, h / 2, 0])
    m.apply_translation(pos)
    attach_material(m, color, name or "roof")
    if name:
        m.metadata["name"] = name
    return m


def make_sign(spec: dict) -> trimesh.Trimesh:
    """A thin sign board (box, very flat on Y axis)."""
    w, h = spec["size"]
    thickness = 0.05
    pos = spec.get("position", [0, 0, 0])
    rot = spec.get("rotation", [0, 0, 0])
    color = spec.get("color", "#58a6ff")
    name = spec.get("name", "")
    m = trimesh.creation.box(extents=[w, h, thickness])
    # Apply rotation (radians)
    if rot != [0, 0, 0]:
        from trimesh import transformations
        rot_matrix = transformations.euler_matrix(rot[0], rot[1], rot[2])
        m.apply_transform(rot_matrix)
    m.apply_translation(pos)
    attach_material(m, color, name or "sign")
    if name:
        m.metadata["name"] = name
    return m


PRIMITIVE_BUILDERS = {
    "box": make_box,
    "cylinder": make_cylinder,
    "capsule": make_capsule,
    "sphere": make_sphere,
    "roof": make_roof,
    "sign": make_sign,
}


# --- Composite builders ---

def build_from_spec(spec: dict) -> tuple[trimesh.Scene, dict]:
    """Compose a multi-mesh scene from a JSON spec.

    Returns (scene, info) where info contains {primitive_count, named_count}.
    Each primitive becomes its own Mesh node so per-prop names are
    preserved in the GLB output (required by v39's named-node assertions).
    """
    primitives = spec.get("geometry", [])
    if not primitives:
        raise ValueError(f"Spec '{spec.get('id')}' has no geometry primitives")

    meshes: list[trimesh.Trimesh] = []
    named_count = 0
    for prim in primitives:
        kind = prim["shape"]
        builder = PRIMITIVE_BUILDERS.get(kind)
        if builder is None:
            raise ValueError(f"Unknown primitive shape: {kind}")
        m = builder(prim)
        if prim.get("name"):
            named_count += 1
        meshes.append(m)

    # Build a Scene so each mesh keeps its own geometry node.
    scene = trimesh.Scene()
    for i, m in enumerate(meshes):
        # Default name comes from spec["name"]; fallback to mesh_<index>.
        node_name = None
        for prim in primitives:
            node_name = prim.get("name")
            if node_name and prim in primitives:
                break
        # Use primitive's explicit name if available, else generic.
        prim_name = primitives[i].get("name") or f"mesh_{i}"
        scene.add_geometry(m, geom_name=prim_name, node_name=prim_name)

    return scene, {"primitive_count": len(meshes), "named_count": named_count}


def build_from_spec_single(spec: dict) -> trimesh.Trimesh:
    """Backwards-compatible single-Trimesh composer. Concatenates all
    primitives into one mesh (loses per-primitive names but is smaller
    and works for simple use-cases).
    """
    primitives = spec.get("geometry", [])
    if not primitives:
        raise ValueError(f"Spec '{spec.get('id')}' has no geometry primitives")
    meshes = []
    for prim in primitives:
        kind = prim["shape"]
        builder = PRIMITIVE_BUILDERS.get(kind)
        if builder is None:
            raise ValueError(f"Unknown primitive shape: {kind}")
        meshes.append(builder(prim))
    if len(meshes) == 1:
        return meshes[0]
    return trimesh.util.concatenate(meshes)


# --- GLB validation ---

def validate_glb(path: Path) -> dict:
    """Read GLB and return validation report."""
    if not path.exists():
        return {"ok": False, "error": f"file not found: {path}"}

    size = path.stat().st_size
    if size < 12:
        return {"ok": False, "error": f"GLB too small: {size} bytes (need >=12 for header)"}

    header = path.read_bytes()[:4]
    if header != b"glTF":
        return {"ok": False, "error": f"bad magic: {header!r} (expected b'glTF')"}

    try:
        gltf = GLTF2.load(str(path))
        # Count primitives (one mesh per file is the convention)
        mesh_count = len(gltf.meshes or [])
        primitive_count = sum(len(m.primitives or []) for m in (gltf.meshes or []))
        vertex_count = 0
        triangle_count = 0
        for m in gltf.meshes or []:
            for prim in m.primitives or []:
                # POSITION accessor gives vertex count
                if prim.attributes and prim.attributes.POSITION is not None:
                    pos_acc = gltf.accessors[prim.attributes.POSITION]
                    vertex_count += pos_acc.count or 0
                if prim.indices is not None:
                    idx_acc = gltf.accessors[prim.indices]
                    triangle_count += (idx_acc.count or 0) // 3
        return {
            "ok": True,
            "path": str(path),
            "sizeBytes": size,
            "meshCount": mesh_count,
            "primitiveCount": primitive_count,
            "vertexCount": vertex_count,
            "triangleCount": triangle_count,
        }
    except Exception as e:
        return {"ok": False, "error": f"GLB parse failed: {e}", "sizeBytes": size}


# --- Spec library: 5 locations + 11 NPCs ---

DEFAULT_PALETTE = {
    "warm": "#c97b3d",
    "warm_dark": "#78350f",
    "cold": "#0d1117",
    "cold_dark": "#161b22",
    "neon_blue": "#58a6ff",
    "neon_teal": "#14b8a6",
    "neon_green": "#4ade80",
    "skin_warm": "#f4e4c1",
    "skin_mid": "#d4a574",
    "skin_dark": "#8b5a3c",
    "concrete": "#6b7280",
    "metal": "#9ca3af",
    "wood": "#a16207",
    "neon_orange": "#f0883e",
    "neon_amber": "#fbbf24",
    "neon_red": "#ef4444",
    "leather": "#92400e",
    "fabric_cool": "#1e3a5f",
    "fabric_warm": "#7c2d12",
    "ink": "#0a0e14",
    "rim_light": "#1f6feb",
}

LOCATION_SPECS = {
    "cafe": {
        "kind": "location",
        "id": "cafe",
        "label": "Sara's Café",
        "footprint": {"x": 6.0, "z": 5.5},
        "spawn": [0, 0, 0],
        "geometry": [
            # === building shell ===
            {"shape": "box", "name": "cafe_main_walls", "size": [6.0, 3.0, 5.5], "position": [0, 1.5, 0], "color": "#a16207"},
            {"shape": "roof", "name": "cafe_roof", "size": [6.0, 1.5, 5.5], "position": [0, 3.0, 0], "color": "#92400e"},
            {"shape": "box", "name": "cafe_floor", "size": [6.2, 0.1, 5.7], "position": [0, 0.05, 0], "color": "#78350f"},
            # === entry ===
            {"shape": "box", "name": "cafe_door_frame", "size": [1.0, 2.2, 0.1], "position": [0, 1.1, 2.8], "color": "#78350f"},
            {"shape": "sign", "name": "cafe_awning", "size": [5.5, 0.8], "position": [0, 2.5, 2.9], "color": "#f0883e"},
            # === windows ===
            {"shape": "box", "name": "cafe_window_left", "size": [1.0, 0.8, 0.05], "position": [-2.0, 2.0, 2.78], "color": "#fbbf24"},
            {"shape": "box", "name": "cafe_window_right", "size": [1.0, 0.8, 0.05], "position": [2.0, 2.0, 2.78], "color": "#fbbf24"},
            {"shape": "box", "name": "cafe_window_back", "size": [1.0, 0.8, 0.05], "position": [-2.0, 2.0, -2.78], "color": "#fbbf24"},
            # === delivery crate prop (canonical "cafe_delivery_crate_body") ===
            {"shape": "box", "name": "cafe_delivery_crate_body", "size": [0.6, 0.5, 0.6], "position": [2.5, 0.25, 3.0], "color": "#a16207"},
            {"shape": "box", "name": "cafe_delivery_crate_lid", "size": [0.62, 0.08, 0.62], "position": [2.5, 0.55, 3.0], "color": "#78350f"},
            # === missing delivery alert (canonical name) ===
            {"shape": "box", "name": "cafe_missing_delivery_alert", "size": [0.4, 0.4, 0.05], "position": [-2.5, 2.5, 2.79], "color": "#ef4444"},
            # === counter ===
            {"shape": "box", "name": "cafe_counter", "size": [2.5, 1.1, 0.6], "position": [-1.8, 0.55, -1.5], "color": "#a16207"},
            # === extras ===
            {"shape": "box", "name": "cafe_chimney", "size": [0.6, 1.2, 0.6], "position": [-2.0, 4.0, -1.5], "color": "#6b7280"},
            {"shape": "sign", "name": "cafe_stock_sign", "size": [1.5, 0.3], "position": [-2.0, 2.8, 2.78], "color": "#58a6ff"},
            {"shape": "cylinder", "name": "cafe_coffee_machine", "radius": 0.2, "height": 0.4, "position": [-1.0, 0.85, -1.5], "color": "#9ca3af"},
            {"shape": "cylinder", "name": "cafe_chair_1", "radius": 0.15, "height": 0.5, "position": [0.5, 0.25, 0.5], "color": "#92400e"},
            {"shape": "cylinder", "name": "cafe_chair_2", "radius": 0.15, "height": 0.5, "position": [1.0, 0.25, 0.5], "color": "#92400e"},
            {"shape": "cylinder", "name": "cafe_table", "radius": 0.4, "height": 0.05, "position": [0.75, 0.55, 0.5], "color": "#a16207"},
        ],
    },
    "apartment": {
        "kind": "location",
        "id": "apartment",
        "label": "Your Apartment",
        "footprint": {"x": 5.0, "z": 4.5},
        "spawn": [0, 0, 0],
        "geometry": [
            {"shape": "box", "name": "apartment_main_walls", "size": [5.0, 4.5, 4.5], "position": [0, 2.25, 0], "color": "#1e3a5f"},
            {"shape": "roof", "name": "apartment_roof", "size": [5.0, 1.2, 4.5], "position": [0, 4.5, 0], "color": "#0d1117"},
            {"shape": "box", "name": "apartment_floor", "size": [5.2, 0.1, 4.7], "position": [0, 0.05, 0], "color": "#161b22"},
            {"shape": "box", "name": "apartment_door", "size": [1.2, 2.4, 0.1], "position": [0, 1.2, 2.3], "color": "#161b22"},
            {"shape": "box", "name": "apartment_window_left", "size": [1.5, 1.0, 0.05], "position": [-1.5, 2.5, 2.28], "color": "#fbbf24"},
            {"shape": "box", "name": "apartment_window_right", "size": [1.5, 1.0, 0.05], "position": [1.5, 2.5, 2.28], "color": "#fbbf24"},
            {"shape": "box", "name": "apartment_window_back", "size": [1.5, 1.0, 0.05], "position": [1.5, 2.5, -2.28], "color": "#fbbf24"},
            # === canonical props ===
            {"shape": "box", "name": "apartment_registry_kiosk_panel", "size": [0.6, 1.0, 0.1], "position": [2.2, 1.5, -2.28], "color": "#58a6ff"},
            {"shape": "box", "name": "apartment_leno_core_strip", "size": [0.4, 0.05, 0.4], "position": [-1.5, 0.5, -1.5], "color": "#14b8a6"},
            # === extras ===
            {"shape": "box", "name": "apartment_notebook", "size": [0.3, 0.05, 0.4], "position": [-1.5, 3.1, 2.4], "color": "#a16207"},
            {"shape": "box", "name": "apartment_bed", "size": [1.8, 0.4, 1.0], "position": [-1.8, 0.2, -1.5], "color": "#1e3a5f"},
            {"shape": "box", "name": "apartment_desk", "size": [1.2, 0.1, 0.6], "position": [1.5, 0.7, -1.5], "color": "#a16207"},
            {"shape": "cylinder", "name": "apartment_chair", "radius": 0.2, "height": 0.5, "position": [1.5, 0.25, -1.0], "color": "#92400e"},
            {"shape": "cylinder", "name": "apartment_lamp", "radius": 0.05, "height": 1.5, "position": [-2.0, 0.75, 0], "color": "#fbbf24"},
        ],
    },
    "market": {
        "kind": "location",
        "id": "market",
        "label": "Market Street",
        "footprint": {"x": 7.0, "z": 4.0},
        "spawn": [0, 0, 0],
        "geometry": [
            {"shape": "box", "name": "market_floor", "size": [7.0, 0.3, 4.0], "position": [0, 0.15, 0], "color": "#6b7280"},
            # === posts ===
            {"shape": "cylinder", "name": "market_post_nw", "radius": 0.15, "height": 2.5, "position": [-3.2, 1.25, -1.7], "color": "#92400e"},
            {"shape": "cylinder", "name": "market_post_ne", "radius": 0.15, "height": 2.5, "position": [3.2, 1.25, -1.7], "color": "#92400e"},
            {"shape": "cylinder", "name": "market_post_sw", "radius": 0.15, "height": 2.5, "position": [-3.2, 1.25, 1.7], "color": "#92400e"},
            {"shape": "cylinder", "name": "market_post_se", "radius": 0.15, "height": 2.5, "position": [3.2, 1.25, 1.7], "color": "#92400e"},
            {"shape": "box", "name": "market_roof", "size": [7.4, 0.15, 4.4], "position": [0, 2.6, 0], "color": "#1f2937"},
            # === canonical props ===
            {"shape": "sign", "name": "market_rumor_board", "size": [2.5, 1.5], "position": [0, 1.8, 1.95], "color": "#14b8a6"},
            {"shape": "box", "name": "market_data_canopy", "size": [1.5, 0.1, 1.5], "position": [-2.0, 2.0, 0], "color": "#58a6ff"},
            {"shape": "cylinder", "name": "market_lamp_left_glow", "radius": 0.1, "height": 2.0, "position": [-3.5, 1.0, 0], "color": "#fbbf24"},
            # === extras ===
            {"shape": "sign", "name": "market_courier_route_marker", "size": [0.8, 0.8], "position": [-2.5, 1.0, 0], "color": "#58a6ff"},
            {"shape": "box", "name": "market_crate_1", "size": [0.6, 0.5, 0.6], "position": [2.5, 0.25, -1.0], "color": "#a16207"},
            {"shape": "box", "name": "market_crate_2", "size": [0.6, 0.5, 0.6], "position": [2.5, 0.85, -1.0], "color": "#a16207"},
            {"shape": "box", "name": "market_crate_3", "size": [0.6, 0.5, 0.6], "position": [-2.5, 0.25, 1.0], "color": "#a16207"},
            {"shape": "cylinder", "name": "market_lamp_right", "radius": 0.1, "height": 2.0, "position": [3.5, 1.0, 0], "color": "#fbbf24"},
            {"shape": "box", "name": "market_stall_table", "size": [2.0, 0.1, 1.0], "position": [0, 1.0, -1.0], "color": "#a16207"},
        ],
    },
    "workshop": {
        "kind": "location",
        "id": "workshop",
        "label": "Malik's Workshop",
        "footprint": {"x": 6.5, "z": 5.0},
        "spawn": [0, 0, 0],
        "geometry": [
            {"shape": "box", "name": "workshop_main_walls", "size": [6.5, 3.5, 5.0], "position": [0, 1.75, 0], "color": "#6b7280"},
            {"shape": "roof", "name": "workshop_roof", "size": [6.5, 1.0, 5.0], "position": [0, 3.5, 0], "color": "#374151"},
            {"shape": "box", "name": "workshop_floor", "size": [6.7, 0.1, 5.2], "position": [0, 0.05, 0], "color": "#374151"},
            # === garage door ===
            {"shape": "box", "name": "workshop_garage_door", "size": [2.5, 2.8, 0.1], "position": [0, 1.4, 2.55], "color": "#92400e"},
            {"shape": "box", "name": "workshop_window_left", "size": [1.0, 0.8, 0.05], "position": [-2.5, 2.5, 2.48], "color": "#fbbf24"},
            {"shape": "box", "name": "workshop_window_right", "size": [1.0, 0.8, 0.05], "position": [2.5, 2.5, 2.48], "color": "#fbbf24"},
            # === canonical props ===
            {"shape": "sign", "name": "workshop_tool_wall", "size": [2.5, 1.2], "position": [2.0, 1.8, 2.48], "color": "#14b8a6"},
            {"shape": "box", "name": "workshop_chimney", "size": [0.5, 1.0, 0.5], "position": [2.5, 4.0, -1.5], "color": "#6b7280"},
            {"shape": "box", "name": "workshop_server_parts_crate_body", "size": [0.8, 0.6, 0.8], "position": [-2.5, 0.3, 1.5], "color": "#a16207"},
            # === extras ===
            {"shape": "box", "name": "workshop_repair_bench", "size": [2.0, 1.0, 0.8], "position": [-2.0, 0.5, 1.5], "color": "#a16207"},
            {"shape": "box", "name": "workshop_registry_kiosk", "size": [0.6, 1.5, 0.4], "position": [2.8, 0.75, 1.5], "color": "#1f6feb"},
            {"shape": "sign", "name": "workshop_sign", "size": [0.5, 0.3], "position": [2.8, 1.8, 1.71], "color": "#58a6ff"},
            {"shape": "cylinder", "name": "workshop_oil_drum", "radius": 0.25, "height": 0.7, "position": [1.5, 0.35, 1.5], "color": "#92400e"},
            {"shape": "cylinder", "name": "workshop_wrench_rack", "radius": 0.08, "height": 0.4, "position": [-2.0, 0.85, 1.5], "color": "#9ca3af"},
        ],
    },
    "district_square": {
        "kind": "location",
        "id": "district_square",
        "label": "District Square",
        "footprint": {"x": 8.0, "z": 8.0},
        "spawn": [0, 0, 0],
        "geometry": [
            {"shape": "box", "name": "district_square_floor", "size": [8.0, 0.1, 8.0], "position": [0, 0.05, 0], "color": "#9ca3af"},
            # === canonical props ===
            {"shape": "cylinder", "name": "district_square_obelisk", "radius": 0.4, "height": 3.5, "position": [0, 1.75, 0], "color": "#4ade80"},
            {"shape": "cylinder", "name": "district_square_mediation_terminal", "radius": 0.6, "height": 0.4, "position": [0, 3.95, 0], "color": "#166534"},
            {"shape": "sign", "name": "district_square_civic_screen", "size": [1.2, 0.8], "position": [0, 3.0, 0.81], "color": "#4ade80"},
            # === benches ===
            {"shape": "box", "name": "district_square_bench_ne", "size": [1.5, 0.4, 0.4], "position": [2.5, 0.2, 1.5], "color": "#a16207"},
            {"shape": "box", "name": "district_square_bench_sw", "size": [1.5, 0.4, 0.4], "position": [-2.5, 0.2, -1.5], "color": "#a16207"},
            {"shape": "box", "name": "district_square_bench_nw", "size": [1.5, 0.4, 0.4], "position": [-2.5, 0.2, 1.5], "color": "#a16207"},
            {"shape": "box", "name": "district_square_bench_se", "size": [1.5, 0.4, 0.4], "position": [2.5, 0.2, -1.5], "color": "#a16207"},
            # === lamp posts ===
            {"shape": "cylinder", "name": "district_square_lamp_ne", "radius": 0.1, "height": 3.0, "position": [3.5, 1.5, 3.5], "color": "#1f2937"},
            {"shape": "capsule", "name": "district_square_lamp_ne_glow", "radius": 0.2, "height": 0.4, "position": [3.5, 3.2, 3.5], "color": "#fbbf24"},
            {"shape": "cylinder", "name": "district_square_lamp_sw", "radius": 0.1, "height": 3.0, "position": [-3.5, 1.5, -3.5], "color": "#1f2937"},
            {"shape": "capsule", "name": "district_square_lamp_sw_glow", "radius": 0.2, "height": 0.4, "position": [-3.5, 3.2, -3.5], "color": "#fbbf24"},
            # === extras ===
            {"shape": "cylinder", "name": "district_square_fountain", "radius": 1.0, "height": 0.3, "position": [0, 0.15, 3.5], "color": "#58a6ff"},
            {"shape": "cylinder", "name": "district_square_tree_nw", "radius": 0.2, "height": 1.5, "position": [-3.5, 0.75, 3.5], "color": "#92400e"},
            {"shape": "sphere", "name": "district_square_tree_nw_crown", "radius": 0.6, "position": [-3.5, 2.0, 3.5], "color": "#4ade80"},
        ],
    },
}

CHARACTER_SPECS = {
    # Each NPC gets a unique silhouette via prop additions.
    # Capsule body + head + props distinguishes them at distance.
    "player": {
        "kind": "character",
        "id": "player",
        "label": "Player",
        "geometry": [
            {"shape": "capsule", "radius": 0.28, "height": 1.4, "position": [0, 0.7, 0], "color": "#1f6feb"},  # body (cool blue - protagonist)
            {"shape": "sphere", "radius": 0.22, "position": [0, 1.7, 0], "color": "#f4e4c1"},  # head
            {"shape": "box", "size": [0.45, 0.15, 0.3], "position": [0, 1.45, 0.25], "color": "#0d1117"},  # shoulder strap
        ],
    },
    "sara": {
        "kind": "character",
        "id": "sara",
        "label": "Sara",
        "geometry": [
            {"shape": "capsule", "radius": 0.27, "height": 1.35, "position": [0, 0.68, 0], "color": "#c97b3d"},  # warm apron
            {"shape": "sphere", "radius": 0.21, "position": [0, 1.65, 0], "color": "#f4e4c1"},
            {"shape": "cylinder", "radius": 0.15, "height": 0.5, "position": [0, 0.95, 0.22], "color": "#a16207"},  # apron
            {"shape": "box", "size": [0.08, 0.08, 0.08], "position": [0.1, 1.4, 0.18], "color": "#fbbf24"},  # earring
        ],
    },
    "malik": {
        "kind": "character",
        "id": "malik",
        "label": "Malik",
        "geometry": [
            {"shape": "capsule", "radius": 0.32, "height": 1.5, "position": [0, 0.75, 0], "color": "#6b7280"},  # work overalls
            {"shape": "sphere", "radius": 0.23, "position": [0, 1.8, 0], "color": "#d4a574"},
            {"shape": "box", "size": [0.5, 0.1, 0.05], "position": [0, 1.45, 0.3], "color": "#1f2937"},  # tool belt
            {"shape": "box", "size": [0.08, 0.15, 0.08], "position": [-0.18, 1.0, 0.32], "color": "#9ca3af"},  # wrench
        ],
    },
    "nadia": {
        "kind": "character",
        "id": "nadia",
        "label": "Nadia",
        "geometry": [
            {"shape": "capsule", "radius": 0.26, "height": 1.4, "position": [0, 0.7, 0], "color": "#1e3a5f"},  # dark hoodie
            {"shape": "sphere", "radius": 0.21, "position": [0, 1.7, 0], "color": "#8b5a3c"},
            {"shape": "capsule", "radius": 0.18, "height": 0.3, "position": [0, 1.9, 0], "color": "#0d1117"},  # hood pulled up
            {"shape": "box", "size": [0.06, 0.06, 0.06], "position": [0.08, 1.7, 0.21], "color": "#14b8a6"},  # teal earring (rumor source marker)
        ],
    },
    "rune": {
        "kind": "character",
        "id": "rune",
        "label": "Rune",
        "geometry": [
            {"shape": "capsule", "radius": 0.27, "height": 1.4, "position": [0, 0.7, 0], "color": "#7c2d12"},  # warm jacket
            {"shape": "sphere", "radius": 0.22, "position": [0, 1.7, 0], "color": "#f4e4c1"},
            {"shape": "box", "size": [0.4, 0.08, 0.08], "position": [0, 0.5, 0.0], "color": "#1f2937"},  # belt
            {"shape": "box", "size": [0.1, 0.4, 0.1], "position": [0.35, 1.0, 0.0], "color": "#1f6feb"},  # free-agent badge on shoulder
        ],
    },
    "amina": {
        "kind": "character",
        "id": "amina",
        "label": "Amina",
        "geometry": [
            {"shape": "capsule", "radius": 0.26, "height": 1.35, "position": [0, 0.68, 0], "color": "#4ade80"},  # mediator green
            {"shape": "sphere", "radius": 0.21, "position": [0, 1.65, 0], "color": "#d4a574"},
            {"shape": "box", "size": [0.45, 0.1, 0.05], "position": [0, 1.4, 0.27], "color": "#fbbf24"},  # sash
        ],
    },
    "omar": {
        "kind": "character",
        "id": "omar",
        "label": "Omar",
        "geometry": [
            {"shape": "capsule", "radius": 0.29, "height": 1.45, "position": [0, 0.72, 0], "color": "#374151"},  # ex-Registry investigator (gray)
            {"shape": "sphere", "radius": 0.22, "position": [0, 1.75, 0], "color": "#8b5a3c"},
            {"shape": "box", "size": [0.08, 0.18, 0.08], "position": [-0.2, 1.6, 0.22], "color": "#0d1117"},  # badge
        ],
    },
    "elias": {
        "kind": "character",
        "id": "elias",
        "label": "Elias",
        "geometry": [
            {"shape": "capsule", "radius": 0.27, "height": 1.4, "position": [0, 0.7, 0], "color": "#1f2937"},
            {"shape": "sphere", "radius": 0.21, "position": [0, 1.7, 0], "color": "#f4e4c1"},
            {"shape": "cylinder", "radius": 0.08, "height": 0.5, "position": [-0.2, 1.5, 0.18], "color": "#58a6ff"},  # audio recorder
        ],
    },
    "freja": {
        "kind": "character",
        "id": "freja",
        "label": "Freja",
        "geometry": [
            {"shape": "capsule", "radius": 0.27, "height": 1.35, "position": [0, 0.68, 0], "color": "#14b8a6"},  # teal jacket
            {"shape": "sphere", "radius": 0.21, "position": [0, 1.65, 0], "color": "#d4a574"},
            {"shape": "box", "size": [0.5, 0.1, 0.05], "position": [0, 1.0, 0.28], "color": "#0d1117"},  # utility belt
        ],
    },
    "yasin": {
        "kind": "character",
        "id": "yasin",
        "label": "Yasin",
        "geometry": [
            {"shape": "capsule", "radius": 0.28, "height": 1.4, "position": [0, 0.7, 0], "color": "#a16207"},  # trader brown
            {"shape": "sphere", "radius": 0.22, "position": [0, 1.7, 0], "color": "#8b5a3c"},
            {"shape": "box", "size": [0.3, 0.3, 0.2], "position": [0.35, 0.9, 0.15], "color": "#c97b3d"},  # market bag
        ],
    },
    "lina": {
        "kind": "character",
        "id": "lina",
        "label": "Lina",
        "geometry": [
            {"shape": "capsule", "radius": 0.24, "height": 1.3, "position": [0, 0.65, 0], "color": "#fbbf24"},  # young/amber
            {"shape": "sphere", "radius": 0.20, "position": [0, 1.6, 0], "color": "#f4e4c1"},
            {"shape": "box", "size": [0.35, 0.15, 0.2], "position": [-0.3, 0.9, 0.15], "color": "#0d1117"},  # messenger bag
        ],
    },
}

# Common humanoid base — used as fallback for any character not in CHARACTER_SPECS.
HUMANOID_BASE = {
    "kind": "character",
    "id": "humanoid-base",
    "label": "Humanoid",
    "geometry": [
        # === canonical humanoid props (named so v39 GLB assertions pass) ===
        {"shape": "capsule", "name": "humanoid_visor", "radius": 0.22, "height": 0.15, "position": [0, 1.85, 0], "color": "#1e3a5f"},
        {"shape": "sphere", "name": "humanoid_leno_core_badge", "radius": 0.04, "position": [0.1, 1.45, 0.21], "color": "#14b8a6"},
        {"shape": "capsule", "name": "humanoid_body", "radius": 0.28, "height": 1.4, "position": [0, 0.7, 0], "color": "#6b7280"},
        {"shape": "sphere", "name": "humanoid_head", "radius": 0.22, "position": [0, 1.7, 0], "color": "#d4a574"},
        {"shape": "box", "name": "humanoid_shoulder_strap", "size": [0.45, 0.15, 0.3], "position": [0, 1.45, 0.25], "color": "#0d1117"},
        {"shape": "box", "name": "humanoid_courier_bag", "size": [0.4, 0.35, 0.15], "position": [0.32, 0.7, 0.15], "color": "#92400e"},
        {"shape": "cylinder", "name": "humanoid_wrist_chip_l", "radius": 0.04, "height": 0.05, "position": [-0.32, 0.5, 0.0], "color": "#fbbf24"},
        {"shape": "cylinder", "name": "humanoid_wrist_chip_r", "radius": 0.04, "height": 0.05, "position": [0.32, 0.5, 0.0], "color": "#fbbf24"},
        {"shape": "cylinder", "name": "humanoid_boots_l", "radius": 0.12, "height": 0.15, "position": [-0.12, 0.075, 0.05], "color": "#1f2937"},
        {"shape": "cylinder", "name": "humanoid_boots_r", "radius": 0.12, "height": 0.15, "position": [0.12, 0.075, 0.05], "color": "#1f2937"},
        {"shape": "box", "name": "humanoid_belt", "size": [0.5, 0.08, 0.35], "position": [0, 0.4, 0.0], "color": "#1f2937"},
        {"shape": "box", "name": "humanoid_collar", "size": [0.4, 0.1, 0.4], "position": [0, 1.35, 0.0], "color": "#6b7280"},
    ],
}


# --- CLI ---

def build_one(spec: dict, out_dir: Path) -> dict:
    """Build a single GLB from spec, write to out_dir, validate."""
    scene, info = build_from_spec(spec)
    out_path = out_dir / f"{spec['id']}.glb"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Export as GLB (binary glTF) — Scene.export produces one mesh per node.
    glb_bytes = scene.export(file_type="glb")
    out_path.write_bytes(glb_bytes)

    # Validate
    report = validate_glb(out_path)
    report["id"] = spec["id"]
    report["kind"] = spec.get("kind")
    report["label"] = spec.get("label")
    report["primitiveCount"] = info["primitive_count"]
    report["namedCount"] = info["named_count"]
    return report


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="WorldMind GLB asset builder (procedural).")
    parser.add_argument("--out", default="assets/models",
                        help="output root directory (default: assets/models)")
    parser.add_argument("--kind", choices=["all", "location", "character", "prop"],
                        default="all", help="what to build")
    parser.add_argument("--id", help="build only this id")
    parser.add_argument("--validate", action="store_true",
                        help="only validate existing GLB files, don't regenerate")
    args = parser.parse_args(argv)

    out_root = Path(args.out)
    locations_dir = out_root / "locations"
    characters_dir = out_root / "characters"

    reports = []

    if args.validate:
        # Validate every GLB under out/locations and out/characters
        for sub in [locations_dir, characters_dir]:
            if not sub.exists():
                continue
            for p in sorted(sub.glob("*.glb")):
                r = validate_glb(p)
                r["id"] = p.stem
                reports.append(r)
        ok_count = sum(1 for r in reports if r.get("ok"))
        fail_count = len(reports) - ok_count
        print(json.dumps({
            "kind": "wm-asset-validate",
            "ok": fail_count == 0,
            "validated": len(reports),
            "okCount": ok_count,
            "failCount": fail_count,
            "reports": reports,
        }, indent=2))
        return 0 if fail_count == 0 else 1

    # Build locations
    if args.kind in ("all", "location"):
        for loc_id, spec in LOCATION_SPECS.items():
            if args.id and loc_id != args.id:
                continue
            r = build_one(spec, locations_dir)
            reports.append(r)

    # Build characters
    if args.kind in ("all", "character"):
        for char_id, spec in CHARACTER_SPECS.items():
            if args.id and char_id != args.id:
                continue
            r = build_one(spec, characters_dir)
            reports.append(r)
        # Humanoid fallback — only build if --id is not specified, or if --id=humanoid.
        if not args.id or args.id == "humanoid":
            r = build_one(HUMANOID_BASE, characters_dir)
        # Rename the file to humanoid.glb
        humanoid_src = characters_dir / "humanoid-base.glb"
        humanoid_dst = characters_dir / "humanoid.glb"
        if humanoid_src.exists():
            humanoid_dst.write_bytes(humanoid_src.read_bytes())
            humanoid_src.unlink()
        r["id"] = "humanoid"
        reports.append(r)

    ok_count = sum(1 for r in reports if r.get("ok"))
    fail_count = len(reports) - ok_count
    # Defensive dedup: if for any reason the same (id, kind, path) appears
    # twice, keep only the first occurrence. This guards against argparse
    # or import-graph quirks that could cause double-builds.
    seen = set()
    deduped = []
    for r in reports:
        key = (r.get("id"), r.get("kind"), r.get("path"))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(r)
    reports = deduped
    ok_count = sum(1 for r in reports if r.get("ok"))
    fail_count = len(reports) - ok_count
    print(json.dumps({
        "kind": "wm-asset-build",
        "ok": fail_count == 0,
        "built": len(reports),
        "okCount": ok_count,
        "failCount": fail_count,
        "reports": reports,
    }, indent=2))
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))