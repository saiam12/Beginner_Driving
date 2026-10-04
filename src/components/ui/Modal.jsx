import React, {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
export default function Modal({onClose,titleId,children}) {
 const dialog=useRef(null);
 useEffect(()=>{
  const previous=document.activeElement,root=document.getElementById('root');
  const previousInert=root?.inert,overflow=document.body.style.overflow;
  if(root)root.inert=true;
  document.body.style.overflow='hidden';
  dialog.current.querySelector('button')?.focus();
  return ()=>{if(root)root.inert=previousInert;document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};
 },[]);
 const keyboard=e=>{
  if(e.key==='Escape'){e.preventDefault();onClose();return;}
  if(e.key!=='Tab')return;
  const controls=[...dialog.current.querySelectorAll('button, a[href], input, [tabindex="0"]')].filter(el=>!el.disabled);
  const first=controls[0],last=controls.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 };
 return createPortal(<div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={dialog} className="guide" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={keyboard}>{children}</section></div>,document.body);
}
