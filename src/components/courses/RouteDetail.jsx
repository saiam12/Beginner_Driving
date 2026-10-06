import React from 'react';
import { ArrowLeft, MapPin, Repeat2 } from 'lucide-react';
import AnalysisMetric from './AnalysisMetric';
export default function RouteDetail({route,onBack}) {
 return <div className="route-detail"><button className="back-link" onClick={onBack}><ArrowLeft size={16}/> 추천 코스로 돌아가기</button><span className="eyebrow">추천 {route.rank}위 · 순환형 연습 코스</span><h2>{route.name}</h2><div className="detail-summary"><div><strong>{route.distance}<small> km</small></strong><span>총 거리</span></div><div><strong>{route.duration}<small> 분</small></strong><span>예상 시간</span></div><div><strong className="blue">{Math.round(route.cost).toLocaleString()}</strong><span>총 비용</span></div></div><div className="start-location"><MapPin size={19}/><div><small>출발 · 도착</small><strong>{route.startLocation}</strong></div><Repeat2 size={18}/></div><div className="suitability"><span>코스 난이도 · 상대 기준</span><strong>{route.difficulty}</strong></div><h3>주요 주행 구간</h3><ol className="sections">{route.sections.map((s,i)=><li key={s}><span>{i+1}</span>{s}</li>)}</ol><h3>도로 지표 · 미반영 <span className={`badge ${route.difficulty === "어려움" ? "hard" : route.difficulty === "보통" ? "medium" : "easy"}`}>{route.difficulty}</span></h3><p className="data-note">교통량·사고 데이터는 아직 반영하지 않았습니다.</p><div className="detail-metrics">{Object.entries(route.metrics).map(([type,metric])=><AnalysisMetric key={type} type={type} metric={metric}/>)}</div><div className="reason"><strong>코스 설명</strong><p>{route.reason}</p></div><p className="data-note">표준노드링크의 실제 도로를 연결했습니다. 예상 시간은 시속 25km 기준이며, 실시간 통행 제한은 반영하지 않았습니다.</p></div>;
}



