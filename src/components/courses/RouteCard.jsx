import React from 'react';
import { ArrowRight, Repeat2, Clock3, Milestone } from 'lucide-react';
import AnalysisMetric from './AnalysisMetric';
export default function RouteCard({route,selected,onSelect,onDetail}) {
 return <article className={`route-card ${selected?'selected':''}`}><button className="card-select" onClick={()=>onSelect(route.id)} aria-pressed={selected}><div className="card-top"><span className="rank"><b>{route.rank}</b> 추천 {route.rank}위</span><span className={`badge ${route.difficulty==='쉬움'?'easy':route.difficulty==='어려움'?'hard':'medium'}`}>{route.difficulty}</span></div><div className="card-title"><h3>{route.name}</h3><div className="score">{route.score}<small>점</small></div></div><div className="route-stats"><span><Milestone size={14}/><b>{route.distance}</b> km</span><span><Clock3 size={14}/><b>{route.duration}</b> 분</span><span><Repeat2 size={14}/>순환형</span></div><div className="compact-metrics">{Object.entries(route.metrics).map(([type,metric])=><AnalysisMetric key={type} type={type} metric={metric} compact/>)}</div></button><button className="detail-link" onClick={()=>{onSelect(route.id);onDetail(route.id);}}>코스 상세 보기 <ArrowRight size={14}/></button></article>;
}


