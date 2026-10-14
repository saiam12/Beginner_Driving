import React from 'react';

export default function CourseLocationControl({label,point,picking,viewport,preferredArea,onClear,onPick,automaticNote}) {
 return <div className="course-start-control">
  <strong>{label} 위치</strong>
  <div className="connected-course-mode" role="group" aria-label={`${label} 위치 설정`}>
   <button type="button" aria-pressed={!point&&!picking} onClick={onClear}>자동 선택</button>
   <button type="button" aria-label={picking?`${label} 위치 지정 취소`:`지도에서 ${label} 위치 지정`} aria-pressed={picking||!!point} disabled={!viewport||(!preferredArea&&viewport.zoom<13)} onClick={onPick}>{picking?'지정 취소':'직접 지정'}</button>
  </div>
  <small role="status">{picking?`지도에서 ${label}할 위치를 눌러주세요.`:point?'지정한 위치를 가장 가까운 도로에 연결합니다.':automaticNote}</small>
 </div>;
}
