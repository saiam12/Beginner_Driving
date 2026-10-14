export function regionCourseViewport(start,end,viewport,via=[],manualPoints=[]) {
 if(!start&&!manualPoints.some(Boolean))return viewport;
 const regions=[start,...via,...(end?[end]:[])];
 const bounds=start?regions.map(a=>a.bounds):viewport?[viewport.bounds]:[];
 // Include nearby roads even when the requested point is outside the chosen districts.
 for(const point of manualPoints.filter(Boolean)){
  const lat=3000/111320,lon=lat/Math.cos(point[1]*Math.PI/180);
  bounds.push([point[0]-lon,point[1]-lat,point[0]+lon,point[1]+lat]);
 }
 return {zoom:13,regional:true,bounds:[Math.min(...bounds.map(b=>b[0])),Math.min(...bounds.map(b=>b[1])),Math.max(...bounds.map(b=>b[2])),Math.max(...bounds.map(b=>b[3]))]};
}
