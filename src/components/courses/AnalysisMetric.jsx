import React from 'react';
import { Check, Users, ShieldCheck, Route, CarFront } from 'lucide-react';
export const metricInfo = {lanes:{label:'차로 수',Icon:Route},accidents:{label:'교통사고',Icon:ShieldCheck},traffic:{label:'교통량',Icon:CarFront},floatingPopulation:{label:'유동인구',Icon:Users}};
export default function AnalysisMetric({type,metric,compact=false}) {
 const {label,Icon}=metricInfo[type]; const good=metric.score>=84;
 return <div className={compact?'metric compact':'metric'}><span className="metric-label"><Icon size={14}/>{label}</span>{!compact&&<strong>{metric.value}</strong>}<span className={good?'metric-good':'metric-warn'}>{good&&<Check size={11}/>} {type==='accidents'?(good?'낮음':'보통'):type==='traffic'?(good?'적음':metric.score<70?'많음':'보통'):type==='floatingPopulation'?(metric.score<75?'많음':'보통'):(good?'적합':metric.score<70?'주의':'보통')}</span>{!compact&&<div className="meter"><i style={{width:`${metric.score}%`}}/></div>}</div>;
}




