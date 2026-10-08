import {MAX_DISTANCE} from '../lib/distance-range';
import React from 'react';
import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { ArrowUpRight,MapPin,Bookmark,Route,X } from 'lucide-react';
import Header from '../components/layout/Header';
import RoadInfo from '../components/map/RoadInfo';
import {loadRoadGroup} from '../lib/road-search';
import DistanceControl from '../components/courses/DistanceControl';
import DriverPreferences from '../components/courses/DriverPreferences';
import {DEFAULT_DRIVER_PROFILE} from '../lib/driver-preferences';
import MapView from '../components/map/MapView';
import Modal from '../components/ui/Modal';
import ResizableSidebar from '../components/layout/ResizableSidebar';
import RouteCard from '../components/courses/RouteCard';
import DesiredRegion from '../components/courses/DesiredRegion';
import SavedCourses from '../components/courses/SavedCourses';
import {readSavedCourses,saveCourse,removeSavedCourse,courseToSavedRoute} from '../lib/saved-courses';
import RouteDetail from '../components/courses/RouteDetail';
import {regions,findRegion,getRoutes} from '../data';
export default function MainPage() {
 const [query,setQuery]=useState(''),[region,setRegion]=useState(()=>regions.find(r=>r.id==='mapo')),[batch,setBatch]=useState(0),[selectedId,setSelectedId]=useState('seoul-link-1'),[tab,setTab]=useState('routes'),[detail,setDetail]=useState(false),[error,setError]=useState(''),[guide,setGuide]=useState(false);
 const [distanceRange,setDistanceRange]=useState({min:5,max:10});
 const [difficulty,setDifficulty]=useState('전체');
 const [mobileView,setMobileView]=useState('list');
 const [laneSelection,setLaneSelection]=useState([]);
 const [driverProfile,setDriverProfile]=useState(DEFAULT_DRIVER_PROFILE);
 const scroller=useRef(null),roadRequest=useRef(null);
 const [selectedRoad,setSelectedRoad]=useState(null),[selectedArea,setSelectedArea]=useState(null),[roadBusy,setRoadBusy]=useState(false),[pendingRoad,setPendingRoad]=useState(null);
 // The selected road keeps exact LINK_IDs for a future route/scoring pipeline.
 const [selectedAreas,setSelectedAreas]=useState([]),[provinceFocus,setProvinceFocus]=useState(null),[savedCourses,setSavedCourses]=useState([]),[openedSaved,setOpenedSaved]=useState(null),[saveMessage,setSaveMessage]=useState(''),[saveError,setSaveError]=useState('');
 useEffect(()=>{try{setSavedCourses(readSavedCourses(localStorage));}catch(e){setSaveError(e.message);}},[]);
 const preferredArea=selectedAreas[0]||null,destinationArea=selectedAreas.length>1?selectedAreas.at(-1):null;
 const handleSave=useCallback((course,metadata={})=>{try{const route=courseToSavedRoute(course,{regionName:preferredArea?.name||region?.name, destinationName:destinationArea?.name,profile:driverProfile,...metadata});const result=saveCourse(localStorage,route);setSavedCourses(result.items);setSaveError('');setSaveMessage(result.duplicate?'이미 저장한 코스입니다.':'코스를 저장했습니다. 저장 코스 탭에서 다시 열 수 있습니다.');}catch(e){setSaveError(e.message);}},[preferredArea,region,destinationArea,driverProfile]);
 const removeSaved=id=>{try{setSavedCourses(removeSavedCourse(localStorage,id));setSaveMessage('저장 코스를 삭제했습니다.');setSaveError('');}catch(e){setSaveError(e.message);}};
 const openSaved=course=>{resetRoad();setSelectedAreas([]);setProvinceFocus(null);setOpenedSaved(course);setRegion({id:course.id,name:course.regionName||'저장 코스',short:'저장',center:course.coordinates[0]});setSelectedId(course.id);setTab('routes');setDetail(true);setMobileView('map');};
 const chooseRegions=areas=>{resetRoad();setOpenedSaved(null);setSelectedAreas(areas);setProvinceFocus(null);setRegion(null);setSelectedArea(areas.at(-1)||null);setDetail(false);setError('');};
 const selectedLinkIds=selectedRoad?.linkIds??[];
 useEffect(()=>()=>roadRequest.current?.abort(),[]);
 const resetRoad=useCallback(()=>{roadRequest.current?.abort();setRoadBusy(false);setPendingRoad(null);setSelectedRoad(null);setSelectedArea(null);},[]);
 const chooseResult=async item=>{
  if(item.kind==='region'){search(item.name);return;}
  roadRequest.current?.abort();setError('');setTab('routes');setDetail(false);
  if(item.kind==='area'){setOpenedSaved(null);setSelectedAreas([item]);setProvinceFocus(null);setRegion(null);setSelectedRoad(null);setSelectedArea(item);setRoadBusy(false);setPendingRoad(null);setMobileView('map');return;}
  const controller=new AbortController();roadRequest.current=controller;setRoadBusy(true);setPendingRoad(item);
  try{
   const road=await loadRoadGroup(item,{signal:controller.signal});
   if(controller.signal.aborted)return;
   setRegion(null);setSelectedArea(null);setSelectedRoad(road);setPendingRoad(null);setMobileView('map');scroller.current?.scrollTo({top:0});
  }catch(e){if(!controller.signal.aborted)setError(e.message);}
  finally{if(!controller.signal.aborted)setRoadBusy(false);}
 };
 useEffect(()=>{scroller.current?.scrollTo({top:0});},[region?.id,tab,detail,batch]);
 const showDetail=()=>{setTab('routes');setDetail(true);setMobileView('list');};
 const routes=useMemo(()=>openedSaved?[openedSaved]:region?getRoutes(region,batch,distanceRange,difficulty,driverProfile):[],[region,batch,distanceRange,difficulty,driverProfile,openedSaved]);
 useEffect(()=>{if(!routes.some(r=>r.id===selectedId))setSelectedId(routes[0]?.id??null);},[routes,selectedId]);
 const select=useCallback(id=>setSelectedId(id),[]);
 const search=useCallback(value=>{
  resetRoad();setOpenedSaved(null);setSelectedAreas([]);setProvinceFocus(null);
  const found=findRegion(value);setQuery(value);
  if(!found){setMobileView('list');scroller.current?.scrollTo({top:0});setError(value.trim()?'검색 결과에서 지역이나 도로를 선택해주세요. 예: 구로구, 공원로.':'검색할 지역을 입력해주세요.');return;}
  setError('');setRegion(found);setBatch(0);setSelectedId(getRoutes(found,0,distanceRange,difficulty,driverProfile)[0]?.id??null);setTab('routes');setDetail(false);setMobileView('list');scroller.current?.scrollTo({top:0});
 },[resetRoad,distanceRange,difficulty,driverProfile]);
 const home=()=>{resetRoad();setOpenedSaved(null);setSelectedAreas([]);setProvinceFocus(null);setRegion(null);setQuery('');setTab('routes');setDetail(false);setError('');setMobileView('list');scroller.current?.scrollTo({top:0});};
 const selected=routes.find(r=>r.id===selectedId);
 return <div className="app"><Header laneSelection={laneSelection} onLaneChange={setLaneSelection} query={query} setQuery={value=>{roadRequest.current?.abort();setRoadBusy(false);setPendingRoad(null);setQuery(value);setError('');}} onSearch={search} onHome={home} onClear={home} onResultSelect={chooseResult} error={error} onGuide={()=>setGuide(true)}/><div className="mobile-view-switch" role="group" aria-label="화면 보기"><button aria-pressed={mobileView==='list'} onClick={()=>setMobileView('list')}>목록 보기</button><button aria-pressed={mobileView==='map'} onClick={()=>setMobileView('map')}>지도 보기</button></div><div className={`workspace mobile-${mobileView}`}><ResizableSidebar><nav className="tabs"><button aria-pressed={tab==='routes'} className={tab==='routes'?'active':''} onClick={()=>{setTab('routes');setDetail(false);}}><Route size={17}/>추천 코스</button><button aria-pressed={tab==='area'} className={tab==='area'?'active':''} onClick={()=>setTab('area')}><MapPin size={17}/>희망 지역</button><button aria-pressed={tab==='saved'} className={tab==='saved'?'active':''} onClick={()=>setTab('saved')}><Bookmark size={17}/>저장 코스</button></nav><div className="sidebar-scroll" ref={scroller}>{tab==='routes'&&!detail&&<><DistanceControl maxDistance={MAX_DISTANCE} value={distanceRange} onChange={setDistanceRange} difficulty={difficulty} onDifficultyChange={level=>{setDifficulty(level);setBatch(0);setDetail(false);if(region)setSelectedId(getRoutes(region,0,distanceRange,level,driverProfile)[0]?.id??null);}}/><DriverPreferences value={driverProfile} onChange={setDriverProfile}/></>} {error&&<div id="search-error" className="search-error" role="alert">{error}<button aria-label="오류 닫기" onClick={()=>setError('')}><X size={15}/></button></div>}{roadBusy&&<div className="search-status" role="status">선택한 도로를 불러오고 있습니다…</div>}{error&&pendingRoad&&!roadBusy&&<button className="reroll" onClick={()=>chooseResult(pendingRoad)}>도로 다시 불러오기</button>}{saveMessage&&<p className="data-note" role="status">{saveMessage}</p>}{saveError&&<p className="search-error" role="alert">{saveError}</p>}{tab==='area'?<DesiredRegion selectedAreas={selectedAreas} onChangeAreas={chooseRegions} onProvinceSelect={value=>setProvinceFocus(value)}/>:tab==='saved'?<SavedCourses courses={savedCourses} onOpen={openSaved} onRemove={removeSaved}/>:selectedRoad?<RoadInfo road={selectedRoad}/>:selectedArea?<section className="results-heading"><span className="eyebrow"><MapPin size={12}/>선택한 지역</span><h2>{selectedArea.name}</h2><p>지도에서 지역을 확인하고, 출발 지역 안의 도로에서 시작하며, 도착 지역을 지정하면 편도 코스를 탐색합니다.</p><p className="data-note">지도에서 후보 찾기를 눌러 실제 코스를 추천받으세요.</p></section>:detail&&selected?<RouteDetail route={selected} onBack={()=>setDetail(false)}/>:region?<><div className="results-heading"><span className="eyebrow"><MapPin size={12}/>{region.name}</span><h2>{region.id==='mapo'?'서울':region.short} 추천 코스<span>{routes.length}</span></h2><p>{region.id==='mapo'?'실제 도로를 연결한 서울 코스를 비교할 수 있습니다.':'지도를 확대해 이 지역의 실제 코스를 찾아주세요.'}</p><div className="result-note"><span>표준노드링크 기반</span><span className="mock-badge">실제 도로</span></div></div>{!routes.length&&<p className="data-note">현재 조건에 맞는 저장 코스가 없습니다. 지도를 확대해 새로운 후보를 찾아주세요.</p>}<div className="route-list">{routes.map(route=><RouteCard key={route.id} route={route} selected={selectedId===route.id} onSave={handleSave} onSelect={select} onDetail={showDetail}/>)}</div><p className="data-note">거리는 실제 도로 형상 기준이며, 시간은 시속 25km를 가정한 추정치입니다. 교통량·사고 데이터는 아직 반영하지 않았습니다.</p></>:<div className="welcome"><h1>연습할 지역을 선택하세요</h1><p className="intro-text">지역을 검색하고 지도를 확대하면 현재 범위에서 코스를 찾을 수 있습니다.</p><h3>지역별 코스 탐색</h3><div className="region-chips">{regions.filter(r=>r.featured).sort((a,b)=>["mapo","busan","daejeon","suseong"].indexOf(a.id)-["mapo","busan","daejeon","suseong"].indexOf(b.id)).map(r=><button key={r.id} onClick={()=>search(r.name)}><MapPin size={14}/><span>{r.name}</span><ArrowUpRight size={14}/></button>)}</div><p className="welcome-note">서울 저장 코스 외의 지역은 지도를 확대해서 후보를 탐색해주세요.</p></div>}</div><footer className="sidebar-footer">표준노드링크 기반 · 초보 운전 연습 코스</footer></ResizableSidebar><MapView provinceFocus={provinceFocus} routeAreas={selectedAreas} routeBatch={batch} difficulty={difficulty} driverProfile={driverProfile} distanceRange={distanceRange} laneSelection={laneSelection} preferredArea={preferredArea} destinationArea={destinationArea} onSaveCourse={handleSave} selectedRoad={selectedRoad} selectedArea={selectedArea} selectedLinkIds={tab==='routes'?selectedLinkIds:[]} rankingRegions={null} onRegionSelect={search} region={region} routes={routes} selectedId={selectedId} onSelect={select} onDetail={showDetail}/>{(roadBusy||error&&pendingRoad)&&<div className="mobile-road-status" role="status">{roadBusy?"선택한 도로를 불러오고 있습니다…":<>{error}<button onClick={()=>chooseResult(pendingRoad)}>도로 다시 불러오기</button></>}</div>}</div>{guide&&<Modal titleId="guide-title" onClose={()=>setGuide(false)}><button className="modal-close" aria-label="이용 안내 닫기" onClick={()=>setGuide(false)}><X size={20}/></button><span className="eyebrow">차근차근 이용 안내</span><h2 id="guide-title">가까운 곳부터 시작해보세요</h2><p>지역 검색 → 코스 비교 → 지도에서 선택 → 상세 정보 확인 순서로 이용해보세요.</p><p>전국을 대상으로 하는 서비스입니다. 현재는 서울·부산·대전·제주 등 17개 시·도의 대표 지역과 등록된 장소를 예시 데이터로 검색할 수 있습니다. 도로명은 실제 표준노드링크 데이터를 검색하며, 같은 이름의 도로는 연결된 구간과 실제 지역으로 구분합니다. 시·군·구 검색은 행정구역 경계를 기준으로 지도를 이동합니다. 일반 장소 검색은 등록된 별칭만 지원합니다. 지도는 드래그하거나 + / − 버튼으로 확대·축소할 수 있습니다.</p><div className="reason"><strong>실제 도로와 예시 코스를 구분해주세요</strong><p>서울 저장 코스는 실제 표준노드링크 도로를 연결한 경로입니다. 실시간 교통·사고·통행 제한은 반영하지 않았으며, 저장 코스는 이 브라우저에서 다시 열 수 있습니다.</p></div><button className="primary-button" onClick={()=>setGuide(false)}>시작하기</button></Modal>}</div>;
}










