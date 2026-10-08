import React,{useEffect,useRef,useState} from 'react';
import {loadCourseRegions,loadCourseRegionBoundary} from '../../lib/road-search';
const provinceOf=area=>area.name.split(' ')[0];
const provinceLabels={'서울특별시':'서울','부산광역시':'부산','대구광역시':'대구','인천광역시':'인천','광주광역시':'광주','대전광역시':'대전','울산광역시':'울산','세종특별자치시':'세종','경기도':'경기','강원특별자치도':'강원','충청북도':'충북','충청남도':'충남','전북특별자치도':'전북','전라남도':'전남','경상북도':'경북','경상남도':'경남','제주특별자치도':'제주','전남광주통합특별시':'전남·광주'};
const MAX_SELECTED_AREAS=3;
export default function DesiredRegion({selectedAreas,onChangeAreas,onProvinceSelect}) {
 const [areas,setAreas]=useState([]),[province,setProvince]=useState(selectedAreas[0]?provinceOf(selectedAreas[0]):'서울특별시'),[error,setError]=useState(''),[retry,setRetry]=useState(0),[loading,setLoading]=useState(true),[choosing,setChoosing]=useState(false);
 const boundaryRequest=useRef(null);
 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');loadCourseRegions({signal:c.signal}).then(setAreas).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[retry]);
 useEffect(()=>()=>boundaryRequest.current?.abort(),[]);
 const choose=async area=>{
  const index=selectedAreas.findIndex(item=>item.id===area.id);
  if(index>=0){onChangeAreas(selectedAreas.filter(item=>item.id!==area.id));return;}
  if(selectedAreas.length>=MAX_SELECTED_AREAS||choosing)return;
  const controller=new AbortController();boundaryRequest.current=controller;setChoosing(true);setError('');
  try{const resolved=await loadCourseRegionBoundary(area,{signal:controller.signal});if(!controller.signal.aborted)onChangeAreas([...selectedAreas,resolved]);}
  catch(e){if(!controller.signal.aborted)setError(e.message);}
  finally{if(boundaryRequest.current===controller)setChoosing(false);}
 };
 const provinces=[...new Set(areas.map(provinceOf))].sort((a,b)=>Object.keys(provinceLabels).indexOf(a)-Object.keys(provinceLabels).indexOf(b));
 const matches=areas.filter(area=>provinceOf(area)===province);
 return <section className="region-picker"><span className="eyebrow">코스 추천 조건</span><h2>희망 지역</h2><p className="subtext">지역을 선택한 순서대로 코스를 연결합니다. 최대 3곳까지 고를 수 있습니다.</p>
  {selectedAreas.length>0&&<div className="selected-region-list" aria-label="선택한 지역 순서">{selectedAreas.map((area,index)=><button type="button" key={area.id} aria-label={`${index===0?'출발':index===selectedAreas.length-1&&selectedAreas.length>1?'도착':'경유'} ${area.name} 선택 해제`} onClick={()=>onChangeAreas(selectedAreas.filter(item=>item.id!==area.id))}><span>{index===0?'출발':index===selectedAreas.length-1&&selectedAreas.length>1?'도착':'경유'}</span>{area.name}<b aria-hidden="true">×</b></button>)}</div>}
  <h3 className="region-step-label">시·도</h3>
  <div className="region-provinces" role="group" aria-label="시·도 선택">{provinces.map(name=><button type="button" key={name} aria-pressed={province===name} disabled={choosing} onClick={()=>{setProvince(name);setError('');const bounds=areas.filter(area=>provinceOf(area)===name&&area.bounds).map(area=>area.bounds);if(bounds.length)onProvinceSelect?.({name,bounds:[Math.min(...bounds.map(b=>b[0])),Math.min(...bounds.map(b=>b[1])),Math.max(...bounds.map(b=>b[2])),Math.max(...bounds.map(b=>b[3]))]});}}>{provinceLabels[name]||name}</button>)}</div>
  <h3 className="region-step-label">시·군·구 <span>{provinceLabels[province]||province}</span></h3>
  {(choosing||loading||error)&&<p className="data-note" role="status">{choosing?'지역 경계를 불러오고 있습니다…':loading?'지역을 불러오고 있습니다…':error}</p>}
  {error&&<button type="button" onClick={()=>setRetry(n=>n+1)}>다시 불러오기</button>}
  <div className="region-options" role="group" aria-label="시·군·구 선택">{matches.map(area=>{const index=selectedAreas.findIndex(item=>item.id===area.id);return <button type="button" key={area.id} aria-pressed={index>=0} disabled={choosing||index<0&&selectedAreas.length>=MAX_SELECTED_AREAS} onClick={()=>choose(area)}>{index>=0&&<span className="region-order">{index+1}</span>}{area.name.slice(province.length).trim()||area.name}</button>;})}</div>
  <p className="data-note">선택한 구역은 지도에 강조 표시합니다. 지역을 여러 곳 고르면 선택 순서대로 잇는 경로를 찾습니다.</p>
 </section>;
}
