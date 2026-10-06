import React from 'react';
import {GOAL_OPTIONS} from '../../lib/driver-preferences';
export default function DriverPreferences({value,onChange}) {
 return <section className="driver-preferences" aria-label="맞춤 코스 조건">
  <fieldset><legend>연습 목표 <small>복수 선택</small></legend><div className="driver-choice">
   {GOAL_OPTIONS.map(([id,text])=><button key={id} type="button" aria-pressed={value.goals.includes(id)} onClick={()=>onChange({goals:value.goals.includes(id)?value.goals.filter(item=>item!==id):[...value.goals,id]})}>{text}</button>)}
  </div><p>다시 누르면 선택이 해제됩니다.</p></fieldset>
 </section>;
}
