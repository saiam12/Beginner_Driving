import React,{useEffect,useMemo,useRef,useState} from 'react';
import {COURSE_OVERLAP_THRESHOLD} from '../../lib/course-overlap';
import {DEFAULT_DRIVER_PROFILE} from '../../lib/driver-preferences';
import {summarizeCourse,requestCourseRecommendation} from '../../lib/course-recommendation';
export default function ConnectedCourseControl({features,viewport,range,selection,profile=DEFAULT_DRIVER_PROFILE,ready,onCourse,onCandidates,selectedCourse,startPoint,pickingStart,onPickStart,onClearStart,onCenterStart}) {
 const [mode,setMode]=useState('loop'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [courses,setCourses]=useState([]);
 const selectedIndex=courses.indexOf(selectedCourse);
 const [ai,setAi]=useState(null),[aiBusy,setAiBusy]=useState(false),[aiError,setAiError]=useState('');
 const [adoptCount,setAdoptCount]=useState(3);
 const [courseSelection,setCourseSelection]=useState({eligibleIndices:[],similarTo:{},adoptedIndices:[]});
 const shortlistedIndices=useMemo(()=>courseSelection.adoptedIndices.slice(0,adoptCount),[courseSelection,adoptCount]);
 const shortlisted=shortlistedIndices.map(index=>courses[index]);
 const extraIndex=selectedIndex>=0&&!shortlistedIndices.includes(selectedIndex)?selectedIndex:null;
 const mapCandidates=useMemo(()=>[...shortlistedIndices,...(extraIndex===null?[]:[extraIndex])].filter(index=>courses[index]).map(index=>({index,course:courses[index]})),[courses,shortlistedIndices,extraIndex]);
 useEffect(()=>{onCandidates(mapCandidates);},[mapCandidates,onCandidates]);
 useEffect(()=>()=>onCandidates([]),[onCandidates]);
 const aiIdFor=index=>{const position=shortlistedIndices.indexOf(index);return position<0?null:`candidate_${position+1}`;};
 const formatCost=value=>Math.round(value).toLocaleString('ko-KR');
 const worker=useRef(null),aiRequest=useRef(null);
 const selectionKey=selection.join(','),profileKey=JSON.stringify(profile),startKey=startPoint?.join(',')??'';
 const cancelAI=()=>{aiRequest.current?.abort();aiRequest.current=null;setAiBusy(false);setAi(null);setAiError('');};
 useEffect(()=>{
  worker.current?.terminate();worker.current=null;setBusy(false);setError('');setCourses([]);onCourse(null);cancelAI();
  return()=>{worker.current?.terminate();worker.current=null;aiRequest.current?.abort();aiRequest.current=null;onCourse(null);};
 },[range.min,range.max,mode,selectionKey,profileKey,startKey,onCourse]);
 const connect=()=>{
  if(busy||!ready||!viewport||!features.length)return;
  worker.current?.terminate();setError('');setBusy(true);cancelAI();
  const b=viewport.bounds;
  const instance=new Worker(new URL('../../lib/connected-course.worker.js',import.meta.url),{type:'module'});worker.current=instance;
  instance.onmessage=({data})=>{
   if(worker.current!==instance)return;
   instance.terminate();worker.current=null;setBusy(false);
   if(data.error){setError(data.error);return;}
   setCourses(data.courses);setCourseSelection(data.courseSelection);const first=data.courseSelection.adoptedIndices[0];onCourse(data.courses[first]);
  };
  instance.onerror=()=>{if(worker.current!==instance)return;instance.terminate();worker.current=null;setBusy(false);setError('경로 계산에 실패했습니다. 다시 시도해주세요.');};
  instance.postMessage({features,center:[(b[0]+b[2])/2,(b[1]+b[3])/2],range,mode,options:{preferredLanes:selection,profile,bounds:b,startPoint}});
 };
 const recommend=async()=>{
  if(aiRequest.current||!courses.length||busy)return;
  const controller=new AbortController();aiRequest.current=controller;setAiBusy(true);setAiError('');
  const timer=setTimeout(()=>controller.abort('timeout'),110000);
  try{
   const result=await requestCourseRecommendation({profile,range,preferredLanes:selection,candidates:shortlisted.map((course,i)=>summarizeCourse(course,i,selection))},{signal:controller.signal});
   if(aiRequest.current!==controller)return;
   const index=shortlistedIndices.find((_,i)=>`candidate_${i+1}`===result.recommendedCandidateId);
   setAi(result);onCourse(courses[index]);
  }catch(e){if(aiRequest.current===controller)setAiError(controller.signal.aborted?'AI 추천 응답이 지연되고 있습니다. 다시 시도해주세요.':e.message);}
  finally{clearTimeout(timer);if(aiRequest.current===controller){aiRequest.current=null;setAiBusy(false);}}
 };
 const course=courses[selectedIndex],explanation=ai?.ranking.find(item=>item.candidateId===aiIdFor(selectedIndex));
 return <section className="connected-course-control" aria-label="실제 도로 코스 추천">
  <div className="course-start-control"><strong>출발 위치</strong><div className="connected-course-mode" role="group" aria-label="출발 위치 설정">
   <button type="button" aria-pressed={!startPoint&&!pickingStart} onClick={onClearStart}>자동 선택</button>
   <button type="button" aria-pressed={pickingStart} disabled={!viewport||viewport.zoom<13} onClick={onPickStart}>{pickingStart?'지정 취소':'지도에서 지정'}</button>
   <button type="button" disabled={!viewport||viewport.zoom<13} onClick={onCenterStart}>지도 중심으로 지정</button></div>
   <small role="status">{pickingStart?'지도에서 출발하고 싶은 도로 근처를 누르세요.':startPoint?'지정 위치 가까운 실제 도로에서 출발합니다.':'화면 전역의 출발점을 비교해 발견한 최저 cost 경로를 선택합니다.'}</small>
  </div>
  <div className="connected-course-actions"><div className="connected-course-mode" role="group" aria-label="경로 형태">
   <button type="button" aria-pressed={mode==='loop'} onClick={()=>setMode('loop')}>순환</button>
   <button type="button" aria-pressed={mode==='oneway'} onClick={()=>setMode('oneway')}>편도</button></div>
   <button className="connect-button" type="button" disabled={busy||!ready||!features.length||!viewport||viewport.zoom<13||pickingStart} onClick={connect}>{busy?'코스 찾는 중…':`${range.min}~${range.max}km 후보 찾기`}</button></div>
  {!!courses.length&&<><div className="connected-course-options" role="group" aria-label="추천 후보 선택">{shortlisted.map((candidate,i)=><button type="button" key={i} aria-pressed={selectedIndex===shortlistedIndices[i]} onClick={()=>{onCourse(candidate);}}>후보 {shortlistedIndices[i]+1}{ai?.recommendedCandidateId===`candidate_${i+1}`&&<span className="ai-recommended">AI 추천</span>}</button>)}</div>
   <div className="connected-course-mode" role="group" aria-label="채택 후보 수">{[3,4,5].map(count=><button type="button" key={count} aria-pressed={adoptCount===count} disabled={aiBusy} onClick={()=>{setAdoptCount(count);cancelAI();onCourse(courses[courseSelection.adoptedIndices[0]]);}}>{count}개 채택</button>)}</div>
   <small role="status">발견 {courses.length}개 · 유사 경로 {Object.keys(courseSelection.similarTo).length}개 제외 · {shortlisted.length}개 채택</small>
   <div className="ai-course-actions"><button type="button" disabled={busy||aiBusy} onClick={recommend}>{aiBusy?'AI 비교 중…':ai?'AI 다시 추천':'AI 맞춤 추천'}</button><small>연습 조건과 후보 요약을 Google Gemini에 전달합니다.</small></div>
   <div className="ai-course-feedback" aria-live="polite" aria-busy={aiBusy}>
    {aiBusy&&<p>연습 조건에 맞는 후보를 비교하고 있습니다…</p>}
    {aiError&&<p>{aiError} 후보는 그대로 이용할 수 있습니다.</p>}
    {!aiBusy&&explanation&&<><strong>{ai.recommendedCandidateId===explanation.candidateId?'나에게 우선 추천하는 코스':'이 후보의 비교 근거'}</strong><p>{explanation.reasons.join(' · ')}</p><small>사용자 선호와 위 지표를 고려한 추천입니다.</small>{ai.missingData.length>0&&<small>{ai.missingData.map(key=>key==='traffic'?'교통량':'사고').join('·')} 자료는 충분하지 않아 AI 비교에서 제외했습니다.</small>}</>}
   </div></>}
  {course&&<p className="connected-course-result" role="status">후보 {selectedIndex+1} · 약 {(course.lengthMeters/1000).toFixed(2)}km · {course.linkIds.length}개 구간<button type="button" onClick={()=>{worker.current?.terminate();worker.current=null;setBusy(false);setCourses([]);setError('');cancelAI();onCourse(null);}}>경로 지우기</button></p>}
  {!!courses.length&&<details className="course-cost-debug" open><summary>개발용 · 전체 후보와 cost ({courses.length}개 · 유사 제외 {Object.keys(courseSelection.similarTo).length}개)</summary>
   <small>총 cost 오름차순 · 동일 LINK 집합 중복 제외 · 제한된 탐색에서 발견한 후보입니다.</small>
   <div className="course-cost-list" role="group" aria-label="전체 탐색 후보">{courseSelection.eligibleIndices.map(i=>{const candidate=courses[i];return <button type="button" key={i} aria-pressed={selectedIndex===i} onClick={()=>{onCourse(candidate);}}><strong>후보 {i+1}{shortlistedIndices.includes(i)?' · 채택':''}</strong><span>{(candidate.lengthMeters/1000).toFixed(2)}km · 총 cost {formatCost(candidate.cost)} · km당 {formatCost(candidate.cost/(candidate.lengthMeters/1000))}</span><small>출발 노드 {candidate.startNode} · {candidate.start[1].toFixed(5)}, {candidate.start[0].toFixed(5)}</small><small>차로 {formatCost(candidate.costBreakdown.lane)} · 선호 {formatCost(candidate.costBreakdown.preference)} · 회전 {formatCost(candidate.costBreakdown.turns)} · 교통 {formatCost(candidate.costBreakdown.traffic)} · 사고 {formatCost(candidate.costBreakdown.accidents)}</small></button>;})}</div>
   <small>교통·사고 cost 0은 자료 미수집일 수 있습니다. 일치율은 공통 LINK 길이 ÷ 긴 경로의 길이입니다. {Math.round(COURSE_OVERLAP_THRESHOLD*100)}% 이상 겹치는 후보는 낮은 cost 하나만 채택합니다.</small>
  </details>}
  {error&&<p role="status">{error}</p>}
  {course&&<><small role="status">{course.startSelection==='manual'?`지정 위치에서 약 ${Math.round(course.startDistance)}m 떨어진 도로 노드로 연결 · 이동 구간은 코스에 포함하지 않습니다.`:`출발 노드 ${course.startNodesCompared}곳 비교 · 후보별 출발 위치는 다를 수 있습니다.`}</small><small>초록색은 도로상의 코스 시작·종료 지점입니다. 주차·승차 장소를 뜻하지 않습니다. 화살표는 선택한 후보의 진행 방향입니다.</small></>}
  <small>선호 차로 우선, 전체 차로 연결</small>
  <small>지도 형상 기준 거리 · 회전 제한·현장 통제 미반영</small>
 </section>;
}
