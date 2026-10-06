import React,{useEffect,useRef,useState} from 'react';
export default function ConnectedCourseControl({features,viewport,range,selection,ready,onCourse}) {
 const [mode,setMode]=useState('loop'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[course,setCourse]=useState(null);
 const worker=useRef(null);
 const [courses,setCourses]=useState([]),[selectedIndex,setSelectedIndex]=useState(0);
 const selectionKey=selection.join(',');
 useEffect(()=>{
  worker.current?.terminate();setBusy(false);setError('');setCourse(null);setCourses([]);setSelectedIndex(0);onCourse(null);
  return()=>{worker.current?.terminate();onCourse(null);};
 },[range.min,range.max,mode,selectionKey,onCourse]);
 const connect=()=>{
  worker.current?.terminate();setError('');setBusy(true);
  const b=viewport.bounds;
  const instance=new Worker(new URL('../../lib/connected-course.worker.js',import.meta.url),{type:'module'});worker.current=instance;
  instance.onmessage=({data})=>{
   if(worker.current!==instance)return;
   instance.terminate();worker.current=null;setBusy(false);
   if(data.error){setError(data.error);return;}
   setCourses(data.courses);setSelectedIndex(0);setCourse(data.courses[0]);onCourse(data.courses[0]);
  };
  instance.onerror=()=>{if(worker.current!==instance)return;instance.terminate();worker.current=null;setBusy(false);setError('경로 계산에 실패했습니다. 다시 시도해주세요.');};
  instance.postMessage({features,center:[(b[0]+b[2])/2,(b[1]+b[3])/2],range,mode});
 };
 return <section className="connected-course-control" aria-label="실제 도로 거리 연결">
  <div className="connected-course-actions"><div className="connected-course-mode" role="group" aria-label="경로 형태">
   <button type="button" aria-pressed={mode==='loop'} onClick={()=>setMode('loop')} title="출발점으로 돌아오는 경로">순환</button>
   <button type="button" aria-pressed={mode==='oneway'} onClick={()=>setMode('oneway')} title="다른 지점까지 이어지는 경로">편도</button></div>
   <button type="button" disabled={busy||!ready||!features.length||!viewport||viewport.zoom<13} onClick={connect}>{busy?'연결 경로 찾는 중…':`${range.min}~${range.max}km 도로 연결`}</button></div>
  {!!courses.length&&<><div className="connected-course-options" role="group" aria-label="추천 후보 선택">{courses.map((candidate,i)=><button type="button" key={i} aria-pressed={selectedIndex===i} onClick={()=>{setSelectedIndex(i);setCourse(candidate);onCourse(candidate);}}>후보 {i+1}</button>)}</div>
   <small role="status">추천 후보 {courses.length}개{courses.length<3?' · 현재 조건에서 찾은 후보만 표시합니다.':''}</small></>}
  {course&&<p className="connected-course-result" role="status">후보 {selectedIndex+1} · 약 {(course.lengthMeters/1000).toFixed(2)}km · {course.linkIds.length}개 구간<button type="button" onClick={()=>{setCourse(null);setCourses([]);onCourse(null);}}>경로 지우기</button></p>}
  {error&&<p role="status">{error}</p>}
  <small>현재 지도 중심 근처에서 시작 · 선택한 차로만 연결</small>
  <small>지도 형상 기준 거리 · 회전 제한·현장 통제 미반영</small>
 </section>;
}
