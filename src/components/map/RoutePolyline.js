import L from 'leaflet';
export default function addRoutePolyline(group,route,selected,onSelect) {
 const line=L.polyline(route.coordinates,{color:selected?'#ea4949':'#e97979',weight:selected?6:4,opacity:selected?1:0.45,lineJoin:'round'}).addTo(group);
 line.on('click',()=>onSelect(route.id));
 line.on('mouseover',()=>line.setStyle({weight:7,opacity:1}));
 line.on('mouseout',()=>line.setStyle({weight:selected?6:4,opacity:selected?1:0.45}));
 L.marker(route.coordinates[2],{icon:L.divIcon({className:'route-number-container',html:`<span class="route-number ${selected?'active':''}">${route.rank}</span>`,iconSize:[30,30],iconAnchor:[15,45]})}).on('click',()=>onSelect(route.id)).addTo(group);
 if (selected) {
  L.marker(route.coordinates[0],{icon:L.divIcon({className:'start-container',html:'<span class="start-pin"><i></i></span><span class="start-label">출발 · 도착</span>',iconSize:[120,32],iconAnchor:[16,16]})}).addTo(group);
  route.coordinates.slice(1,-1).forEach((point,i)=>{
   L.marker(point,{icon:L.divIcon({className:'waypoint-container',html:`<span class="waypoint">${i+1}</span>`,iconSize:[18,18],iconAnchor:[9,9]})}).addTo(group);
  });
  route.coordinates.slice(0,-1).forEach((point,i)=>{
   const next=route.coordinates[i+1];
   const angle=Math.atan2(-(next[0]-point[0]),(next[1]-point[1])*Math.cos(point[0]*Math.PI/180))*180/Math.PI;
   L.marker([(point[0]+next[0])/2,(point[1]+next[1])/2],{interactive:false,icon:L.divIcon({className:'direction-container',html:`<span class="direction" style="transform:rotate(${angle}deg)">➤</span>`,iconSize:[16,16],iconAnchor:[8,8]})}).addTo(group);
  });
 }
}

