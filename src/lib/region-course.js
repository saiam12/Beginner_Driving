export function regionCourseViewport(start,end,viewport,via=[]) {
 if(!start)return viewport;
 if(!end&&!via.length){
  const [west,south,east,north]=start.bounds;
  return {zoom:13,bounds:[Math.max(west-.005,start.centerLng-.035),Math.max(south-.005,start.centerLat-.025),Math.min(east+.005,start.centerLng+.035),Math.min(north+.005,start.centerLat+.025)]};
 }
 const regions=[start,...via,...(end?[end]:[])],lngs=regions.map(area=>area.centerLng),lats=regions.map(area=>area.centerLat);
 return {zoom:13,bounds:[Math.min(...lngs)-.015,Math.min(...lats)-.01,Math.max(...lngs)+.015,Math.max(...lats)+.01]};
}
