import React from 'react';
export default function DifficultyControl({value,onChange}) {
 return <div className="difficulty-control"><span>희망 난이도</span><div role="group" aria-label="희망 난이도">{['전체','쉬움','보통','어려움'].map(level=><button key={level} className={value===level?'active':''} aria-pressed={value===level} onClick={()=>onChange(level)}>{level}</button>)}</div></div>;
}
