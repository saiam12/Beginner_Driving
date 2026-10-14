import {readRoadJSON,accidentLabel} from './road-search';
import {applyItsRoadAccidents} from './road-accidents.js';

export const LANE_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
export const LANE_MIN_ZOOM = 13;
export const LANE_COLOR = '#2866e9';
export const LANE_COLORS = ['#bfdbfe','#93c5fd','#60a5fa','#3b82f6','#2563eb','#1d4ed8','#1e3a8a'];
export function laneColor(lanes) {
 return Number.isInteger(lanes)&&lanes>0?LANE_COLORS[Math.min(lanes,7)-1]:null;
}
const TILE_ZOOM = 12, MAX_TILES = 128, MAX_FEATURES = 12000;
const manifests = new Map();
const cache = new Map();
let itsAccidents;

export function laneMatches(lanes, selected) {
 return Number.isInteger(lanes) && lanes > 0 && selected.includes(Math.min(lanes, 7));
}
export function tileAt(lng, lat) {
 const n = 2 ** TILE_ZOOM, radians = Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180;
 return [Math.floor((lng + 180) / 360 * n), Math.floor((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * n)];
}
export function viewportTiles(bounds,unlimited=false) {
 const [west, south, east, north] = bounds;
 const [x0, y0] = tileAt(west, north), [x1, y1] = tileAt(east, south);
 if ((x1 - x0 + 1) * (y1 - y0 + 1) > MAX_TILES&&!unlimited) return null;
 const keys = [];
 for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) keys.push(`${x}/${y}`);
 return keys;
}
export function filterLaneFeatures(features, bounds, selected) {
 const unique = new Map();
 for (const feature of features) {
  const p = feature.properties, b = p.bounds;
  if ((selected == null || laneMatches(p.lanes, selected)) && b[0] <= bounds[2] && b[2] >= bounds[0] && b[1] <= bounds[3] && b[3] >= bounds[1]) unique.set(p.linkId, feature);
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
export async function loadLaneRoads(bounds, selected = null, {signal,regional=false,identifierSystem='level5.5'} = {}) {
 signal?.throwIfAborted();
 if(selected?.length===0)return {features:[],tooWide:false};
 const folder=identifierSystem==='its'?'lanes-its':'lanes';
 const keys = viewportTiles(bounds,regional);
 if (!keys) return {features: [], tooWide: true};
 if (!manifests.has(folder)) {const data=await readRoadJSON(`${folder}/manifest.json`, signal);if(data.identifierSystem!==identifierSystem)throw new Error('도로 데이터가 갱신되었습니다. 페이지를 새로고침해주세요.');manifests.set(folder,data);}
 const manifest=manifests.get(folder);
 if(identifierSystem==='its'&&!itsAccidents)itsAccidents=await readRoadJSON('accidents-2024-daegu-its.json',signal);
 signal?.throwIfAborted();
 const pending = keys.filter(key => selected == null ? !!manifest.tiles[key] : selected.some(lane => manifest.tiles[key]?.[String(lane)]));
 let offset = 0;
 const results = [];
 await Promise.all(Array.from({length: Math.min(6, pending.length)}, async () => {
  while (offset < pending.length) {
   signal?.throwIfAborted();
   const key = pending[offset++];
   const cacheKey=`${folder}/${key}`;
   let features = cache.get(cacheKey);
   if (!features) {
    features = await readRoadJSON(`${folder}/${key}.jsonl.gz`, signal, true);
    if(identifierSystem==='its')features=applyItsRoadAccidents(features.map(feature=>({...feature,properties:{...feature.properties,identifierSystem:'its',sourceDate:manifest.sourceDate}})),itsAccidents);
    signal?.throwIfAborted();
    cache.set(cacheKey, features);
    if (cache.size > 128) cache.delete(cache.keys().next().value);
   }
   results.push(...filterLaneFeatures(features, bounds, selected));
  }
 }));
 signal?.throwIfAborted();
 const features = filterLaneFeatures(results, bounds, selected);
 if(!regional&&features.length>MAX_FEATURES)return {features:[],tooWide:true};
 return {features:centerFirst(features,bounds),tooWide:false};
}
export function loadDisplayLaneRoads(bounds,selected,options={}) {
 return loadLaneRoads(bounds,selected,{...options,identifierSystem:'its'});
}
export function laneTooltip(p) {
 if(p.identifierSystem==='its') {
  const accidents=p.accidentCount==null?'2024년 사고 자료: 대구 자료 범위 밖':`2024년 사고 ${p.accidentCount}건 · ${(p.accidentCount/(p.accidentLengthMeters/1000)).toFixed(1)}건/km\n15m 이내 최근접 도로 추정 · 사고 진행 방향 미확정`;
  return `${p.roadName||'이름 없는 도로'}\n${p.lanes}차로 (진행 방향 기준)\n${accidents}\nITS 표준노드링크 · ${p.sourceDate}\nITS LINK ID: ${p.linkId}\n시작 노드: ${p.fNode} · 끝 노드: ${p.tNode}\n차로 확인용 · 교통량 자료 미연결`;
 }
 return `${p.roadName || '이름 없는 도로'}\n${p.lanes==null?'차로 정보 없음':p.lanes+'차로'}\nLevel 5.5 LINK ID: ${p.linkId}\n시작 노드: ${p.fNode} · 끝 노드: ${p.tNode}\n${accidentLabel(p)}`;
}
