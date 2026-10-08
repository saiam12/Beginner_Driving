export const MIN_DISTANCE = 5;
export const MAX_DISTANCE = 30;
export const MAX_DISTANCE_SPAN = 10;

export function updateDistanceRange(range,field,value,maxDistance=MAX_DISTANCE) {
 const number=Number(value);
 if(!Number.isFinite(number))return range;
 const next=Math.max(MIN_DISTANCE,Math.min(maxDistance,Math.round(number)));
 if(field==='min')return {min:next,max:Math.max(next,Math.min(range.max,next+MAX_DISTANCE_SPAN))};
 return {min:Math.min(next,Math.max(range.min,next-MAX_DISTANCE_SPAN)),max:next};
}

export function distanceBands({min,max}) {
 const span=max-min;
 if(span===0)return [{min,max}];
 // A five-kilometre selection uses the requested integer bands, e.g. 5–6 / 7–8 / 9–10.
 if(span===5)return [0,2,4].map(offset=>({min:min+offset,max:min+offset+1}));
 const step=span>=6?Math.floor(span/3):span/3;
 const rounded=n=>Math.round(n*10)/10;
 return [0,1,2].map(i=>({min:rounded(min+step*i),max:i===2?max:rounded(min+step*(i+1))}));
}
