// Limit the center, not the viewport edges, so low zoom levels remain draggable.
export function constrainNaverViewport(map,n) {
 const area=new n.LatLngBounds(new n.LatLng(32.5,124),new n.LatLng(39,130.5));
 let updating=false;
 map.setOptions({minZoom:7,maxBounds:area});
 const update=()=>{
  if(updating)return;
  updating=true;
  try {
   const minimum=7;
   if(map.getMinZoom()!==minimum)map.setOptions({minZoom:minimum});
   if(map.getZoom()<minimum){
    map.setZoom(minimum,false);
    return;
   }
  } finally {updating=false;}
 };
 return update;
}

