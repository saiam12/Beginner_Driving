// Fit routes to the visible viewport, rather than the oversized raster surface.
export function getNaverCourseViewport(map,element,coordinates,zoom) {
 const n=window.naver.maps,projection=map.getProjection();
 const points=coordinates.map(p=>projection.fromCoordToOffset(new n.LatLng(...p)));
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
 const scale=2**(zoom-map.getZoom());
 const width=Math.max(1,element.parentElement.clientWidth-115);
 const height=Math.max(1,element.parentElement.clientHeight-185);
 const targetZoom=Math.max(map.getMinZoom(),Math.min(14,Math.floor(zoom+Math.log2(Math.min(width/Math.max(1,(right-left)*scale),height/Math.max(1,(bottom-top)*scale))))));
 const ratio=2**(targetZoom-map.getZoom());
 const center=projection.fromOffsetToCoord(new n.Point((left+right)/2+15/(2*ratio),(top+bottom)/2+55/(2*ratio)));
 return {center,zoom:targetZoom};
}
