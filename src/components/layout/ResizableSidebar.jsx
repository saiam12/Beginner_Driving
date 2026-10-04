import {useEffect,useRef,useState} from 'react';

const MIN_WIDTH=320,DEFAULT_WIDTH=390,MAX_WIDTH=560;

export default function ResizableSidebar({children}) {
 const panel=useRef(null),drag=useRef(null),frame=useRef(null),pendingWidth=useRef(null);
 const [width,setWidth]=useState(DEFAULT_WIDTH),[maxWidth,setMaxWidth]=useState(MAX_WIDTH),[dragging,setDragging]=useState(false);
 const clamp=value=>Math.max(MIN_WIDTH,Math.min(maxWidth,value));
 useEffect(()=>{
  const observer=new ResizeObserver(([entry])=>{
   if(entry.contentRect.width<=900){drag.current=null;setDragging(false);return;}
   const limit=Math.max(MIN_WIDTH,Math.min(MAX_WIDTH,entry.contentRect.width-420));
   setMaxWidth(limit);setWidth(value=>Math.max(MIN_WIDTH,Math.min(limit,value)));
  });
  observer.observe(panel.current.parentElement);
  return ()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  if(!dragging)return;
  const {cursor,userSelect}=document.body.style;
  document.body.style.cursor='col-resize';document.body.style.userSelect='none';
  return ()=>{document.body.style.cursor=cursor;document.body.style.userSelect=userSelect;};
 },[dragging]);
 useEffect(()=>()=>cancelAnimationFrame(frame.current),[]);
 const finish=()=>{cancelAnimationFrame(frame.current);frame.current=null;if(pendingWidth.current!==null)setWidth(pendingWidth.current);pendingWidth.current=null;drag.current=null;setDragging(false);};
 const onKeyDown=event=>{
  const values={ArrowLeft:width-20,ArrowRight:width+20,Home:MIN_WIDTH,End:maxWidth,Enter:DEFAULT_WIDTH};
  if(values[event.key]===undefined)return;
  event.preventDefault();setWidth(clamp(values[event.key]));
 };
 return <aside id="course-sidebar" className={`sidebar resizable-sidebar${dragging?' resizing':''}`} ref={panel} style={{'--sidebar-width':`${width}px`}}>
  {children}
  <div className="sidebar-resizer" role="separator" tabIndex={0} aria-label="사이드바 너비 조절" aria-controls="course-sidebar" aria-orientation="vertical" aria-valuemin={MIN_WIDTH} aria-valuemax={maxWidth} aria-valuenow={width} aria-valuetext={`${width}픽셀`} title="드래그 또는 방향키로 너비 조절 · 더블클릭으로 초기화" onKeyDown={onKeyDown} onDoubleClick={()=>setWidth(clamp(DEFAULT_WIDTH))}
   onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);drag.current={x:event.clientX,width};setDragging(true);}}
   onPointerMove={event=>{if(!drag.current)return;pendingWidth.current=clamp(drag.current.width+event.clientX-drag.current.x);if(frame.current===null)frame.current=requestAnimationFrame(()=>{frame.current=null;setWidth(pendingWidth.current);});}}
   onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}><span/></div>
 </aside>;
}
