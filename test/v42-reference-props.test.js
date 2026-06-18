import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrapWorld } from '../src/play/play-engine.js';
import { build3DVisualCues, validate3DVisualCues } from '../src/play/district-3d-layout.js';
import { PROP_MODEL_ASSETS, PROP_SOURCE_REFERENCES, resolvePropModelPath } from '../src/play/prop-model-assets.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

test('v42: reference manifest and normalized 1.1 materials exist', () => {
  const manifestPath = join(REPO, 'assets/reference/3d-v11/manifest.json');
  assert.ok(existsSync(manifestPath));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.kind, 'worldmind_3d_reference_manifest');
  assert.equal(manifest.version, 2);
  assert.equal(manifest.references.length, 22);
  assert.equal(manifest.duplicateSources.length, 4);
  assert.equal(manifest.references.length + manifest.duplicateSources.length, 26);
  assert.ok(manifest.duplicateSources.every((item) => item.duplicateOf));
  assert.equal(manifest.materials.length, 6);
  for (const material of manifest.materials) {
    assert.ok(existsSync(join(REPO, ...material.asset.split('/'))), material.asset);
  }
});

test('v42: reusable prop GLBs resolve and retain source lineage', () => {
  for (const [id, path] of Object.entries(PROP_MODEL_ASSETS)) {
    assert.equal(resolvePropModelPath(id), path);
    assert.ok(existsSync(join(REPO, ...path.split('/'))), path);
    assert.ok(PROP_SOURCE_REFERENCES[id]?.startsWith('assets/reference/3d-v11/'));
  }
});

test('v42: visualCues v5 exposes authored interactive props', () => {
  const cues = build3DVisualCues(bootstrapWorld());
  assert.equal(cues.version, 5);
  assert.equal(validate3DVisualCues(cues).ok, true);
  assert.ok(cues.props.length >= 15);
  for (const prop of cues.props) {
    assert.equal(prop.renderMode, 'mesh3d');
    assert.equal(prop.position.length, 3);
    assert.equal(prop.rotation.length, 3);
    assert.ok(prop.modelUrl.endsWith('.glb'));
    assert.ok(prop.command);
    assert.ok(prop.sourceRef?.endsWith('.webp'));
  }
});

test('v42: second reference-driven tranche has authored GLB scene nodes', () => {
  const expectedNodes = {
    autonomous_pod: 'autonomous_pod_smart_glass_canopy',
    transit_shuttle: 'transit_shuttle_route_strip',
    access_control_panel: 'access_control_panel_reader',
    trash_compactor: 'trash_compactor_capacity_sensor',
    power_junction_box: 'power_junction_box_diagnostic_panel',
    smart_chair: 'smart_chair_haptic_control',
    foldable_table: 'foldable_table_storage',
    sensor_lamp: 'sensor_lamp_head',
    vertical_garden: 'vertical_garden_irrigation_status'
  };
  for (const [id, nodeName] of Object.entries(expectedNodes)) {
    const relPath = PROP_MODEL_ASSETS[id];
    const data = readFileSync(join(REPO, ...relPath.split('/')));
    assert.equal(data.toString('utf8', 0, 4), 'glTF', relPath);
    const jsonLength = data.readUInt32LE(12);
    const json = JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8').trim());
    const names = (json.nodes ?? []).map((node) => node.name);
    assert.ok(names.includes(nodeName), `${relPath} missing ${nodeName}`);
  }
});
