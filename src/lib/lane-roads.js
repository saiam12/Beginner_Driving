import {readRoadJSON} from './road-search';

export const LANE_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
export const LANE_MIN_ZOOM = 13;
export const LANE_COLOR = '#2866e9';
const TILE_ZOOM = 12, MAX_TILES = 128, MAX_FEATURES = 12000;
let manifest;
const cache = new Map();

export function laneMatches(lanes, selected) {
 return Number.isInteger(lanes) && lanes > 0 && selected.includes(Math.min(lanes, 7));
}
export function tileAt(lng, lat) {
 const n = 2 ** TILE_ZOOM, radians = Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180;
 return [Math.floor((lng + 180) / 360 * n), Math.floor((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * n)];
}
export function viewportTiles(bounds) {
 const [west, south, east, north] = bounds;
 const [x0, y0] = tileAt(west, north), [x1, y1] = tileAt(east, south);
 if ((x1 - x0 + 1) * (y1 - y0 + 1) > MAX_TILES) return null;
 const keys = [];
 for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) keys.push(`${x}/${y}`);
 return keys;
}
export function filterLaneFeatures(features, bounds, selected) {
 const unique = new Map();
 for (const feature of features) {
  const p = feature.properties, b = p.bounds;
  if (laneMatches(p.lanes, selected) && b[0] <= bounds[2] && b[2] >= bounds[0] && b[1] <= bounds[3] && b[3] >= bounds[1]) unique.set(p.linkId, feature);
 }
 return [...unique.values()];
}
export function centerFirst(features, bounds) {
 const lng = (bounds[0] + bounds[2]) / 2, lat = (bounds[1] + bounds[3]) / 2;
 const longitudeScale = Math.cos(lat * Math.PI / 180);
 const distance = feature => {
  const b = feature.properties.bounds;
  return (((b[0] + b[2]) / 2 - lng) * longitudeScale) ** 2 + ((b[1] + b[3]) / 2 - lat) ** 2;
 };
 return features.map(feature=>({feature,distance:distance(feature)})).sort((a,b)=>a.distance-b.distance).map(item=>item.feature);
}
export async function loadLaneRoads(bounds, selected, {signal} = {}) {
 const keys = viewportTiles(bounds);
 if (!keys) return {features: [], tooWide: true};
 if (!manifest) manifest = await readRoadJSON('lanes/manifest.json', signal);
 signal?.throwIfAborted();
 const pending = keys.filter(key => selected.some(lane => manifest.tiles[key]?.[String(lane)]));
 let offset = 0;
 const results = [];
 await Promise.all(Array.from({length: Math.min(6, pending.length)}, async () => {
  while (offset < pending.length) {
   signal?.throwIfAborted();
   const key = pending[offset++];
   let features = cache.get(key);
   if (!features) {
    features = await readRoadJSON(`lanes/${key}.jsonl.gz`, signal, true);
    signal?.throwIfAborted();
    cache.set(key, features);
    if (cache.size > 128) cache.delete(cache.keys().next().value);
   }
   results.push(...filterLaneFeatures(features, bounds, selected));
  }
 }));
 signal?.throwIfAborted();
 const features = filterLaneFeatures(results, bounds, selected);
 return features.length > MAX_FEATURES ? {features: [], tooWide: true} : {features:centerFirst(features,bounds), tooWide: false};
}
export function laneTooltip(p) {
 return `${p.roadName || '이름 없는 도로'}\n${p.lanes}차로\nLINK_ID: ${p.linkId}\n시작 노드: ${p.fNode} · 끝 노드: ${p.tNode}`;
}
