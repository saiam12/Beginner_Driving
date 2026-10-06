import React, {useEffect,useRef,useState} from 'react';
import {CarFront,Search,ArrowUpRight,X,MapPin} from 'lucide-react';
import LaneFilter from './LaneFilter';
import {findRegion} from '../../data';
import {searchRoads,laneLabel,regionLabel} from '../../lib/road-search';
export default function Header({query,setQuery,onSearch,onHome,onGuide,onClear,error,onResultSelect,laneSelection,onLaneChange}) {
 const input=useRef(null),container=useRef(null),request=useRef(null),revision=useRef(0),suppress=useRef(false);
 const [open,setOpen]=useState(false),[composing,setComposing]=useState(false),[busy,setBusy]=useState(false),[failure,setFailure]=useState('');
 const [results,setResults]=useState({items:[],cursor:null,total:0});
 const lookup=async(value,more=false)=>{
  request.current?.abort();const controller=new AbortController();request.current=controller;const version=++revision.current;
  if(!value.trim()){setOpen(false);setBusy(false);setResults({items:[],cursor:null,total:0});return;}
  setOpen(true);setBusy(true);setFailure('');
  try{
   const next=await searchRoads(value,{signal:controller.signal,cursor:more?results.cursor:null});
   if(version!==revision.current)return;
   setResults({...next,items:more?[...results.items,...next.items]:next.items});
  }catch(e){if(!controller.signal.aborted&&version===revision.current)setFailure(e.message);}
  finally{if(version===revision.current)setBusy(false);}
 };
 useEffect(()=>{
  request.current?.abort();revision.current++;setBusy(false);setFailure('');setResults({items:[],cursor:null,total:0});
  if(!query.trim()||composing||suppress.current||document.activeElement!==input.current){setOpen(false);return;}
  const timer=setTimeout(()=>lookup(query),300);
  return()=>{clearTimeout(timer);request.current?.abort();revision.current++;};
 },[query,composing]);
 useEffect(()=>{
  const close=e=>{if(!container.current?.contains(e.target))setOpen(false);};
  document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);
 },[]);
 const close=()=>{request.current?.abort();revision.current++;setBusy(false);setOpen(false);};
 const select=item=>{input.current?.focus();close();suppress.current=true;onResultSelect(item);};
 const submit=e=>{
  e.preventDefault();if(composing||e.nativeEvent.isComposing)return;
  const region=findRegion(query);
  if(region){close();onSearch(query);}else if(!query.trim()){close();onSearch(query);}else lookup(query);
 };
 return <header className="header"><button className="brand" onClick={()=>{close();onHome();}}><span className="brand-icon"><CarFront size={25}/></span><span>차근차근<small>초보 운전 연습 코스</small></span></button><div className="search-container" ref={container} onKeyDown={e=>{if(e.key==='Escape'){input.current?.focus();close();}if(['ArrowDown','ArrowUp'].includes(e.key)&&e.target.classList.contains('search-result')){e.preventDefault();const items=[...container.current.querySelectorAll('.search-result')],i=items.indexOf(e.target),next=i+(e.key==='ArrowDown'?1:-1);if(next<0)input.current?.focus();else items[Math.min(next,items.length-1)]?.focus();}}} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}}><form className="search" noValidate onSubmit={submit}><Search size={20}/><input ref={input} aria-label="지역 또는 도로 검색" aria-invalid={!!error} aria-describedby={error?'search-error':undefined} aria-controls={open?'road-search-results':undefined} placeholder="지역·도로 검색 (예: 마포구, 공원로)" value={query} onChange={e=>{suppress.current=false;setQuery(e.target.value);}} onCompositionStart={()=>setComposing(true)} onCompositionEnd={()=>setComposing(false)} onFocus={()=>{if(results.items.length)setOpen(true);}} onKeyDown={e=>{if(e.key==='Enter'&&(e.nativeEvent.isComposing||e.keyCode===229))e.preventDefault();if(e.key==='ArrowDown'&&!composing&&open){e.preventDefault();container.current?.querySelector('.search-result')?.focus();}}}/>{query&&<button className="search-clear" type="button" aria-label="검색어 지우기" title="검색어 지우기" onClick={()=>{close();onClear();input.current?.focus();}}><X size={17}/></button>}<button type="submit">검색</button></form>{open&&<section id="road-search-results" className="search-results" aria-label="지역 및 도로 검색 결과" aria-busy={busy}><div className="search-status" role="status">{busy?'도로를 검색하고 있습니다…':failure||`검색 결과 ${results.total.toLocaleString('ko-KR')}개`}</div>{!busy&&!failure&&!results.items.length&&<p className="search-status">일치하는 지역이나 도로가 없습니다. 검색어를 바꿔주세요.</p>}{results.items.map(item=><button type="button" className="search-result" key={`${item.kind}-${item.id}`} onClick={()=>select(item)}><MapPin size={17}/><span><strong>{item.kind==='road'?item.roadName:item.name}</strong><small>{item.kind==='road'?regionLabel(item):item.kind==='region'?'지역 · 예시 코스 보기':'지역 · 지도에서 보기'}</small>{item.kind==='road'&&<small>{laneLabel(item)} · 도로구간 {item.linkCount}개</small>}</span></button>)}{failure&&<button type="button" className="search-more" onClick={()=>lookup(query)}>다시 검색</button>}{results.cursor&&!failure&&<button type="button" disabled={busy} className="search-more" onClick={()=>lookup(query,true)}>검색 결과 더 보기</button>}</section>}</div><LaneFilter selected={laneSelection} onChange={onLaneChange}/><button className="guide-trigger" onClick={onGuide}>이용 안내 <ArrowUpRight size={15}/></button></header>;
}
