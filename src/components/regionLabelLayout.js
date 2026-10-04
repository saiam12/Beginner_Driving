export const REGION_LABEL_SIZE=[126,43];
export const REGION_LABEL_ANCHOR=[63,43];

export function regionLabelHTML(region) {
 return `<button class="region-map-label" aria-label="${region.name} 코스 추천 보기" title="${region.rank}위 ${region.name} · ${region.score}점 · 코스 보기"><b>${region.rank}</b><span>${region.name}</span></button>`;
}

// 순위가 높은 지역부터 실제 위치에 배치합니다. 겹치는 이름표는 옮기지 않고 생략합니다.
export function layoutRegionLabels(items,width,height,zoom=7) {
 const limit=zoom>=10?(width<520?6:10):(width<520?4:6);
 const occupied=[
  {left:0,right:Math.min(width,340),top:height-80,bottom:height},
  {left:width-82,right:width,top:0,bottom:270},
 ];
 const visible=[];
 for(const item of items) {
  if(visible.length>=limit)break;
  const {x,y}=item.point;
  const box={left:x-63,right:x+63,top:y-43,bottom:y};
  if(box.left<16||box.right>width-16||box.top<85||box.bottom>height-20)continue;
  if(occupied.some(b=>box.right+12>b.left&&box.left-12<b.right&&box.bottom+12>b.top&&box.top-12<b.bottom))continue;
  occupied.push(box);
  visible.push(item);
 }
 return visible;
}
