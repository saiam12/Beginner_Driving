import React from 'react';
import { useEffect,useRef,useState } from 'react';
import L from 'leaflet';
import { Plus,Minus,LocateFixed,Layers,MapPin,Navigation,Repeat2,ChevronRight } from 'lucide-react';
import addRoutePolyline from './RoutePolyline';
import {getRankingMarkers} from '../../data';
import {linkTooltip} from '../../lib/road-search';
import {RoadMapInfo} from './RoadInfo';
import useLaneRoads from './useLaneRoads';
import LaneRoadStatus from './LaneRoadStatus';
import ConnectedCourseControl from './ConnectedCourseControl';
import {CONNECTED_COURSE_COLOR} from '../../lib/connected-course';
import {courseDirectionMarks,courseLabelPoint,courseStops,courseStopHTML,courseNumberButton,courseArrowHTML,courseAnnotationContent} from './courseAnnotations';
import {layoutRegionLabels,regionLabelHTML,REGION_LABEL_SIZE,REGION_LABEL_ANCHOR} from './regionLabelLayout';
const KOREA_BOUNDS = L.latLngBounds([32.5,124],[39,130.5]);
const HOME_CENTER = [37.8,128.2];
const MIN_ZOOM = 7;

export default function MapView({region,routes,routeBatch,selectedId,onSelect,onDetail,rankingRegions,onRegionSelect,selectedRoad,selectedArea,laneSelection,distanceRange,driverProfile}) {
 const element=useRef(null),map=useRef(null),routeGroup=useRef(null); const [tileError,setTileError]=useState(false),[layer,setLayer]=useState('standard');
 const [laneViewport,setLaneViewport]=useState(null);

 const [connectedCourse,setConnectedCourse]=useState(null);
 const [connectedCandidates,setConnectedCandidates]=useState([]);
 const connectedLines=useRef([]);
 const activeConnected=useRef(null),pickingRef=useRef(false);
 const [startPoint,setStartPoint]=useState(null),[pickingStart,setPickingStart]=useState(false);
 activeConnected.current=connectedCourse;pickingRef.current=pickingStart;
 useEffect(()=>{setStartPoint(null);setPickingStart(false);},[region,rankingRegions,selectedRoad,selectedArea]);

 const laneRoads=useLaneRoads(laneViewport);
 const selected=rankingRegions||selectedRoad||selectedArea||connectedCourse?null:routes.find(r=>r.id===selectedId);
 useEffect(()=>{
  map.current=L.map(element.current,{zoomControl:false,center:HOME_CENTER,zoom:MIN_ZOOM,minZoom:MIN_ZOOM,maxZoom:17,zoomSnap:1,zoomDelta:1,wheelPxPerZoomLevel:120,maxBounds:KOREA_BOUNDS,maxBoundsViscosity:1});
  routeGroup.current=L.layerGroup().addTo(map.current);
  L.control.scale({position:'bottomright',imperial:false}).addTo(map.current);
  const constrain=()=>{
   const minimum=MIN_ZOOM;
   map.current.setMinZoom(minimum);
   if(map.current.getZoom()<minimum)map.current.setZoom(minimum,{animate:false});
   map.current.panInsideBounds(KOREA_BOUNDS,{animate:false});
  };
  const observer=new ResizeObserver(()=>{map.current?.invalidateSize();constrain();});observer.observe(element.current);
  constrain();
  return ()=>{observer.disconnect();map.current.remove();map.current=null;};
 },[]);
 useEffect(()=>{
  const m=map.current;
  const update=()=>{const b=m.getBounds();setLaneViewport({zoom:m.getZoom(),bounds:[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()]});};
  m.on('moveend zoomend resize',update);update();
  return()=>m.off('moveend zoomend resize',update);
 },[]);
 useEffect(()=>{
  if(!pickingStart)return;
  const choose=event=>{setStartPoint([event.latlng.lng,event.latlng.lat]);setPickingStart(false);};
  map.current.on('click',choose);element.current.style.cursor='crosshair';
  return()=>{map.current?.off('click',choose);element.current.style.cursor='';};
 },[pickingStart]);
 useEffect(()=>{
  if(!startPoint)return;
  const marker=L.circleMarker([startPoint[1],startPoint[0]],{radius:8,color:'#2866e9',fillColor:'#ffffff',fillOpacity:1,weight:3}).bindTooltip('지정한 출발 위치').addTo(map.current);
  return()=>marker.remove();
 },[startPoint]);
 useEffect(()=>{
  if(!connectedCandidates.length)return;
  const group=L.layerGroup().addTo(map.current);
  connectedLines.current=connectedCandidates.map(({course,index})=>{
   const active=course===activeConnected.current;
   const line=L.geoJSON(course.featureCollection,{style:{color:CONNECTED_COURSE_COLOR,weight:active?7:5,opacity:active?1:.28}}).bindTooltip(`후보 ${index+1}`).on('click',()=>{if(!pickingRef.current)setConnectedCourse(course);}).addTo(group);
   return {course,line};
  });
  connectedLines.current.filter(item=>item.course===activeConnected.current).forEach(item=>item.line.bringToFront());
  return()=>{connectedLines.current=[];group.remove();};
 },[connectedCandidates]);
 useEffect(()=>{
  connectedLines.current.forEach(({course,line})=>{
   const active=course===connectedCourse;
   line.setStyle({weight:active?7:5,opacity:active?1:.28});
   if(active)line.bringToFront();
  });
  const group=L.layerGroup().addTo(map.current);
  const annotation=(point,html,size,anchor,onSelect)=>L.marker([point[1],point[0]],{interactive:false,keyboard:false,icon:L.divIcon({className:'course-annotation',html:courseAnnotationContent(html,onSelect),iconSize:size,iconAnchor:anchor}),zIndexOffset:500}).addTo(group);
  connectedCandidates.forEach(({course,index})=>annotation(courseLabelPoint(course,connectedCandidates),courseNumberButton(index,course===connectedCourse,pickingStart),[80,26],[40,13],()=>{if(!pickingRef.current)setConnectedCourse(course);}));
  if(connectedCourse){
   courseDirectionMarks(connectedCourse).forEach(({point,angle})=>annotation(point,courseArrowHTML(angle),[22,22],[11,11]));
   courseStops(connectedCourse).forEach(({title,point})=>annotation(point,courseStopHTML(title),[140,30],[10,15]));
  }
  return()=>group.remove();
 },[connectedCourse,connectedCandidates,pickingStart]);
 useEffect(()=>{
  setTileError(false);
  const url='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const tiles=L.tileLayer(url,{maxZoom:17,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map.current);
  tiles.on('tileerror',()=>setTileError(true));
  return ()=>tiles.remove();
 },[]);
 useEffect(()=>{
  if(rankingRegions) map.current.setView(KOREA_BOUNDS.getCenter(),map.current.getMinZoom());
  else if(selectedRoad||selectedArea){const b=(selectedRoad??selectedArea).bounds;map.current.flyToBounds([[b[1],b[0]],[b[3],b[2]]],{paddingTopLeft:[50,65],paddingBottomRight:[65,150],maxZoom:17,duration:1,animate:!window.matchMedia('(prefers-reduced-motion: reduce)').matches});}
  else if(region) map.current.flyToBounds(L.latLngBounds(routes.flatMap(r=>r.coordinates)),{paddingTopLeft:[50,65],paddingBottomRight:[65,120],maxZoom:14,duration:1});
  else map.current.setView(KOREA_BOUNDS.getCenter(),map.current.getMinZoom());
 // Route filters redraw overlays without requesting camera movement.
 },[region,routeBatch,rankingRegions,selectedRoad,selectedArea]);
 useEffect(()=>{
  const draw=()=>{
   routeGroup.current.clearLayers();
   if(connectedCourse)return;
   if(selectedRoad&&!rankingRegions){
    L.geoJSON(selectedRoad.featureCollection,{style:{color:'#ea4949',weight:6,opacity:1},onEachFeature:(feature,line)=>{
     const content=document.createElement('div');content.className='road-link-tooltip';content.textContent=linkTooltip(feature.properties);line.bindTooltip(content);line.bindPopup(content.cloneNode(true));
    }}).addTo(routeGroup.current);
   }else if(selectedArea&&!rankingRegions){return;}else if(rankingRegions){
    const size=map.current.getSize();
    const items=getRankingMarkers(rankingRegions,map.current.getZoom()).map(region=>({region,point:map.current.latLngToContainerPoint(region.center)}));
    layoutRegionLabels(items,size.x,size.y,map.current.getZoom()).forEach(({region})=>{
     const icon=L.divIcon({className:'region-map-marker',html:regionLabelHTML(region),iconSize:REGION_LABEL_SIZE,iconAnchor:REGION_LABEL_ANCHOR});
     L.marker(region.center,{icon,title:`${region.name} 코스 추천 보기`,alt:`${region.name} 코스 추천 보기`}).on('click',()=>onRegionSelect(region.name)).addTo(routeGroup.current);
    });
   }else [...routes].sort((a,b)=>(a.id===selectedId)-(b.id===selectedId)).forEach(route=>addRoutePolyline(routeGroup.current,route,route.id===selectedId,onSelect));
  };
  draw();
  if(rankingRegions)map.current.on('zoomend moveend',draw);
  return ()=>{map.current?.off('zoomend moveend',draw);};
 },[routes,selectedId,onSelect,rankingRegions,onRegionSelect,selectedRoad,selectedArea,connectedCourse]);
 const recenter=()=>{if((selectedRoad||selectedArea)&&!rankingRegions){const b=(selectedRoad??selectedArea).bounds;map.current.fitBounds([[b[1],b[0]],[b[3],b[2]]],{paddingTopLeft:[50,65],paddingBottomRight:[65,150],maxZoom:17});return;}return !rankingRegions&&routes.length?map.current.fitBounds(L.latLngBounds(routes.flatMap(r=>r.coordinates)),{padding:[65,85]}):map.current.setView(KOREA_BOUNDS.getCenter(),map.current.getMinZoom());};
 return <main className={`map-shell ${layer === "light" ? "map-light" : ""}`}><div className="map" ref={element}/><LaneRoadStatus zoom={laneViewport?.zoom} state={laneRoads}><ConnectedCourseControl features={laneRoads.features} viewport={laneViewport} range={distanceRange} selection={laneSelection} profile={driverProfile} ready={laneRoads.kind === 'ready'} onCourse={setConnectedCourse} selectedCourse={connectedCourse} onCandidates={setConnectedCandidates} startPoint={startPoint} pickingStart={pickingStart} onPickStart={()=>setPickingStart(value=>!value)} onClearStart={()=>{setStartPoint(null);setPickingStart(false);}} onCenterStart={()=>{const b=laneViewport.bounds;setStartPoint([(b[0]+b[2])/2,(b[1]+b[3])/2]);setPickingStart(false);}}/></LaneRoadStatus><div className="map-location"><MapPin size={15}/>{rankingRegions?'전국 추천 지역':selectedRoad?selectedRoad.roadName:selectedArea?selectedArea.name:region?region.name:'대한민국'}<span>›</span><strong>{rankingRegions?'지역별 순위 지도':selectedRoad?'선택한 도로':selectedArea?'선택한 지역':region?'추천 코스 지도':'연습 지역 둘러보기'}</strong></div><div className="map-top-note"><span className="green-dot"/> 천천히, 자신 있게 시작하세요</div><div className="map-controls"><button aria-label="지도 스타일 변경" title="지도 스타일 변경" className={layer==='light'?'on':''} onClick={()=>setLayer(l=>l==='standard'?'light':'standard')}><Layers size={21}/></button><div><button aria-label="지도 확대" onClick={()=>map.current.zoomIn(1)}><Plus size={21}/></button><button aria-label="지도 축소" onClick={()=>map.current.zoomOut(1)}><Minus size={21}/></button></div><button aria-label="전체 코스 보기" title="전체 코스 보기" onClick={recenter}><LocateFixed size={21}/></button></div>{tileError&&<div className="tile-error" role="status">지도 타일을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 페이지를 새로고침해주세요.</div>}{selectedRoad?<RoadMapInfo road={selectedRoad}/>:selected?<div className="map-selected"><span className="selected-icon"><Navigation size={22}/></span><div><small>지금 선택한 코스</small><strong>{selected.name}</strong><p>{selected.distance} km <i/> 약 {selected.duration}분 <i/> <span><Repeat2 size={12}/> 출발점으로 돌아오는 코스</span></p></div><button aria-label="선택 코스 상세 보기" onClick={()=>onDetail(selected.id)}><ChevronRight size={23}/></button></div>:!rankingRegions&&!selectedArea&&!connectedCourse&&<div className="map-welcome"><span className="selected-icon"><Navigation size={22}/></span><div><strong>{rankingRegions?"지역을 누르면 코스를 추천해드려요":"첫 드라이브, 가까운 곳부터"}</strong><p>{rankingRegions?"지도 위 지역명이나 왼쪽 순위를 선택하세요.":"목록에서 지역을 선택하면 연습 코스를 볼 수 있어요."}</p></div></div>}{!selectedArea&&<div className="map-legend"><span><i className={rankingRegions?"legend-region":"legend-line"}/>{rankingRegions?"추천 지역":selectedRoad?"선택한 도로":"추천 코스"}</span>{!selectedRoad&&<span><i className="legend-dot"/>{rankingRegions?"코스 보기":"출발 · 도착"}</span>}{rankingRegions&&<small>확대하면 더 보기</small>}</div>}</main>;
}
















