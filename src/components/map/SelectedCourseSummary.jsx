import React,{useState} from 'react';
import {ChevronRight,Minus,PanelTopOpen} from 'lucide-react';
export default function SelectedCourseSummary({course,onDetail}) {
 const [minimized,setMinimized]=useState(false);
 if(minimized)return <button type="button" className="map-selected course-summary-restore" aria-label="선택 코스 카드 펼치기" onClick={()=>setMinimized(false)}><PanelTopOpen size={15}/>코스 보기</button>;
 return <div className="map-selected compact-course-summary course-summary-controls"><button type="button" className="course-summary-detail" title={course.name} aria-label="선택 코스 상세 보기" onClick={onDetail}><div><strong>{course.name}</strong><p>{course.distance} km <i/> 약 {course.duration}분</p></div><ChevronRight size={18}/></button><button type="button" className="course-summary-minimize" aria-label="선택 코스 카드 최소화" title="최소화" onClick={()=>setMinimized(true)}><Minus size={16}/></button></div>;
}
