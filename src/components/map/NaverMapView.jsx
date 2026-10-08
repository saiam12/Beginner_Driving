import React, {useEffect,useMemo,useRef,useState} from 'react';
import {Plus,Minus,LocateFixed,Layers,MapPin,Navigation,Repeat2,ChevronRight} from 'lucide-react';
import {loadNaverMaps} from '../../lib/naverMaps';
import {constrainNaverViewport} from './naverViewportBounds';
import {createNaverZoomController} from './naverZoomController';
import {getNaverCourseViewport} from './naverCourseViewport';
import {getRankingMarkers} from '../../data';
import {linkTooltip} from '../../lib/road-search';
import {RoadMapInfo} from './RoadInfo';
import useLaneRoads from './useLaneRoads';
import {regionCourseViewport} from '../../lib/region-course';
import LaneRoadStatus from './LaneRoadStatus';
import ConnectedCourseControl from './ConnectedCourseControl';
import {CONNECTED_COURSE_COLOR} from '../../lib/connected-course';
import {courseDirectionMarks,courseLabelPoint,courseStops,courseStopHTML,courseNumberButton,courseArrowHTML,courseAnnotationContent} from './courseAnnotations';
import {renderLaneBatches} from './laneRenderBatch';
import {layoutRegionLabels,regionLabelHTML,REGION_LABEL_SIZE,REGION_LABEL_ANCHOR} from './regionLabelLayout';
export default function NaverMapView({region,routes,routeBatch,selectedId,onSelect,onDetail,clientId,rankingRegions,onRegionSelect,selectedRoad,selectedArea,laneSelection,distanceRange,driverProfile,difficulty,preferredArea,destinationArea,provinceFocus,routeAreas=[],onSaveCourse}) {
 const element=useRef(null),map=useRef(null),overlays=useRef([]);
 const fractionalZoom=useRef(false);
 const zoomController=useRef(null);
 const positioned=useRef(false),roadTooltip=useRef(null);

 const [ready,setReady]=useState(false),[tileError,setTileError]=useState(''),[layer,setLayer]=useState('standard');
 const [zoom,setZoom]=useState(7);
 const [minZoom,setMinZoom]=useState(7);
 const [viewRevision,setViewRevision]=useState(0);
 const [laneViewport,setLaneViewport]=useState(null);

 const [connectedCourse,setConnectedCourse]=useState(null);
 const [connectedCandidates,setConnectedCandidates]=useState([]);
 const connectedLines=useRef([]);
 const activeConnected=useRef(null),pickingRef=useRef(false);
 const [startPoint,setStartPoint]=useState(null),[pickingStart,setPickingStart]=useState(false);
 activeConnected.current=connectedCourse;pickingRef.current=pickingStart;
 useEffect(()=>{setStartPoint(null);setPickingStart(false);},[region,rankingRegions,selectedRoad,selectedArea,destinationArea]);
 const regionKey=routeAreas.map(area=>area.id).join('|');
 const courseViewport=useMemo(()=>regionCourseViewport(preferredArea,destinationArea,laneViewport,routeAreas.slice(1,-1)),[preferredArea,destinationArea,preferredArea?regionKey:laneViewport]);
 const laneRoads=useLaneRoads(courseViewport);
 const rankingZoom=rankingRegions?zoom:null,rankingRevision=rankingRegions?viewRevision:null;
 const selected=rankingRegions||selectedRoad||selectedArea||connectedCourse?null:routes.find(r=>r.id===selectedId);
 useEffect(()=>{
  let disposed=false,observer,wheel;
  const authError=()=>{setReady(false);setTileError('네이버 지도 인증에 실패했습니다. Client ID와 등록 URL을 확인해주세요.');};
  window.addEventListener('naver-map-auth-error',authError);
  loadNaverMaps(clientId).then(n=>{
   if(disposed)return;
   map.current=new n.Map(element.current,{center:new n.LatLng(37.8,128.2),zoom:7,minZoom:7,maxZoom:17,maxBounds:new n.LatLngBounds(new n.LatLng(32.5,124),new n.LatLng(39,130.5)),zoomControl:false,mapTypeControl:false,scaleControl:true,scrollWheel:false,overlayZoomEffect:'all',tileTransition:true,tileDuration:400,disableDoubleClickZoom:true,disableDoubleTapZoom:true});
   // Raster maps can briefly echo a fractional value before rounding it.
   // Require a vector canvas before probing native half-step support.
   fractionalZoom.current=false;
   if(element.current.querySelector('canvas')){
    map.current.setZoom(7.5,false);
    fractionalZoom.current=Math.abs(map.current.getZoom()-7.5)<0.001;
    map.current.setZoom(7,false);
   }
   // Load tiles beyond the viewport so native zoom-out can reveal its edges.
   map.current.setOptions({tileSpare:1,tileTransition:true,tileDuration:200});
   zoomController.current=createNaverZoomController(map.current,element.current,fractionalZoom.current,setZoom);
   let wheelDelta=0;
   wheel=e=>{e.preventDefault();wheelDelta+=e.deltaY;if(Math.abs(wheelDelta)>=120){zoomController.current.change(wheelDelta<0?1:-1);wheelDelta=0;}};
   element.current.addEventListener('wheel',wheel,{passive:false});
   const constrain=constrainNaverViewport(map.current,n);
   const updateBounds=()=>{constrain();setMinZoom(map.current.getMinZoom());setZoom(zoomController.current.getZoom());};
   n.Event.addListener(map.current,'idle',updateBounds);
   observer=new ResizeObserver(()=>{map.current?.autoResize();updateBounds();});observer.observe(element.current);
   n.Event.addListener(map.current,'zoom_changed',value=>zoomController.current.sync(value));
   n.Event.addListener(map.current,'idle',()=>setViewRevision(value=>value+1));
   setZoom(map.current.getZoom());
   setReady(true);
  }).catch(error=>{if(!disposed)setTileError(error.message);});
  return ()=>{disposed=true;window.removeEventListener('naver-map-auth-error',authError);observer?.disconnect();element.current?.removeEventListener('wheel',wheel);overlays.current.forEach(o=>o.setMap(null));overlays.current=[];roadTooltip.current?.close();zoomController.current?.destroy();map.current?.destroy();map.current=null;};
 },[clientId]);
 useEffect(()=>{
  if(!ready)return;
  const n=window.naver.maps;
  map.current.setMapTypeId(layer==='standard'?n.MapTypeId.NORMAL:n.MapTypeId.SATELLITE);
 },[ready,layer]);
 useEffect(()=>{
  if(!ready)return;
  const n=window.naver.maps,m=map.current,projection=m.getProjection(),size=m.getSize();
  const scale=fractionalZoom.current?1:2**(zoomController.current.getZoom()-m.getZoom());
  const width=element.current.parentElement.clientWidth/scale,height=element.current.parentElement.clientHeight/scale;
  const sw=projection.fromOffsetToCoord(new n.Point((size.width-width)/2,(size.height+height)/2));
  const ne=projection.fromOffsetToCoord(new n.Point((size.width+width)/2,(size.height-height)/2));
  setLaneViewport({zoom:zoomController.current.getZoom(),bounds:[sw.lng(),sw.lat(),ne.lng(),ne.lat()]});
 },[ready,viewRevision,zoom]);
 useEffect(()=>{
  if(!ready||!pickingStart)return;
  const n=window.naver.maps;
  const listener=n.Event.addListener(map.current,'click',event=>{setStartPoint([event.coord.lng(),event.coord.lat()]);setPickingStart(false);});
  element.current.style.cursor='crosshair';
  return()=>{n.Event.removeListener(listener);element.current.style.cursor='';};
 },[ready,pickingStart]);
 useEffect(()=>{
  if(!ready||!startPoint)return;
  const n=window.naver.maps;
  const marker=new n.Marker({map:map.current,position:new n.LatLng(startPoint[1],startPoint[0]),title:'지정한 출발 위치',zIndex:160,icon:{content:'<div class="naver-screen-marker" style="width:20px;height:20px;transform-origin:10px 10px"><div class="course-start-pin" aria-label="지정한 출발 위치"></div></div>',size:new n.Size(20,20),anchor:new n.Point(10,10)}});
  return()=>marker.setMap(null);
 },[ready,startPoint]);
 useEffect(()=>{
  if(!ready||!connectedCandidates.length)return;
  const n=window.naver.maps,m=map.current,lines=[];
  connectedLines.current=lines;
  const segments=connectedCandidates.flatMap(({course,index})=>course.featureCollection.features.map(feature=>({feature,course,index})));
  const cancel=renderLaneBatches(segments,({feature,course,index})=>{
   const active=course===activeConnected.current;
   const line=new n.Polyline({map:m,path:feature.geometry.coordinates.map(([lng,lat])=>new n.LatLng(lat,lng)),strokeColor:CONNECTED_COURSE_COLOR,strokeWeight:active?7:5,strokeOpacity:active?1:.28,zIndex:active?40:35,clickable:!pickingRef.current});
   n.Event.addListener(line,'click',()=>{if(!pickingRef.current)setConnectedCourse(course);});
   lines.push({course,line,index});
  },undefined,true,1);
  return()=>{cancel();lines.forEach(({line})=>{n.Event.clearInstanceListeners(line);line.setMap(null);});connectedLines.current=[];};
 },[ready,connectedCandidates]);
 useEffect(()=>{
  if(!ready)return;
  connectedLines.current.forEach(({course,line})=>{const active=course===connectedCourse;line.setOptions({strokeWeight:active?7:5,strokeOpacity:active?1:.28,zIndex:active?40:35,clickable:!pickingStart});});
  const n=window.naver.maps,m=map.current;
  const markers=[];
  const annotation=(point,html,size,anchor,title='',onSelect)=>{
   const content=courseAnnotationContent(html,onSelect);content.className='naver-screen-marker course-annotation';content.style.cssText=`width:${size[0]}px;height:${size[1]}px;transform-origin:${anchor[0]}px ${anchor[1]}px`;
   markers.push(new n.Marker({map:m,position:new n.LatLng(point[1],point[0]),title,clickable:false,zIndex:150,icon:{content,size:new n.Size(...size),anchor:new n.Point(...anchor)}}));
  };
  connectedCandidates.forEach(({course,index})=>annotation(courseLabelPoint(course,connectedCandidates),courseNumberButton(index,course===connectedCourse,pickingStart),[80,26],[40,13],`후보 ${index+1}`,()=>{if(!pickingRef.current)setConnectedCourse(course);}));
  if(connectedCourse){
   courseDirectionMarks(connectedCourse).forEach(({point,angle})=>annotation(point,courseArrowHTML(angle),[22,22],[11,11]));
   courseStops(connectedCourse).forEach(({title,point})=>annotation(point,courseStopHTML(title),[140,30],[10,15],title));
  }
  return()=>markers.forEach(marker=>marker.setMap(null));
 },[ready,connectedCourse,connectedCandidates,pickingStart]);
 useEffect(()=>{
  if(!ready)return;
  const n=window.naver.maps;
  const roadBounds=(selectedRoad??selectedArea)?.bounds;
  const target=destinationArea&&preferredArea?getNaverCourseViewport(map.current,element.current,[[courseViewport.bounds[1],courseViewport.bounds[0]],[courseViewport.bounds[3],courseViewport.bounds[2]]],zoomController.current.getZoom(),14):roadBounds&&!rankingRegions
   ?getNaverCourseViewport(map.current,element.current,[[roadBounds[1],roadBounds[0]],[roadBounds[3],roadBounds[2]]],zoomController.current.getZoom(),17)
   :region&&!rankingRegions&&routes.length
   ?getNaverCourseViewport(map.current,element.current,routes.flatMap(r=>r.coordinates),zoomController.current.getZoom())
   :region&&!rankingRegions?{center:new n.LatLng(...region.center),zoom:13}:{center:new n.LatLng(35.75,127.25),zoom:map.current.getMinZoom()};
  zoomController.current.flyTo(target.center,target.zoom,{animate:positioned.current});
  positioned.current=true;
 // Route filters redraw overlays without requesting camera movement.
 },[ready,region,routeBatch,rankingRegions,selectedRoad,selectedArea,destinationArea]);
 useEffect(()=>{
  if(!ready||!provinceFocus)return;
  const b=provinceFocus.bounds,n=window.naver.maps,m=map.current;
  const target=getNaverCourseViewport(m,element.current,[[b[1],b[0]],[b[3],b[2]]],zoomController.current.getZoom(),11);
  zoomController.current.flyTo(target.center,target.zoom,{animate:true});
 },[ready,provinceFocus]);
 useEffect(()=>{
  if(!ready)return;
  const n=window.naver.maps,polygons=[];
  (routeAreas.length?routeAreas:[preferredArea,destinationArea]).filter(area=>area?.geometry).forEach((area,index)=>{
   const parts=area.geometry.type==='Polygon'?[area.geometry.coordinates]:area.geometry.coordinates;
   for(const polygon of parts){
    const path=polygon[0].map(([lng,lat])=>new n.LatLng(lat,lng));
    polygons.push(new n.Polygon({map:map.current,paths:path,strokeColor:index?'#14845f':'#245fd6',strokeWeight:4,strokeOpacity:.95,fillColor:index?'#35bd89':'#5d8eff',fillOpacity:.09,zIndex:15,clickable:false}));
   }
  });
  return()=>polygons.forEach(polygon=>polygon.setMap(null));
 },[ready,preferredArea,destinationArea,regionKey]);
 useEffect(()=>{
  if(!ready)return;
  const n=window.naver.maps;
  roadTooltip.current?.close();
  overlays.current.forEach(o=>{n.Event.clearInstanceListeners(o);o.setMap(null);});overlays.current=[];
  if(connectedCourse)return;
  const marker=(position,content,size,anchor,onClick)=>{
   const screenContent=`<div class="naver-screen-marker" style="width:${size[0]}px;height:${size[1]}px;transform-origin:${anchor[0]}px ${anchor[1]}px">${content}</div>`;
   const m=new n.Marker({map:map.current,position:new n.LatLng(...position),icon:{content:screenContent,size:new n.Size(...size),anchor:new n.Point(...anchor)},zIndex:100});
   if(onClick)n.Event.addListener(m,'click',onClick);
   overlays.current.push(m);
  };
  if(selectedRoad&&!rankingRegions){
   const tooltip=new n.InfoWindow({content:document.createElement('div'),disableAnchor:true});roadTooltip.current=tooltip;
   selectedRoad.featureCollection.features.forEach(feature=>{
    const lines=feature.geometry.type==='MultiLineString'?feature.geometry.coordinates:[feature.geometry.coordinates];
    lines.forEach(coords=>{
     const line=new n.Polyline({map:map.current,path:coords.map(([lng,lat])=>new n.LatLng(lat,lng)),strokeColor:'#ea4949',strokeWeight:6,strokeOpacity:1,clickable:true,zIndex:30});
     const show=()=>{const content=document.createElement('div');content.className='road-link-tooltip';content.textContent=linkTooltip(feature.properties);tooltip.setContent(content);tooltip.open(map.current,new n.LatLng(feature.properties.centerLat,feature.properties.centerLng));};
     n.Event.addListener(line,'click',show);n.Event.addListener(line,'mouseover',show);n.Event.addListener(line,'mouseout',()=>tooltip.close());overlays.current.push(line);
    });
   });
   return;
  }
  if(selectedArea&&!rankingRegions)return;
  if(rankingRegions){
   const projection=map.current.getProjection(),size=map.current.getSize();
   const viewport=element.current.parentElement;
   const scale=fractionalZoom.current?1:2**(zoom-Math.floor(zoom));
   const items=getRankingMarkers(rankingRegions,zoom).map(region=>{
    const point=projection.fromCoordToOffset(new n.LatLng(...region.center));
    return {region,point:{x:(point.x-size.width/2)*scale+viewport.clientWidth/2,y:(point.y-size.height/2)*scale+viewport.clientHeight/2}};
   });
   layoutRegionLabels(items,viewport.clientWidth,viewport.clientHeight,zoom).forEach(({region})=>{
    marker(region.center,regionLabelHTML(region),REGION_LABEL_SIZE,REGION_LABEL_ANCHOR,()=>onRegionSelect(region.name));
   });
   return;
  }
  [...routes].sort((a,b)=>(a.id===selectedId)-(b.id===selectedId)).forEach(route=>{
   const active=route.id===selectedId;
   const line=new n.Polyline({map:map.current,path:route.coordinates.map(p=>new n.LatLng(...p)),strokeColor:active?'#ea4949':'#e97979',strokeWeight:active?6:4,strokeOpacity:active?1:0.45,clickable:true,zIndex:active?20:10});
   n.Event.addListener(line,'click',()=>onSelect(route.id));
   n.Event.addListener(line,'mouseover',()=>line.setOptions({strokeWeight:7,strokeOpacity:1}));
   n.Event.addListener(line,'mouseout',()=>line.setOptions({strokeWeight:active?6:4,strokeOpacity:active?1:0.45}));
   overlays.current.push(line);
   marker(route.coordinates[2],`<span class="route-number ${active?'active':''}">${route.rank}</span>`,[30,30],[15,45],()=>onSelect(route.id));
   if(!active)return;
   marker(route.coordinates[0],`<div class="start-container"><span class="start-pin"><i></i></span><span class="start-label">${route.mode==='oneway'?'출발':'출발 · 도착'}</span></div>`,[120,32],[16,16]);
   if(route.mode==='oneway')marker(route.coordinates.at(-1),'<div class="start-container"><span class="start-pin"><i></i></span><span class="start-label">도착</span></div>',[120,32],[16,16]);
   route.coordinates.filter((_,i)=>i>0&&i<route.coordinates.length-1&&i%Math.max(1,Math.floor(route.coordinates.length/5))===0).forEach((p,i)=>marker(p,`<span class="waypoint">${i+1}</span>`,[18,18],[9,9]));
   route.coordinates.slice(0,-1).forEach((p,i)=>{
    if(i%Math.max(1,Math.floor(route.coordinates.length/8))!==0)return;
    const next=route.coordinates[i+1],angle=Math.atan2(-(next[0]-p[0]),(next[1]-p[1])*Math.cos(p[0]*Math.PI/180))*180/Math.PI;
    marker([(p[0]+next[0])/2,(p[1]+next[1])/2],`<span class="direction" style="transform:rotate(${angle}deg)">➤</span>`,[16,16],[8,8]);
   });
  });
 },[ready,routes,selectedId,onSelect,rankingRegions,onRegionSelect,rankingZoom,rankingRevision,selectedRoad,selectedArea,connectedCourse]);
 const changeZoom=delta=>{if(ready)zoomController.current.change(delta);};
 const showSelectedDetail=()=>{if(!ready||!selected)return;const target=getNaverCourseViewport(map.current,element.current,selected.coordinates,zoomController.current.getZoom());zoomController.current.flyTo(target.center,target.zoom);onDetail(selected.id);};
 const recenter=()=>{
  if(!ready)return;
  const n=window.naver.maps;
  const roadBounds=(selectedRoad??selectedArea)?.bounds;
  const target=destinationArea&&preferredArea?getNaverCourseViewport(map.current,element.current,[[courseViewport.bounds[1],courseViewport.bounds[0]],[courseViewport.bounds[3],courseViewport.bounds[2]]],zoomController.current.getZoom(),14):roadBounds&&!rankingRegions
   ?getNaverCourseViewport(map.current,element.current,[[roadBounds[1],roadBounds[0]],[roadBounds[3],roadBounds[2]]],zoomController.current.getZoom(),17)
   :!rankingRegions&&routes.length
   ?getNaverCourseViewport(map.current,element.current,routes.flatMap(r=>r.coordinates),zoomController.current.getZoom())
   :region&&!rankingRegions?{center:new n.LatLng(...region.center),zoom:13}:{center:new n.LatLng(35.75,127.25),zoom:map.current.getMinZoom()};
  zoomController.current.flyTo(target.center,target.zoom);
 };
 return <main className={`map-shell naver-map-shell`}><div className="map" ref={element}/><LaneRoadStatus region={preferredArea} zoom={zoom} state={laneRoads}><ConnectedCourseControl features={laneRoads.features} viewport={courseViewport} preferredArea={preferredArea} destinationArea={destinationArea} routeAreas={routeAreas} onSaveCourse={onSaveCourse} range={distanceRange} difficulty={difficulty} selection={laneSelection} profile={driverProfile} ready={laneRoads.kind === 'ready'} onCourse={setConnectedCourse} selectedCourse={connectedCourse} onCandidates={setConnectedCandidates} startPoint={startPoint} pickingStart={pickingStart} onPickStart={()=>setPickingStart(value=>!value)} onClearStart={()=>{setStartPoint(null);setPickingStart(false);}}/></LaneRoadStatus>{!ready&&!tileError&&<div className="map-loading" role="status">네이버 지도를 불러오고 있습니다…</div>}<div className="map-location"><MapPin size={15}/>{rankingRegions?'전국 추천 지역':selectedRoad?selectedRoad.roadName:selectedArea?selectedArea.name:region?region.name:'대한민국'}<span>›</span><strong>{rankingRegions?'지역별 순위 지도':selectedRoad?'선택한 도로':selectedArea?'선택한 지역':region?'추천 코스 지도':'연습 지역 둘러보기'}</strong></div><div className="map-controls" data-zoom={zoom}><button aria-label="일반 지도 / 위성 지도 전환" title="일반 지도 / 위성 지도 전환" className={layer==='satellite'?'on':''} onClick={()=>setLayer(l=>l==='standard'?'satellite':'standard')}><Layers size={21}/></button><div><button aria-label="지도 확대" disabled={!ready||zoom>=17} title={zoom>=17?"최대 확대 상태입니다":"지도 확대"} onClick={()=>changeZoom(1)}><Plus size={21}/></button><button aria-label="지도 축소" disabled={!ready||zoom<=minZoom} title={zoom<=minZoom?"최소 줌 7 상태입니다":"지도 축소"} onClick={()=>changeZoom(-1)}><Minus size={21}/></button></div><button aria-label="전체 코스 보기" title="전체 코스 보기" onClick={recenter}><LocateFixed size={21}/></button></div>{tileError&&<div className="tile-error" role="status">{tileError}<button className="map-retry" onClick={()=>window.location.reload()}>다시 연결</button></div>}{selectedRoad?<RoadMapInfo road={selectedRoad}/>:selected?<div className="map-selected" onClick={showSelectedDetail}><span className="selected-icon"><Navigation size={22}/></span><div><small>지금 선택한 코스</small><strong>{selected.name}</strong><p>{selected.distance} km <i/> 약 {selected.duration}분 <i/> <span><Repeat2 size={12}/> {selected.mode==='oneway'?'도착 지역으로 이동하는 코스':'출발점으로 돌아오는 코스'}</span></p></div><button aria-label="선택 코스 상세 보기" onClick={event=>{event.stopPropagation();showSelectedDetail();}}><ChevronRight size={23}/></button></div>:!rankingRegions&&!selectedArea&&!connectedCourse&&<div className="map-welcome"><span className="selected-icon"><Navigation size={22}/></span><div><strong>{rankingRegions?"지역을 누르면 코스를 추천해드려요":"현재 지도에서 코스 찾기"}</strong><p>{rankingRegions?"지도 위 지역명이나 왼쪽 순위를 선택하세요.":"지역을 검색한 뒤 지도를 확대해주세요."}</p></div></div>}{!selectedArea&&<div className="map-legend"><span><i className={rankingRegions?"legend-region":"legend-line"}/>{rankingRegions?"추천 지역":selectedRoad?"선택한 도로":"추천 코스"}</span>{!selectedRoad&&<span><i className="legend-dot"/>{rankingRegions?"코스 보기":"출발 · 도착"}</span>}{rankingRegions&&<small>확대하면 더 보기</small>}</div>}</main>;
}



















