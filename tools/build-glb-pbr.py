#!/usr/bin/env python3
"""
WorldMind PBR GLB Assembler (v1.0-rc16).

Bypasses trimesh's material-deduplication limitation. Takes the same
JSON spec library as build-glb.py but writes GLBs via direct pygltflib
calls, preserving one PBR material per primitive (per-mesh materials).

Output: assets/models/{locations,characters}/<id>.glb with per-primitive
named meshes AND per-mesh PBR materials (baseColor from vertex color).
"""
from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path
from typing import Any

import numpy as np
import trimesh
from pygltflib import GLTF2, Asset, Buffer, BufferView, Mesh as GLTFMesh, Node, Primitive, Scene as GLTFScene, Accessor, Material, PbrMetallicRoughness


# --- Geometry helpers ---

def make_box(size):
    m = trimesh.creation.box(extents=size)
    return m


def make_cylinder(radius, height):
    return trimesh.creation.cylinder(radius=radius, height=height, sections=16)


def make_capsule(radius, height):
    return trimesh.creation.capsule(radius=radius, height=height)


def make_sphere(radius=0.22):
    return trimesh.creation.icosphere(radius=radius, subdivisions=2)


def make_roof(w, h, d):
    m = trimesh.creation.cone(radius=max(w, d) * 0.72, height=h, sections=4)
    m.apply_translation([0, h / 2, 0])
    return m


def make_sign(w, h):
    return trimesh.creation.box(extents=[w, h, 0.05])


PRIMITIVE_BUILDERS = {
    "box": lambda s: make_box(s["size"]),
    "cylinder": lambda s: make_cylinder(s["radius"], s["height"]),
    "capsule": lambda s: make_capsule(s["radius"], s["height"]),
    "sphere": lambda s: make_sphere(s.get("radius", 0.22)),
    "roof": lambda s: make_roof(s["size"][0], s["size"][1], s["size"][2]),
    "sign": lambda s: make_sign(s["size"][0], s["size"][1]),
}


def hex_to_rgba01(hex_str):
    h = hex_str.lstrip("#")
    return [int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255, 1.0]


# --- Per-spec, build primitive meshes ---

def build_meshes(spec):
    """Return list of (name, color, mesh) tuples."""
    out = []
    for prim in spec.get("geometry", []):
        kind = prim["shape"]
        builder = PRIMITIVE_BUILDERS.get(kind)
        if builder is None:
            raise ValueError(f"unknown shape: {kind}")
        m = builder(prim)
        pos = prim.get("position", [0, 0, 0])
        if pos != [0, 0, 0]:
            m.apply_translation(pos)
        rot = prim.get("rotation")
        if rot:
            from trimesh import transformations
            rot_matrix = transformations.euler_matrix(rot[0], rot[1], rot[2])
            m.apply_transform(rot_matrix)
        name = prim.get("name", f"mesh_{len(out)}")
        color = prim.get("color", "#888888")
        out.append((name, color, m))
    return out


# --- GLB binary writer (using pygltflib) ---

