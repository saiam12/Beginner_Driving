import {metersBetween} from '../../lib/connected-course.js';

// Sample the ordered, directed LINK geometry, never a straight line across a turn.
export function courseDirectionMarks(course, spacing=700) {
 const segments=[];let total=0;
 for(const feature of course.featureCollection.features){
  const points=feature.geometry.coordinates;
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],length=metersBetween(a,b);
   if(length<.1)continue;
   segments.push({a,b,length,offset:total});total+=length;
  }
 }
 const count=Math.min(30,Math.max(1,Math.floor(total/spacing)));
 return Array.from({length:count},(_,i)=>{
  const distance=total*(i+.5)/count;
  const segment=segments.find(s=>s.offset+s.length>=distance);
  if(!segment)return null;
  const {a,b,length,offset}=segment,t=(distance-offset)/length;
  const angle=Math.atan2((b[0]-a[0])*Math.cos((a[1]+b[1])*Math.PI/360),b[1]-a[1])*180/Math.PI;
  return {point:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],angle};
 }).filter(Boolean);
}

export function courseLabelPoint(course,candidates) {
 const others=new Set(candidates.filter(item=>item.course!==course).flatMap(item=>item.course.linkIds));
 const features=course.featureCollection.features;
 // Put the badge on a distinct section when routes share their starting corridor.
 const unique=features.filter(feature=>!others.has(feature.properties.linkId));
 const feature=(unique.length?unique:features).reduce((best,item)=>{
  const length=item.geometry.coordinates.slice(1).reduce((sum,p,i)=>sum+metersBetween(item.geometry.coordinates[i],p),0);
  return !best||length>best.length?{item,length}:best;
 },null)?.item;
 if(!feature)return course.start;
 return courseDirectionMarks({featureCollection:{features:[feature]}},Infinity)[0]?.point||course.start;
}

export function courseStops(course) {
 return course.mode==='loop'&&metersBetween(course.start,course.end)<=5
  ?[{title:'출발 · 도착',point:course.start}]
  :[{title:'출발',point:course.start},{title:'도착',point:course.end}];
}
export const courseStopHTML=title=>`<div class="course-stop"><span class="course-stop-dot"></span><span class="course-stop-label">${title}</span></div>`;
export function courseNumberButton(index,active,disabled=false) {
 const button=document.createElement('button');button.type='button';button.className='course-number';
 button.textContent=`후보 ${index+1}`;button.dataset.active=String(active);button.disabled=disabled;
 button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',`후보 ${index+1} 선택`);
 return button;
}
export function courseAnnotationContent(html,onSelect) {
 const content=document.createElement('div');
 if(typeof html==='string')content.innerHTML=html;else content.appendChild(html);
 if(onSelect)content.querySelector('button').addEventListener('click',event=>{event.stopPropagation();onSelect();});
 return content;
}
export const courseArrowHTML=angle=>`<span class="course-direction" aria-hidden="true" style="transform:rotate(${angle}deg)"><svg width="22" height="22" viewBox="0 0 22 22"><path d="M5 15L11 7L17 15" fill="none" stroke="white" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 15L11 7L17 15" fill="none" stroke="#b91c1c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
