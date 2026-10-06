import React from 'react';
import {GOAL_OPTIONS,AVOID_OPTIONS} from '../../lib/driver-preferences';
export default function DriverPreferences({value,onChange}) {
 return <section className="driver-preferences" aria-label="맞춤 코스 조건">
  <h3>나에게 맞는 연습</h3>
  <fieldset><legend>연습 목표</legend><div className="driver-choice">
   {GOAL_OPTIONS.map(([id,text])=><button key={id} type="button" aria-pressed={value.goal===id} onClick={()=>onChange({...value,goal:id})}>{text}</button>)}
   {AVOID_OPTIONS.map(([id,text])=><button key={id} type="button" aria-pressed={value.avoid.includes(id)} onClick={()=>onChange({...value,avoid:value.avoid.includes(id)?value.avoid.filter(item=>item!==id):[...value.avoid,id]})}>{text}</button>)}
  </div><p>주행 목표는 하나, 고려할 항목은 여러 개 선택하세요.</p></fieldset>
  <p>선호 차로 외의 도로도 코스에 포함될 수 있어요.</p>
 </section>;
}
