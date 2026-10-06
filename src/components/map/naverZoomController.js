export function createNaverZoomController(map,element,fractional,onChange) {
 let zoom=map.getZoom(),applying=false,flight=null,markerFrame=null;
 const cancel=()=>{if(flight!==null)cancelAnimationFrame(flight);flight=null;};
 const cancelMarkerFrame=()=>{if(markerFrame!==null)cancelAnimationFrame(markerFrame);markerFrame=null;};
 const compensateMarkers=(animate,scale)=>{
  cancelMarkerFrame();
  const update=()=>{
   const displayed=animate?new DOMMatrixReadOnly(getComputedStyle(element).transform).a:scale;
   element.style.setProperty('--naver-marker-scale',String(1/displayed));
  };
  update();
  if(!animate)return;
  const started=performance.now();
  const frame=now=>{
   update();
   if(now-started<300)markerFrame=requestAnimationFrame(frame);
   else {element.style.setProperty('--naver-marker-scale',String(1/scale));markerFrame=null;}
  };
  markerFrame=requestAnimationFrame(frame);
 };
 const reducedMotion=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const render=(animate=false)=>{
  const scale=fractional?1:2**(zoom-Math.floor(zoom));
  // Keep SDK layout stable: half steps change only the compositor transform.
  const extent=fractional?1:2;
  Object.assign(element.style,{position:'absolute',left:'50%',top:'50%',right:'auto',bottom:'auto',width:`${extent*100}%`,height:`${extent*100}%`,transition:animate?'transform 250ms ease-out':'none',transform:`translate(-50%,-50%) scale(${scale})`,transformOrigin:'center'});
  // Keep HTML pins screen-sized, including every frame of a half-step zoom.
  compensateMarkers(animate,scale);
  // Keep SDK attribution and scale controls inside the visible, cropped area.
  for(const control of element.children){
   if(control.style.zIndex!=='100'||control.style.bottom==='')continue;
   const side=control.style.left!==''?'left':'right';
   Object.assign(control.style,{transition:animate?'bottom 250ms ease-out, left 250ms ease-out, right 250ms ease-out, transform 250ms ease-out':'none',bottom:`${50*(1-1/(extent*scale))}%`,[side]:`${50*(1-1/(extent*scale))}%`,transform:`scale(${1/scale})`,transformOrigin:`${side} bottom`});
  }
 };
 const sync=nativeZoom=>{
  if(applying)return;
  // Some SDKs accept a fraction initially, then round it when rendering finishes.
  if(fractional&&zoom%1!==0&&Math.abs(nativeZoom-zoom)>0.001){
   fractional=false;applying=true;
   try {map.setZoom(Math.floor(zoom),false);render();onChange(zoom);} finally {applying=false;}
   return;
  }
  if(!fractional&&nativeZoom===Math.floor(zoom))return;
  zoom=nativeZoom;render();onChange(zoom);
 };
 const reset=()=>{cancel();zoom=map.getZoom();render();onChange(zoom);};
 const applyZoom=(target,smooth=false)=>{
  if(target===zoom)return;
  zoom=target;onChange(zoom);
  applying=true;
  try {
   const nativeTarget=fractional?target:Math.floor(target);
   if(fractional){
    render();
    if(map.getZoom()!==nativeTarget)map.setZoom(nativeTarget,smooth);
   } else {
    const nativeZoom=map.getZoom();
    if(nativeZoom!==nativeTarget){
     // Rebase the live map while preserving its displayed geographic scale.
     // The oversized render area keeps every edge covered throughout zoom-out.
     const currentScale=new DOMMatrixReadOnly(getComputedStyle(element).transform).a;
     map.setZoom(nativeTarget,false);
     element.style.transition='none';
     element.style.transform=`translate(-50%,-50%) scale(${currentScale*2**(nativeZoom-nativeTarget)})`;
     void element.offsetWidth;
    }
    render(smooth);
   }
  } finally {applying=false;}
 };
 const change=delta=>{
  cancel();
  applyZoom(Math.max(map.getMinZoom(),Math.min(17,Math.round(zoom)+delta)),!reducedMotion());
 };
 const flyTo=(center,target,{animate=true}={})=>{
  cancel();
  const n=window.naver.maps,start=map.getCenter(),startZoom=zoom;
  target=Math.max(map.getMinZoom(),Math.min(17,target));
  if(!animate||reducedMotion()){
   map.setCenter(center);applyZoom(target);return;
  }
  const started=performance.now();
  const frame=now=>{
   const progress=Math.min(1,(now-started)/1100);
   const eased=progress<0.5?4*progress**3:1-(-2*progress+2)**3/2;
   // Drive one live map: integer tile levels plus continuous raster scale.
   map.setCenter(new n.LatLng(start.lat()+(center.lat()-start.lat())*eased,start.lng()+(center.lng()-start.lng())*eased));
   applyZoom(startZoom+(target-startZoom)*eased);
   flight=progress<1?requestAnimationFrame(frame):null;
  };
  flight=requestAnimationFrame(frame);
 };
 element.addEventListener('pointerdown',cancel);
 render();
 map.autoResize();
 const destroy=()=>{cancel();cancelMarkerFrame();element.removeEventListener('pointerdown',cancel);element.style.transition='none';};
 return {change,sync,reset,flyTo,destroy,getZoom:()=>zoom};
}
