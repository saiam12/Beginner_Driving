import React from 'react';
import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { Navigation,ArrowUpRight,MapPin,Sparkles,RefreshCw,ShieldCheck,Route,CarFront,X,Check } from 'lucide-react';
import Header from '../components/layout/Header';
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
 const scroller=useRef(null);
 useEffect(()=>{scroller.current?.scrollTo({top:0});},[region?.id,tab,detail,batch]);
 const showDetail=()=>{setTab('routes');setDetail(true);setMobileView('list');};
 const routes=useMemo(()=>region?getRoutes(region,batch,distanceRange,difficulty):[],[region,batch,distanceRange,difficulty]);
 const select=useCallback(id=>setSelectedId(id),[]);
 const search=value=>{
  const found=findRegion(value);setQuery(value);
  if(!found){setMobileView('list');scroller.current?.scrollTo({top:0});setError(value.trim()?'전국 서비스의 예시 지역을 검색해주세요. 예: 서울, 부산, 대전, 제주. 실제 장소 검색 API는 추후 연결됩니다.':'검색할 지역을 입력해주세요.');return;}
  setError('');setRegion(found);setBatch(0);setSelectedId(getRoutes(found,0,distanceRange,difficulty)[0].id);setTab('routes');setDetail(false);setMobileView('list');scroller.current?.scrollTo({top:0});
 };
 const home=()=>{setRegion(null);setQuery('');setTab('routes');setDetail(false);setError('');setMobileView('list');scroller.current?.scrollTo({top:0});};
 const reroll=()=>{const next=batch+1;setBatch(next);setSelectedId(getRoutes(region,next,distanceRange,difficulty)[0].id);setDetail(false);};
 const selected=routes.find(r=>r.id===selectedId);
 return <div className="app"><Header query={query} setQuery={value=>{setQuery(value);setError('');}} onSearch={search} onHome={home} onClear={home} error={error} onGuide={()=>setGuide(true)}/><div className="mobile-view-switch" role="group" aria-label="화면 보기"><button aria-pressed={mobileView==='list'} onClick={()=>setMobileView('list')}>목록 보기</button><button aria-pressed={mobileView==='map'} onClick={()=>setMobileView('map')}>지도 보기</button></div><div className={`workspace mobile-${mobileView}`}><ResizableSidebar><nav className="tabs"><button aria-pressed={tab==='routes'} className={tab==='routes'?'active':''} onClick={()=>{setTab('routes');setDetail(false);}}><Route size={17}/>추천 코스</button><button aria-pressed={tab==='ranking'} className={tab==='ranking'?'active':''} onClick={()=>setTab('ranking')}><ShieldCheck size={17}/>지역별 순위</button></nav><div className="sidebar-scroll" ref={scroller}>{tab==='routes'&&!detail&&<DistanceControl value={distanceRange} onChange={setDistanceRange} difficulty={difficulty} onDifficultyChange={level=>{setDifficulty(level);setBatch(0);setDetail(false);if(region)setSelectedId(getRoutes(region,0,distanceRange,level)[0].id);}}/>} {error&&<div id="search-error" className="search-error" role="alert">{error}<button aria-label="오류 닫기" onClick={()=>setError('')}><X size={15}/></button></div>}{tab==='ranking'?<RegionRanking onSearch={search}/>:detail&&selected?<RouteDetail route={selected} onBack={()=>setDetail(false)}/>:region?<><div className="results-heading"><span className="eyebrow"><MapPin size={12}/>{region.name}</span><h2>{region.short} 추천 코스<span>{routes.length}</span></h2><p>나에게 맞는 길에서, 차근차근 시작해요.</p><div className="result-note"><Sparkles size={15}/><span>4가지 도로 지표로 비교하는 추천 코스</span><span className="mock-badge">예시</span></div></div><div className="route-list">{routes.map(route=><RouteCard key={route.id} route={route} selected={selectedId===route.id} onSelect={select} onDetail={showDetail}/>)}</div><button className="reroll" onClick={reroll}><RefreshCw size={15}/> 다른 코스 추천받기</button><p className="data-note">경로와 AI 분석 점수는 예시 데이터입니다.</p></>:<div className="welcome"><div className="intro-label"><Sparkles size={13}/> AI 초보 운전 추천 코스</div><h1>첫 운전의 설렘,<br/>편안한 길에서.</h1><p className="intro-text">지역과 거리, 난이도를 골라<br/>나에게 맞는 연습 코스를 살펴보세요.</p><DrivingIllustration/><h3>어느 지역에서 연습할까요?</h3><p className="subtext">지역을 선택하면 코스를 추천해드려요.</p><div className="region-chips">{regions.filter(r=>r.featured).sort((a,b)=>["mapo","busan","daejeon","suseong"].indexOf(a.id)-["mapo","busan","daejeon","suseong"].indexOf(b.id)).map(r=><button key={r.id} onClick={()=>search(r.name)}><MapPin size={14}/><span>{r.name}</span><ArrowUpRight size={14}/></button>)}</div><div className="how-it-works"><span className="eyebrow">나의 첫 코스 찾기</span>{[['01','연습할 지역을 검색하세요'],['02','나에게 맞는 코스를 비교하세요'],['03','출발점으로 돌아오는 길을 연습하세요']].map(([n,t])=><div key={n}><span>{n}</span>{t}</div>)}</div><div className="welcome-analysis"><ShieldCheck size={20}/><div><strong>더 편안한 연습을 위한 4가지 기준</strong><p>차로 수 · 교통사고 · 교통량 · 유동인구</p></div></div></div>}</div><footer className="sidebar-footer"><span className="green-dot"/> 작은 시작이, 자신 있는 운전으로 <Navigation size={13}/></footer></ResizableSidebar><MapView rankingRegions={tab==="ranking"?rankedRegions:null} onRegionSelect={search} region={region} routes={routes} selectedId={selectedId} onSelect={select} onDetail={showDetail}/></div>{guide&&<Modal titleId="guide-title" onClose={()=>setGuide(false)}><button className="modal-close" aria-label="이용 안내 닫기" onClick={()=>setGuide(false)}><X size={20}/></button><span className="eyebrow">차근차근 이용 안내</span><h2 id="guide-title">가까운 곳부터 시작해보세요</h2><p>지역 검색 → 코스 비교 → 지도에서 선택 → 상세 정보 확인 순서로 이용해보세요.</p><p>전국을 대상으로 하는 서비스입니다. 현재는 서울·부산·대전·제주 등 17개 시·도의 대표 지역과 등록된 장소를 예시 데이터로 검색할 수 있습니다. 모든 지역·도로명·장소 검색은 실제 검색 API 연결 후 지원됩니다. 지도는 드래그하거나 + / − 버튼으로 확대·축소할 수 있습니다.</p><div className="reason"><strong>현재는 프론트엔드 프로토타입입니다</strong><p>점수와 순위는 예시이며, 경로는 실제 도로 연결·일방통행·주행 가능 여부를 반영하지 않은 mock 좌표입니다.</p></div><button className="primary-button" onClick={()=>setGuide(false)}>시작하기</button></Modal>}</div>;
}










