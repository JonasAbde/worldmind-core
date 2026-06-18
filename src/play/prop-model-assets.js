/** WorldMind 1.1 reusable prop GLBs authored from the 3D reference sheets. */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

export const PROP_MODEL_ASSETS = Object.freeze({
  street_terminal: 'assets/models/props/street_terminal.glb',
  holo_signpost: 'assets/models/props/holo_signpost.glb',
  smart_bench: 'assets/models/props/smart_bench.glb',
  vending_unit: 'assets/models/props/vending_unit.glb',
  public_data_node: 'assets/models/props/public_data_node.glb',
  delivery_drone: 'assets/models/props/delivery_drone.glb',
  autonomous_pod: 'assets/models/props/autonomous_pod.glb',
  transit_shuttle: 'assets/models/props/transit_shuttle.glb',
  access_control_panel: 'assets/models/props/access_control_panel.glb',
  trash_compactor: 'assets/models/props/trash_compactor.glb',
  power_junction_box: 'assets/models/props/power_junction_box.glb',
  smart_chair: 'assets/models/props/smart_chair.glb',
  foldable_table: 'assets/models/props/foldable_table.glb',
  sensor_lamp: 'assets/models/props/sensor_lamp.glb',
  vertical_garden: 'assets/models/props/vertical_garden.glb'
});

export const PROP_SOURCE_REFERENCES = Object.freeze({
  street_terminal: 'assets/reference/3d-v11/interactive-props.webp',
  holo_signpost: 'assets/reference/3d-v11/interactive-props.webp',
  smart_bench: 'assets/reference/3d-v11/street-prop-render.webp',
  vending_unit: 'assets/reference/3d-v11/street-prop-render.webp',
  public_data_node: 'assets/reference/3d-v11/interactive-props.webp',
  delivery_drone: 'assets/reference/3d-v11/delivery-drone.webp',
  autonomous_pod: 'assets/reference/3d-v11/autonomous-pod.webp',
  transit_shuttle: 'assets/reference/3d-v11/transit-vehicle-render.webp',
  access_control_panel: 'assets/reference/3d-v11/interactive-props.webp',
  trash_compactor: 'assets/reference/3d-v11/interactive-props.webp',
  power_junction_box: 'assets/reference/3d-v11/interactive-props.webp',
  smart_chair: 'assets/reference/3d-v11/interior-furniture.webp',
  foldable_table: 'assets/reference/3d-v11/interior-furniture.webp',
  sensor_lamp: 'assets/reference/3d-v11/interior-furniture.webp',
  vertical_garden: 'assets/reference/3d-v11/green-shelter-environment.webp'
});

export function resolvePropModelPath(propId) {
  const path = PROP_MODEL_ASSETS[propId] ?? null;
  if (!path) return null;
  return existsSync(join(REPO_ROOT, ...path.split('/'))) ? path : null;
}
