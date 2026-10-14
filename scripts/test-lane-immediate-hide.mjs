import assert from 'node:assert/strict';
import {createIncrementalLaneLayer} from '../src/components/map/incrementalLaneLayer.js';
const objects=new Map();let finish;
const done=()=>new Promise(resolve=>{finish=resolve});
const layer=createIncrementalLaneLayer(feature=>{const object={id:feature.properties.linkId,visible:true};objects.set(object.id,object);return object;},items=>items.forEach(item=>objects.delete(item.id)),busy=>{if(!busy)finish?.();},{maxItems:40,hideMany:items=>items.forEach(item=>{item.visible=false;})});
const features=Array.from({length:5000},(_,i)=>({properties:{linkId:String(i)}}));
let wait=done();layer.update(features);await wait;
wait=done();layer.update(features.slice(0,2500));
assert.equal([...objects.values()].filter(item=>item.visible).length,2500,'Deselected roads disappear before asynchronous cleanup');
assert.equal(objects.size,5000,'Removal remains asynchronous');
await wait;assert.equal(objects.size,2500);
layer.update([]);assert([...objects.values()].every(item=>!item.visible));
// Changing selection before removal finishes must not lose queued cleanup.
wait=done();layer.update(features.slice(0,50));await wait;
assert.equal(objects.size,50);assert([...objects.values()].every(item=>item.visible));
layer.destroy();assert.equal(objects.size,0);
console.log('PASS: 5,000 road overlays; immediate partial/full hide, retained selection, batched cleanup and rapid reselection');
