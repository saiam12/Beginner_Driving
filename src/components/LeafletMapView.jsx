import React from 'react';
import { useEffect,useRef,useState } from 'react';
import L from 'leaflet';
import { Plus,Minus,LocateFixed,Layers,MapPin,Navigation,Repeat2,ChevronRight } from 'lucide-react';
import addRoutePolyline from './RoutePolyline';
import {getRankingMarkers} from '../data';
import {layoutRegionLabels,regionLabelHTML,REGION_LABEL_SIZE,REGION_LABEL_ANCHOR} from './regionLabelLayout';
const KOREA_BOUNDS = L.latLngBounds([32.5,124],[39,130.5]);
const HOME_CENTER = [37.8,128.2];
const MIN_ZOOM = 6;

export default function MapView({region,routes,selectedId,onSelect,onDetail,rankingRegions,onRegionSelect}) {
 const element=useRef(null),map=useRef(null),routeGroup=useRef(null); const [tileError,setTileError]=useState(false),[layer,setLayer]=useState('standard');
 const selected=rankingRegions?null:routes.find(r=>r.id===selectedId);
 useEffect(()=>{
  map.current=L.map(element.current,{zoomControl:false,center:HOME_CENTER,zoom:MIN_ZOOM,minZoom:MIN_ZOOM,maxZoom:17,zoomSnap:0.5,zoomDelta:0.5,wheelPxPerZoomLevel:120,maxBounds:KOREA_BOUNDS,maxBoundsViscosity:1});
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
  setTileError(false);
  const url='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const tiles=L.tileLayer(url,{maxZoom:17,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map.current);
  tiles.on('tileerror',()=>setTileError(true));
  return ()=>tiles.remove();
 },[]);
 useEffect(()=>{
  if(rankingRegions) map.current.setView(KOREA_BOUNDS.getCenter(),map.current.getMinZoom());
  else if(region) map.current.flyToBounds(L.latLngBounds(routes.flatMap(r=>r.coordinates)),{paddingTopLeft:[50,65],paddingBottomRight:[65,120],maxZoom:14,duration:1});
  else map.current.setView(KOREA_BOUNDS.getCenter(),map.current.getMinZoom());
 },[region,routes,rankingRegions]);
 useEffect(()=>{
  const draw=()=>{
   routeGroup.current.clearLayers();
   if(rankingRegions){
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
 },[routes,selectedId,onSelect,rankingRegions,onRegionSelect]);
 const recenter=()=>!rankingRegions&&routes.length?map.current.fitBounds(L.latLngBounds(routes.flatMap(r=>r.coordinates)),{padding:[65,85]}):map.current.setView(KOREA_BOUNDS.getCenter(),map.current.getMinZoom());
 return <main className={`map-shell ${layer === "light" ? "map-light" : ""}`}><div className="map" ref={element}/><div className="map-location"><MapPin size={15}/>{rankingRegions?'전국 추천 지역':region?region.name:'대한민국'}<span>›</span><strong>{rankingRegions?'지역별 순위 지도':region?'추천 코스 지도':'연습 지역 둘러보기'}</strong></div><div className="map-top-note"><span className="green-dot"/> 천천히, 자신 있게 시작하세요</div><div className="map-controls"><button aria-label="지도 스타일 변경" title="지도 스타일 변경" className={layer==='light'?'on':''} onClick={()=>setLayer(l=>l==='standard'?'light':'standard')}><Layers size={21}/></button><div><button aria-label="지도 확대" onClick={()=>map.current.zoomIn(0.5)}><Plus size={21}/></button><button aria-label="지도 축소" onClick={()=>map.current.zoomOut(0.5)}><Minus size={21}/></button></div><button aria-label="전체 코스 보기" title="전체 코스 보기" onClick={recenter}><LocateFixed size={21}/></button></div>{tileError&&<div className="tile-error" role="status">지도 타일을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 페이지를 새로고침해주세요.</div>}{selected?<div className="map-selected"><span className="selected-icon"><Navigation size={22}/></span><div><small>지금 선택한 코스</small><strong>{selected.name}</strong><p>{selected.distance} km <i/> 약 {selected.duration}분 <i/> <span><Repeat2 size={12}/> 출발점으로 돌아오는 코스</span></p></div><button aria-label="선택 코스 상세 보기" onClick={()=>onDetail(selected.id)}><ChevronRight size={23}/></button></div>:!rankingRegions&&<div className="map-welcome"><span className="selected-icon"><Navigation size={22}/></span><div><strong>{rankingRegions?"지역을 누르면 코스를 추천해드려요":"첫 드라이브, 가까운 곳부터"}</strong><p>{rankingRegions?"지도 위 지역명이나 왼쪽 순위를 선택하세요.":"목록에서 지역을 선택하면 연습 코스를 볼 수 있어요."}</p></div></div>}<div className="map-legend"><span><i className={rankingRegions?"legend-region":"legend-line"}/>{rankingRegions?"추천 지역":"추천 코스"}</span><span><i className="legend-dot"/>{rankingRegions?"코스 보기":"출발 · 도착"}</span>{rankingRegions&&<small>확대하면 더 보기</small>}</div></main>;
}
















