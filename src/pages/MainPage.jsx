import React from 'react';
import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { Navigation,ArrowUpRight,MapPin,Sparkles,RefreshCw,ShieldCheck,Route,CarFront,X,Check } from 'lucide-react';
import Header from '../components/layout/Header';
import RoadInfo from '../components/map/RoadInfo';
import {loadRoadGroup} from '../lib/road-search';
import DistanceControl from '../components/courses/DistanceControl';
import DrivingIllustration from '../components/courses/DrivingIllustration';
import MapView from '../components/map/MapView';
import Modal from '../components/ui/Modal';
import ResizableSidebar from '../components/layout/ResizableSidebar';
import RouteCard from '../components/courses/RouteCard';
import RegionRanking from '../components/courses/RegionRanking';
import RouteDetail from '../components/courses/RouteDetail';
import {regions,rankedRegions,findRegion,getRoutes} from '../data';
export default function MainPage() {
 const [query,setQuery]=useState(''),[region,setRegion]=useState(null),[batch,setBatch]=useState(0),[selectedId,setSelectedId]=useState(null),[tab,setTab]=useState('routes'),[detail,setDetail]=useState(false),[error,setError]=useState(''),[guide,setGuide]=useState(false);
 const [distanceRange,setDistanceRange]=useState({min:5,max:10});
 const [difficulty,setDifficulty]=useState('전체');
 const [mobileView,setMobileView]=useState('list');
 const [laneSelection,setLaneSelection]=useState([]);
 const scroller=useRef(null),roadRequest=useRef(null);
 const [selectedRoad,setSelectedRoad]=useState(null),[selectedArea,setSelectedArea]=useState(null),[roadBusy,setRoadBusy]=useState(false),[pendingRoad,setPendingRoad]=useState(null);
 // The selected road keeps exact LINK_IDs for a future route/scoring pipeline.
 const selectedLinkIds=selectedRoad?.linkIds??[];
 useEffect(()=>()=>roadRequest.current?.abort(),[]);
 const resetRoad=useCallback(()=>{roadRequest.current?.abort();setRoadBusy(false);setPendingRoad(null);setSelectedRoad(null);setSelectedArea(null);},[]);
 const chooseResult=async item=>{
  if(item.kind==='region'){search(item.name);return;}
  roadRequest.current?.abort();setError('');setTab('routes');setDetail(false);
  if(item.kind==='area'){setRegion(null);setSelectedRoad(null);setSelectedArea(item);setRoadBusy(false);setPendingRoad(null);setMobileView('map');return;}
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
 const routes=useMemo(()=>region?getRoutes(region,batch,distanceRange,difficulty):[],[region,batch,distanceRange,difficulty]);
 const select=useCallback(id=>setSelectedId(id),[]);
 const search=useCallback(value=>{
  resetRoad();
  const found=findRegion(value);setQuery(value);
  if(!found){setMobileView('list');scroller.current?.scrollTo({top:0});setError(value.trim()?'검색 결과에서 지역이나 도로를 선택해주세요. 예: 구로구, 공원로.':'검색할 지역을 입력해주세요.');return;}
  setError('');setRegion(found);setBatch(0);setSelectedId(getRoutes(found,0,distanceRange,difficulty)[0].id);setTab('routes');setDetail(false);setMobileView('list');scroller.current?.scrollTo({top:0});
 },[resetRoad,distanceRange,difficulty]);
 const home=()=>{resetRoad();setRegion(null);setQuery('');setTab('routes');setDetail(false);setError('');setMobileView('list');scroller.current?.scrollTo({top:0});};
 const reroll=()=>{const next=batch+1;setBatch(next);setSelectedId(getRoutes(region,next,distanceRange,difficulty)[0].id);setDetail(false);};
 const selected=routes.find(r=>r.id===selectedId);
 return <div className="app"><Header laneSelection={laneSelection} onLaneChange={value=>{setLaneSelection(value);if(value.length)setMobileView('map');}} query={query} setQuery={value=>{roadRequest.current?.abort();setRoadBusy(false);setPendingRoad(null);setQuery(value);setError('');}} onSearch={search} onHome={home} onClear={home} onResultSelect={chooseResult} error={error} onGuide={()=>setGuide(true)}/><div className="mobile-view-switch" role="group" aria-label="화면 보기"><button aria-pressed={mobileView==='list'} onClick={()=>setMobileView('list')}>목록 보기</button><button aria-pressed={mobileView==='map'} onClick={()=>setMobileView('map')}>지도 보기</button></div><div className={`workspace mobile-${mobileView}`}><ResizableSidebar><nav className="tabs"><button aria-pressed={tab==='routes'} className={tab==='routes'?'active':''} onClick={()=>{setTab('routes');setDetail(false);}}><Route size={17}/>추천 코스</button><button aria-pressed={tab==='ranking'} className={tab==='ranking'?'active':''} onClick={()=>setTab('ranking')}><ShieldCheck size={17}/>지역별 순위</button></nav><div className="sidebar-scroll" ref={scroller}>{tab==='routes'&&!detail&&<DistanceControl value={distanceRange} onChange={setDistanceRange} difficulty={difficulty} onDifficultyChange={level=>{setDifficulty(level);setBatch(0);setDetail(false);if(region)setSelectedId(getRoutes(region,0,distanceRange,level)[0].id);}}/>} {error&&<div id="search-error" className="search-error" role="alert">{error}<button aria-label="오류 닫기" onClick={()=>setError('')}><X size={15}/></button></div>}{roadBusy&&<div className="search-status" role="status">선택한 도로를 불러오고 있습니다…</div>}{error&&pendingRoad&&!roadBusy&&<button className="reroll" onClick={()=>chooseResult(pendingRoad)}>도로 다시 불러오기</button>}{tab==='ranking'?<RegionRanking onSearch={search}/>:selectedRoad?<RoadInfo road={selectedRoad}/>:selectedArea?<section className="results-heading"><span className="eyebrow"><MapPin size={12}/>선택한 지역</span><h2>{selectedArea.name}</h2><p>지도에서 지역을 확인하고, 검색창에 도로명을 입력해 실제 도로를 선택해보세요.</p><p className="data-note">이 지역의 실제 추천 코스는 아직 계산하지 않습니다.</p></section>:detail&&selected?<RouteDetail route={selected} onBack={()=>setDetail(false)}/>:region?<><div className="results-heading"><span className="eyebrow"><MapPin size={12}/>{region.name}</span><h2>{region.short} 추천 코스<span>{routes.length}</span></h2><p>나에게 맞는 길에서, 차근차근 시작해요.</p><div className="result-note"><Sparkles size={15}/><span>4가지 도로 지표로 비교하는 추천 코스</span><span className="mock-badge">예시</span></div></div><div className="route-list">{routes.map(route=><RouteCard key={route.id} route={route} selected={selectedId===route.id} onSelect={select} onDetail={showDetail}/>)}</div><button className="reroll" onClick={reroll}><RefreshCw size={15}/> 다른 코스 추천받기</button><p className="data-note">경로와 AI 분석 점수는 예시 데이터입니다.</p></>:<div className="welcome"><div className="intro-label"><Sparkles size={13}/> AI 초보 운전 추천 코스</div><h1>첫 운전의 설렘,<br/>편안한 길에서.</h1><p className="intro-text">지역과 거리, 난이도를 골라<br/>나에게 맞는 연습 코스를 살펴보세요.</p><DrivingIllustration/><h3>어느 지역에서 연습할까요?</h3><p className="subtext">지역을 선택하면 코스를 추천해드려요.</p><div className="region-chips">{regions.filter(r=>r.featured).sort((a,b)=>["mapo","busan","daejeon","suseong"].indexOf(a.id)-["mapo","busan","daejeon","suseong"].indexOf(b.id)).map(r=><button key={r.id} onClick={()=>search(r.name)}><MapPin size={14}/><span>{r.name}</span><ArrowUpRight size={14}/></button>)}</div><div className="how-it-works"><span className="eyebrow">나의 첫 코스 찾기</span>{[['01','연습할 지역을 검색하세요'],['02','나에게 맞는 코스를 비교하세요'],['03','출발점으로 돌아오는 길을 연습하세요']].map(([n,t])=><div key={n}><span>{n}</span>{t}</div>)}</div><div className="welcome-analysis"><ShieldCheck size={20}/><div><strong>더 편안한 연습을 위한 4가지 기준</strong><p>차로 수 · 교통사고 · 교통량 · 유동인구</p></div></div></div>}</div><footer className="sidebar-footer"><span className="green-dot"/> 작은 시작이, 자신 있는 운전으로 <Navigation size={13}/></footer></ResizableSidebar><MapView distanceRange={distanceRange} laneSelection={laneSelection} selectedRoad={tab==='routes'?selectedRoad:null} selectedArea={tab==='routes'?selectedArea:null} selectedLinkIds={tab==='routes'?selectedLinkIds:[]} rankingRegions={tab==="ranking"?rankedRegions:null} onRegionSelect={search} region={region} routes={routes} selectedId={selectedId} onSelect={select} onDetail={showDetail}/>{(roadBusy||error&&pendingRoad)&&<div className="mobile-road-status" role="status">{roadBusy?"선택한 도로를 불러오고 있습니다…":<>{error}<button onClick={()=>chooseResult(pendingRoad)}>도로 다시 불러오기</button></>}</div>}</div>{guide&&<Modal titleId="guide-title" onClose={()=>setGuide(false)}><button className="modal-close" aria-label="이용 안내 닫기" onClick={()=>setGuide(false)}><X size={20}/></button><span className="eyebrow">차근차근 이용 안내</span><h2 id="guide-title">가까운 곳부터 시작해보세요</h2><p>지역 검색 → 코스 비교 → 지도에서 선택 → 상세 정보 확인 순서로 이용해보세요.</p><p>전국을 대상으로 하는 서비스입니다. 현재는 서울·부산·대전·제주 등 17개 시·도의 대표 지역과 등록된 장소를 예시 데이터로 검색할 수 있습니다. 도로명은 실제 표준노드링크 데이터를 검색하며, 같은 이름의 도로는 연결된 구간과 실제 지역으로 구분합니다. 시·군·구 검색은 행정구역 경계를 기준으로 지도를 이동합니다. 일반 장소 검색은 등록된 별칭만 지원합니다. 지도는 드래그하거나 + / − 버튼으로 확대·축소할 수 있습니다.</p><div className="reason"><strong>실제 도로와 예시 코스를 구분해주세요</strong><p>점수와 순위는 예시이며, 경로는 실제 도로 연결·일방통행·주행 가능 여부를 반영하지 않은 mock 좌표입니다.</p></div><button className="primary-button" onClick={()=>setGuide(false)}>시작하기</button></Modal>}</div>;
}