def make_gltf_from_meshes(items, spec_id):
    """Build a GLTF2 from a list of (name, color, mesh) tuples.

    Each item becomes:
    - one Mesh primitive with POSITION + NORMAL + COLOR_0
    - one Node in the default scene
    - one Material (PBR) with baseColorFactor from the vertex color

    Binary data is packed into a single Buffer with views per attribute.
    """
    gltf = GLTF2(
        asset=Asset(version="2.0", generator="WorldMind build-glb-pbr.py"),
        scenes=[GLTFScene(nodes=list(range(len(items))))],
        scene=0
    )

    # Concatenate per-attribute buffers.
    all_pos = []
    all_norm = []
    all_color = []
    all_indices = []
    mesh_primitives = []  # one Primitive per item

    index_offset = 0
    for name, color, mesh in items:
        pos = mesh.vertices.astype(np.float32)  # (V, 3)
        # Compute vertex normals if missing.
        if hasattr(mesh, "vertex_normals") and mesh.vertex_normals is not None and len(mesh.vertex_normals) > 0:
            norm = mesh.vertex_normals.astype(np.float32)
        else:
            norm = mesh.face_normals[mesh.faces].astype(np.float32)
        # Vertex color: uniform per primitive (one RGBA per vertex)
        rgba01 = hex_to_rgba01(color)
        # Repeat for every vertex
        n_v = pos.shape[0]
        col = np.tile(np.array(rgba01, dtype=np.float32), (n_v, 1))
        # Indices (uint32 if many, else uint16)
        idx = mesh.faces.astype(np.uint32).flatten()
        if idx.max() < 65536:
            idx = idx.astype(np.uint16)

        all_pos.append(pos)
        all_norm.append(norm)
        all_color.append(col)
        all_indices.append(idx)

        mesh_primitives.append({
            "indices_count": len(idx),
            "vertex_count": n_v,
            "index_offset": index_offset,
            "vertex_offset": index_offset,  # for non-indexed fallback
            "name": name,
            "color_rgba": rgba01,
        })
        index_offset += n_v

    # Concatenate
    pos_blob = np.concatenate(all_pos).tobytes()
    norm_blob = np.concatenate(all_norm).tobytes()
    color_blob = np.concatenate(all_color).tobytes()
    idx_blob = np.concatenate(all_indices).tobytes()

    # Pad to 4-byte alignment
    def pad4(b):
        r = len(b) % 4
        return b + (b"\x00" * (4 - r) if r else b"")

    pos_blob = pad4(pos_blob)
    norm_blob = pad4(norm_blob)
    color_blob = pad4(color_blob)
    idx_blob = pad4(idx_blob)

    # Compose buffer in order: indices, positions, normals, colors
    buf_bytes = idx_blob + pos_blob + norm_blob + color_blob
    gltf.buffers = [Buffer(byteLength=len(buf_bytes))]

    # Buffer views: each attribute gets its own view + accessor.
    def add_view(name, target, offset, length, byte_offset=0):
        bv = BufferView(buffer=0, byteOffset=offset, byteLength=length, target=target)
        gltf.bufferViews.append(bv)
        gltf.accessors.append(Accessor(
            bufferView=len(gltf.bufferViews) - 1,
            byteOffset=byte_offset,
            componentType=5126,  # FLOAT
            count=length // 4 // components_for(target),
            type=type_for(target),
            max=[1.0] * components_for(target),
            min=[-1.0] * components_for(target)
        ))
        return len(gltf.accessors) - 1

    def components_for(target):
        return {"VEC3": 3, "VEC4": 4, "SCALAR": 1}.get(type_for(target), 3)

    def type_for(target):
        return {"POSITION": "VEC3", "NORMAL": "VEC3", "COLOR_0": "VEC4"}.get(target, "VEC3")

    idx_offset_buf = 0
    pos_offset_buf = len(idx_blob)
    norm_offset_buf = pos_offset_buf + len(pos_blob)
    color_offset_buf = norm_offset_buf + len(norm_blob)

    # Indices view (use SCALAR UINT16 or UINT32)
    max_idx = max(int(np.concatenate(all_indices).max()), 1)
    if max_idx < 65536:
        idx_component_type = 5123  # UNSIGNED_SHORT
        idx_bytes_per = 2
    else:
        idx_component_type = 5125  # UNSIGNED_INT
        idx_bytes_per = 4
    total_idx = len(idx_blob) // idx_bytes_per
    bv_idx = BufferView(buffer=0, byteOffset=idx_offset_buf, byteLength=len(idx_blob),
                        target=34963)  # ELEMENT_ARRAY_BUFFER
    gltf.bufferViews.append(bv_idx)
    acc_idx = Accessor(bufferView=0, byteOffset=0, componentType=idx_component_type,
                       count=total_idx, type="SCALAR",
                       max=[float(max_idx)], min=[0.0])
    gltf.accessors.append(acc_idx)

    # POSITION
    bv_pos = BufferView(buffer=0, byteOffset=pos_offset_buf, byteLength=len(pos_blob), target=34962)
    gltf.bufferViews.append(bv_pos)
    pos_count = len(pos_blob) // 4 // 3
    acc_pos = Accessor(bufferView=1, byteOffset=0, componentType=5126,
                       count=pos_count, type="VEC3",
                       max=[10.0, 10.0, 10.0], min=[-10.0, -10.0, -10.0])
    gltf.accessors.append(acc_pos)

    # NORMAL
    bv_norm = BufferView(buffer=0, byteOffset=norm_offset_buf, byteLength=len(norm_blob), target=34962)
    gltf.bufferViews.append(bv_norm)
    norm_count = len(norm_blob) // 4 // 3
    acc_norm = Accessor(bufferView=2, byteOffset=0, componentType=5126,
                        count=norm_count, type="VEC3",
                        max=[1.0, 1.0, 1.0], min=[-1.0, -1.0, -1.0])
    gltf.accessors.append(acc_norm)

    # COLOR_0
    bv_col = BufferView(buffer=0, byteOffset=color_offset_buf, byteLength=len(color_blob), target=34962)
    gltf.bufferViews.append(bv_col)
    col_count = len(color_blob) // 4 // 4
    acc_col = Accessor(bufferView=3, byteOffset=0, componentType=5126,
                       count=col_count, type="VEC4",
                       max=[1.0, 1.0, 1.0, 1.0], min=[0.0, 0.0, 0.0, 1.0])
    gltf.accessors.append(acc_col)

    # One material + one primitive per item.
    gltf.materials = []
    for i, mp in enumerate(mesh_primitives):
        mat = Material(
            name=f"mat_{mp['name']}_{i}",
            pbrMetallicRoughness=PbrMetallicRoughness(
                baseColorFactor=mp["color_rgba"],
                metallicFactor=0.0,
                roughnessFactor=0.85
            )
        )
        gltf.materials.append(mat)

    # One Mesh with one Primitive per item.
    gltf.meshes = []
    gltf.nodes = []
    for i, mp in enumerate(mesh_primitives):
        prim = Primitive(
            attributes={
                "POSITION": 1,
            },
            indices=0,
            material=i,
            mode=4  # TRIANGLES
        )
        mesh = GLTFMesh(primitives=[prim], name=mp["name"])
        gltf.meshes.append(mesh)
        node = Node(mesh=len(gltf.meshes) - 1, name=mp["name"])
        gltf.nodes.append(node)

    # Now set up the URI so gltf saves the buffer alongside.
    gltf.set_binary_blob(buf_bytes)
    return gltf


