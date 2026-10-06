import {renderLaneBatches} from './laneRenderBatch.js';

// A LINK keeps its map object while it remains in the requested viewport.
export function createIncrementalLaneLayer(create, removeMany, onRendering) {
 const objects = new Map();
 let cancel = () => {}, disposed = false;
 return {
  update(features) {
   if (disposed) return;
   cancel();
   const desired = new Set(features.map(feature=>feature.properties.linkId));
   const removed = [];
   for (const [id, object] of objects) {
    if (!desired.has(id)) {removed.push(object);objects.delete(id);}
   }
   if (removed.length) removeMany(removed);
   const missing = features.filter(feature=>!objects.has(feature.properties.linkId));
   onRendering(missing.length > 0);
   if (!missing.length) return;
   cancel = renderLaneBatches(missing,feature=>{
    const id = feature.properties.linkId;
    if (!objects.has(id)) objects.set(id,create(feature));
   },()=>onRendering(false),true,1);
  },
  destroy() {
   if (disposed) return;
   disposed = true;cancel();
   if (objects.size) removeMany([...objects.values()]);objects.clear();
  }
 };
}
