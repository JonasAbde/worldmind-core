/**
 * District walk paths for 3D clients — BFS over visualCues edges, arc waypoints, follow camera.
 */

import { build3DVisualCues } from './district-3d-layout.js';

const MS_PER_UNIT = 280;
const MIN_DURATION_MS = 400;
const MAX_DURATION_MS = 8000;
const SEGMENT_STEPS = 5;
const ARC_HEIGHT = 0.22;
const PLAYER_Y = 0.1;
const CAMERA_BEHIND = 4.5;
const CAMERA_EYE_Y = 1.65;
const CAMERA_TARGET_Y = 1.4;

function buildAdjacency(edges) {
  const adj = new Map();
  for (const edge of edges || []) {
    const { from, to } = edge;
    if (!from || !to) continue;
    if (!adj.has(from)) adj.set(from, []);
    if (!adj.has(to)) adj.set(to, []);
    adj.get(from).push(to);
    adj.get(to).push(from);
  }
  return adj;
}

export function findWalkPath(adjacency, fromId, toId) {
  if (!fromId || !toId) return [];
  if (fromId === toId) return [fromId];
  const queue = [[fromId]];
  const visited = new Set([fromId]);
  while (queue.length) {
    const path = queue.shift();
    const node = path[path.length - 1];
    for (const neighbor of adjacency.get(node) || []) {
      if (neighbor === toId) return [...path, neighbor];
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }
  return [fromId, toId];
}

function dist3(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
}

function lerpArc(from, to, t) {
  const arc = ARC_HEIGHT * 4 * t * (1 - t);
  return [
    from[0] + ((to[0] - from[0]) * t),
    PLAYER_Y + arc,
    from[2] + ((to[2] - from[2]) * t)
  ];
}

function segmentWaypoints(fromPos, toPos) {
  const points = [];
  for (let step = 1; step <= SEGMENT_STEPS; step++) {
    points.push(lerpArc(fromPos, toPos, step / SEGMENT_STEPS));
  }
  return points;
}

export function buildWalkGraphFromCues(visualCues) {
  const nodes = {};
  for (const loc of visualCues?.locations || []) {
    const anchor = loc.walkAnchor || loc.position;
    nodes[loc.id] = { walkAnchor: anchor, position: loc.position };
  }
  return {
    nodes,
    edges: (visualCues?.edges || []).map((edge) => ({ from: edge.from, to: edge.to }))
  };
}

function resolveAnchor(walkGraph, locationId) {
  const node = walkGraph?.nodes?.[locationId];
  const anchor = node?.walkAnchor || node?.position;
  if (!anchor) return null;
  return [anchor[0], PLAYER_Y, anchor[2]];
}

function cameraBehind(position, previous) {
  const dx = position[0] - (previous?.[0] ?? position[0]);
  const dz = position[2] - (previous?.[2] ?? (position[2] + 1));
  const len = Math.hypot(dx, dz) || 1;
  const nx = dx / len;
  const nz = dz / len;
  return {
    eye: [
      position[0] - (nx * CAMERA_BEHIND),
      CAMERA_EYE_Y,
      position[2] - (nz * CAMERA_BEHIND)
    ],
    target: [position[0], CAMERA_TARGET_Y, position[2]]
  };
}

/**
 * Build client-ready walk animation for a successful move command.
 * @returns {object|null}
 */
export function buildWalkAnimation(world, fromLocationId, toLocationId, options = {}) {
  if (!fromLocationId || !toLocationId) return null;
  if (fromLocationId === toLocationId) return null;
  if (fromLocationId === toLocationId) return null;

  const visualCues = options.visualCues ?? build3DVisualCues(world, options);
  const walkGraph = options.walkGraph ?? visualCues.walkGraph ?? buildWalkGraphFromCues(visualCues);
  const adjacency = buildAdjacency(walkGraph.edges);
  const path = findWalkPath(adjacency, fromLocationId, toLocationId);

  const start = resolveAnchor(walkGraph, fromLocationId);
  const end = resolveAnchor(walkGraph, toLocationId);
  if (!start || !end) return null;

  const waypoints = [start];
  let totalDistance = 0;
  let previousAnchor = start;

  for (let i = 1; i < path.length; i++) {
    const anchor = resolveAnchor(walkGraph, path[i]);
    if (!anchor) continue;
    const segment = segmentWaypoints(previousAnchor, anchor);
    for (const point of segment) {
      totalDistance += dist3(waypoints[waypoints.length - 1], point);
      waypoints.push(point);
    }
    previousAnchor = anchor;
  }

  if (waypoints.length === 1 && fromLocationId !== toLocationId) {
    const segment = segmentWaypoints(start, end);
    for (const point of segment) {
      totalDistance += dist3(waypoints[waypoints.length - 1], point);
      waypoints.push(point);
    }
  }

  const last = waypoints[waypoints.length - 1];
  const prev = waypoints.length > 1 ? waypoints[waypoints.length - 2] : start;
  const durationMs = Math.min(
    MAX_DURATION_MS,
    Math.max(MIN_DURATION_MS, Math.round(totalDistance * MS_PER_UNIT))
  );

  return {
    kind: 'worldmind_walk_animation',
    version: 1,
    from: fromLocationId,
    to: toLocationId,
    path,
    waypoints,
    durationMs,
    camera: cameraBehind(last, prev)
  };
}
