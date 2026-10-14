import {renderLaneBatches} from './laneRenderBatch.js';

// A LINK keeps its map object while it remains in the requested viewport.
export function createIncrementalLaneLayer(create, removeMany, onRendering, {maxItems=1,hideMany=()=>{}}={}) {
 const objects = new Map();
 const retiring = new Set();
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
   // Hide retired overlays in the same update; release map objects in batches.
   if(removed.length)hideMany(removed);
   removed.forEach(object=>retiring.add(object));
   const missing = features.filter(feature=>!objects.has(feature.properties.linkId));
   const tasks=[...[...retiring].map(object=>({object})),...missing.map(feature=>({feature}))];
   onRendering(tasks.length > 0);
   if (!tasks.length) return;
   cancel = renderLaneBatches(tasks,({object,feature})=>{
    if(object){removeMany([object]);retiring.delete(object);return;}
    const id = feature.properties.linkId;
    if (!objects.has(id)) objects.set(id,create(feature));
   },()=>onRendering(false),true,maxItems);
  },
  destroy() {
   if (disposed) return;
   disposed = true;cancel();
   const removed=[...retiring,...objects.values()];
   if (removed.length) removeMany(removed);objects.clear();retiring.clear();
  }
 };
}