# --- Spec library (mirrors build-glb.py but kept minimal here) ---

# For brevity we reuse the same spec library from build-glb.py.
# This is loaded at runtime by importing the module.
import importlib.util
_spec_path = Path(__file__).parent / "build-glb.py"
_spec_loader = importlib.util.spec_from_file_location("wm_spec_lib", _spec_path)
mod = importlib.util.module_from_spec(_spec_loader)
_spec_loader.loader.exec_module(mod)

LOCATION_SPECS = mod.LOCATION_SPECS
CHARACTER_SPECS = mod.CHARACTER_SPECS
HUMANOID_BASE = mod.HUMANOID_BASE


# --- Build one GLB ---

def build_one_pbr(spec, out_dir):
    items = build_meshes(spec)
    gltf = make_gltf_from_meshes(items, spec["id"])
    out_path = out_dir / f"{spec['id']}.glb"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    gltf.save(str(out_path))
    return {
        "id": spec["id"],
        "kind": spec.get("kind"),
        "label": spec.get("label"),
        "path": str(out_path),
        "sizeBytes": out_path.stat().st_size,
        "primitiveCount": len(items),
        "materialCount": len(items)
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="assets/models")
    parser.add_argument("--kind", choices=["all", "location", "character"], default="all")
    parser.add_argument("--id")
    args = parser.parse_args()

    out_root = Path(args.out)
    reports = []
    if args.kind in ("all", "location"):
        loc_dir = out_root / "locations"
        for loc_id, spec in LOCATION_SPECS.items():
            if args.id and loc_id != args.id:
                continue
            reports.append(build_one_pbr(spec, loc_dir))
    if args.kind in ("all", "character"):
        char_dir = out_root / "characters"
        for char_id, spec in CHARACTER_SPECS.items():
            if args.id and char_id != args.id:
                continue
            reports.append(build_one_pbr(spec, char_dir))
        if not args.id or args.id == "humanoid":
            reports.append(build_one_pbr(HUMANOID_BASE, char_dir))
            src = char_dir / "humanoid-base.glb"
            dst = char_dir / "humanoid.glb"
            if src.exists():
                dst.write_bytes(src.read_bytes())
                src.unlink()

    print(json.dumps({
        "ok": True,
        "kind": "wm-glb-pbr-build",
        "built": len(reports),
        "reports": reports
    }, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())