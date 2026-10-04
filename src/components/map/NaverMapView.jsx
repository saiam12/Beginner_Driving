import React, {useEffect,useRef,useState} from 'react';
import {Plus,Minus,LocateFixed,Layers,MapPin,Navigation,Repeat2,ChevronRight} from 'lucide-react';
import {loadNaverMaps} from '../../lib/naverMaps';
import {constrainNaverViewport} from './naverViewportBounds';
import {createNaverZoomController} from './naverZoomController';
import {getRankingMarkers} from '../../data';
import {layoutRegionLabels,regionLabelHTML,REGION_LABEL_SIZE,REGION_LABEL_ANCHOR} from './regionLabelLayout';
export default function NaverMapView({region,routes,selectedId,onSelect,onDetail,clientId,rankingRegions,onRegionSelect}) {
 const element=useRef(null),map=useRef(null),overlays=useRef([]);
 const fractionalZoom=useRef(false);
 const zoomController=useRef(null);
 const [ready,setReady]=useState(false),[tileError,setTileError]=useState(''),[layer,setLayer]=useState('standard');
 const [zoom,setZoom]=useState(7);
 const [minZoom,setMinZoom]=useState(6);
 const [viewRevision,setViewRevision]=useState(0);
 const rankingZoom=rankingRegions?zoom:null,rankingRevision=rankingRegions?viewRevision:null;
 const selected=rankingRegions?null:routes.find(r=>r.id===selectedId);
 useEffect(()=>{
  let disposed=false,observer,wheel;
  const authError=()=>{setReady(false);setTileError('네이버 지도 인증에 실패했습니다. Client ID와 등록 URL을 확인해주세요.');};
  window.addEventListener('naver-map-auth-error',authError);
  loadNaverMaps(clientId).then(n=>{
   if(disposed)return;
   map.current=new n.Map(element.current,{gl:true,center:new n.LatLng(37.8,128.2),zoom:7,minZoom:6,maxZoom:17,maxBounds:new n.LatLngBounds(new n.LatLng(32.5,124),new n.LatLng(39,130.5)),zoomControl:false,mapTypeControl:false,scaleControl:true,scrollWheel:false,overlayZoomEffect:'all',tileTransition:true,tileDuration:400,disableDoubleClickZoom:true,disableDoubleTapZoom:true});
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
   wheel=e=>{e.preventDefault();wheelDelta+=e.deltaY;if(Math.abs(wheelDelta)>=120){zoomController.current.change(wheelDelta<0?0.5:-0.5);wheelDelta=0;}};
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
  return ()=>{disposed=true;window.removeEventListener('naver-map-auth-error',authError);observer?.disconnect();element.current?.removeEventListener('wheel',wheel);overlays.current.forEach(o=>o.setMap(null));overlays.current=[];zoomController.current?.destroy();map.current?.destroy();map.current=null;};
 },[clientId]);
 useEffect(()=>{
  if(!ready)return;
  const n=window.naver.maps;
  map.current.setMapTypeId(layer==='standard'?n.MapTypeId.NORMAL:n.MapTypeId.SATELLITE);
 },[ready,layer]);
 useEffect(()=>{
  if(!ready)return;
  const n=window.naver.maps;
  zoomController.current.reset();
  if(region&&!rankingRegions&&routes.length)map.current.fitBounds(routes.flatMap(r=>r.coordinates.map(([lat,lng])=>new n.LatLng(lat,lng))),{top:65,right:65,bottom:120,left:50,maxZoom:14});
  else {map.current.setCenter(new n.LatLng(35.75,127.25));map.current.setZoom(map.current.getMinZoom(),false);}
 },[ready,region,routes,rankingRegions]);
 useEffect(()=>{
  if(!ready)return;
  const n=window.naver.maps;
  overlays.current.forEach(o=>{n.Event.clearInstanceListeners(o);o.setMap(null);});overlays.current=[];
  const marker=(position,content,size,anchor,onClick)=>{
   const m=new n.Marker({map:map.current,position:new n.LatLng(...position),icon:{content,size:new n.Size(...size),anchor:new n.Point(...anchor)},zIndex:100});
   if(onClick)n.Event.addListener(m,'click',onClick);
   overlays.current.push(m);
  };
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
   marker(route.coordinates[0],'<div class="start-container"><span class="start-pin"><i></i></span><span class="start-label">출발 · 도착</span></div>',[120,32],[16,16]);
   route.coordinates.slice(1,-1).forEach((p,i)=>marker(p,`<span class="waypoint">${i+1}</span>`,[18,18],[9,9]));
   route.coordinates.slice(0,-1).forEach((p,i)=>{
    const next=route.coordinates[i+1],angle=Math.atan2(-(next[0]-p[0]),(next[1]-p[1])*Math.cos(p[0]*Math.PI/180))*180/Math.PI;
    marker([(p[0]+next[0])/2,(p[1]+next[1])/2],`<span class="direction" style="transform:rotate(${angle}deg)">➤</span>`,[16,16],[8,8]);
   });
  });
 },[ready,routes,selectedId,onSelect,rankingRegions,onRegionSelect,rankingZoom,rankingRevision]);
 const changeZoom=delta=>{if(ready)zoomController.current.change(delta);};
 const recenter=()=>{
  if(!ready)return;
  const n=window.naver.maps;
  zoomController.current.reset();
  if(!rankingRegions&&routes.length)map.current.fitBounds(routes.flatMap(r=>r.coordinates.map(p=>new n.LatLng(...p))),{top:65,right:65,bottom:120,left:50,maxZoom:14});
  else {map.current.setCenter(new n.LatLng(35.75,127.25));map.current.setZoom(map.current.getMinZoom(),false);}
 };
 return <main className={`map-shell naver-map-shell`}><div className="map" ref={element}/>{!ready&&!tileError&&<div className="map-loading" role="status">네이버 지도를 불러오고 있습니다…</div>}<div className="map-location"><MapPin size={15}/>{rankingRegions?'전국 추천 지역':region?region.name:'대한민국'}<span>›</span><strong>{rankingRegions?'지역별 순위 지도':region?'추천 코스 지도':'연습 지역 둘러보기'}</strong></div><div className="map-top-note"><span className="green-dot"/> 천천히, 자신 있게 시작하세요</div><div className="map-controls" data-zoom={zoom}><button aria-label="일반 지도 / 위성 지도 전환" title="일반 지도 / 위성 지도 전환" className={layer==='satellite'?'on':''} onClick={()=>setLayer(l=>l==='standard'?'satellite':'standard')}><Layers size={21}/></button><div><button aria-label="지도 확대" disabled={!ready||zoom>=17} title={zoom>=17?"최대 확대 상태입니다":"지도 확대"} onClick={()=>changeZoom(0.5)}><Plus size={21}/></button><button aria-label="지도 축소" disabled={!ready||zoom<=minZoom} title={zoom<=minZoom?"최소 줌 6 상태입니다":"지도 축소"} onClick={()=>changeZoom(-0.5)}><Minus size={21}/></button></div><button aria-label="전체 코스 보기" title="전체 코스 보기" onClick={recenter}><LocateFixed size={21}/></button></div>{tileError&&<div className="tile-error" role="status">{tileError}<button className="map-retry" onClick={()=>window.location.reload()}>다시 연결</button></div>}{selected?<div className="map-selected"><span className="selected-icon"><Navigation size={22}/></span><div><small>지금 선택한 코스</small><strong>{selected.name}</strong><p>{selected.distance} km <i/> 약 {selected.duration}분 <i/> <span><Repeat2 size={12}/> 출발점으로 돌아오는 코스</span></p></div><button aria-label="선택 코스 상세 보기" onClick={()=>onDetail(selected.id)}><ChevronRight size={23}/></button></div>:!rankingRegions&&<div className="map-welcome"><span className="selected-icon"><Navigation size={22}/></span><div><strong>{rankingRegions?"지역을 누르면 코스를 추천해드려요":"첫 드라이브, 가까운 곳부터"}</strong><p>{rankingRegions?"지도 위 지역명이나 왼쪽 순위를 선택하세요.":"목록에서 지역을 선택하면 연습 코스를 볼 수 있어요."}</p></div></div>}<div className="map-legend"><span><i className={rankingRegions?"legend-region":"legend-line"}/>{rankingRegions?"추천 지역":"추천 코스"}</span><span><i className="legend-dot"/>{rankingRegions?"코스 보기":"출발 · 도착"}</span>{rankingRegions&&<small>확대하면 더 보기</small>}</div></main>;
}



















