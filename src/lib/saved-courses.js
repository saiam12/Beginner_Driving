export const SAVED_COURSES_KEY='beginner-driving.saved-courses.v1';
export function readSavedCourses(storage) {
 const raw=storage.getItem(SAVED_COURSES_KEY);if(!raw)return [];
 let items;try{items=JSON.parse(raw);}catch{throw new Error('저장된 코스를 읽지 못했습니다. 기존 자료는 그대로 유지합니다.');}
 if(!Array.isArray(items)||items.some(item=>!item.id||!Array.isArray(item.coordinates)||item.coordinates.length<2||item.coordinates.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))||!Number.isFinite(item.cost)))throw new Error('저장된 코스 형식을 확인할 수 없습니다.');
 return items;
}
export function courseToSavedRoute(course,{name,difficulty='보통',regionName='',destinationName='',sections,profile={goals:[]}}={}) {
 let coordinates=course.coordinates;
 if(!coordinates){coordinates=[];for(const f of course.featureCollection.features)for(const [lng,lat] of f.geometry.coordinates){const last=coordinates.at(-1);if(!last||last[0]!==lat||last[1]!==lng)coordinates.push([lat,lng]);}}
 const lengthMeters=course.lengthMeters??course.distance*1000;
 const mode=course.mode||'loop';
 return {id:course.id||`saved-${crypto.randomUUID()}`,name:name||course.name||`${regionName||'선택한 지역'} ${mode==='loop'?'순환':'이동'} 코스`,difficulty:course.difficulty||difficulty,mode,cost:course.cost,lengthMeters,distance:Number((lengthMeters/1000).toFixed(2)),duration:Math.round(lengthMeters/1000/25*60),coordinates,linkIds:course.linkIds||[],startLocation:course.startLocation||`시작 노드 ${course.startNode}`,sections:course.sections||sections||[regionName||'출발 지역',destinationName||'주변 도로'],metrics:{},score:null,real:true,reason:'저장 당시 도로 연결과 조건을 유지한 코스입니다. 실제 통행 제한과 실시간 교통은 반영하지 않았습니다.',regionName,destinationName,goals:[...profile.goals],savedAt:new Date().toISOString(),rank:1};
}
export function saveCourse(storage,route) {
 const items=readSavedCourses(storage);
 const signature=c=>c.linkIds.length?[...c.linkIds].sort().join(','):JSON.stringify(c.coordinates);
 const duplicate=items.find(c=>signature(c)===signature(route));
 if(duplicate)return {items,duplicate:true};
 if(items.length>=30)throw new Error('코스는 최대 30개까지 저장할 수 있습니다. 저장 코스를 삭제한 뒤 다시 시도해주세요.');
 const next=[route,...items];try{storage.setItem(SAVED_COURSES_KEY,JSON.stringify(next));}catch{throw new Error('브라우저 저장 공간이 부족하거나 저장이 차단되어 있습니다.');}
 return {items:next,duplicate:false};
}
export function removeSavedCourse(storage,id){const next=readSavedCourses(storage).filter(c=>c.id!==id);storage.setItem(SAVED_COURSES_KEY,JSON.stringify(next));return next;}
