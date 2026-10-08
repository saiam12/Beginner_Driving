import React from 'react';
export default function SavedCourses({courses,onOpen,onRemove}) {
 return <section className="region-picker"><span className="eyebrow">내 코스</span><h2>저장 코스 <small>{courses.length}</small></h2><p className="subtext">이 브라우저에 저장됩니다. 다른 기기와는 공유되지 않습니다.</p>
 {!courses.length&&<p className="data-note">아직 저장한 코스가 없습니다. 추천 코스에서 ‘코스 저장’을 눌러주세요.</p>}
 <div className="saved-course-list">{courses.map(c=><article key={c.id}><button type="button" className="saved-course-open" onClick={()=>onOpen(c)}><strong>{c.name}</strong><span>{c.difficulty} · {c.distance}km · {c.mode==='oneway'?'편도':'순환'}</span><small>{c.regionName}{c.destinationName&&` → ${c.destinationName}`}</small></button><button type="button" className="back-link" aria-label={`${c.name} 저장 삭제`} onClick={()=>onRemove(c.id)}>저장 삭제</button></article>)}</div></section>;
}
