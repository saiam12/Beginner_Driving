import {useEffect,useMemo,useState} from 'react';
import {loadAccidentPoints,pointsInBounds} from '../../lib/accident-points';
export default function useAccidentPoints(enabled,viewport) {
 const [data,setData]=useState(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{
  if(!enabled)return;
  let cancelled=false;setError('');
  loadAccidentPoints().then(value=>{if(!cancelled)setData(value);}).catch(e=>{if(!cancelled)setError(e.message);});
  return()=>{cancelled=true;};
 },[enabled,revision]);
 const features=useMemo(()=>enabled&&data?pointsInBounds(data.features,viewport?.bounds):[],[enabled,data,viewport]);
 return {kind:!enabled?'off':error?'error':data?'ready':'loading',features,data,error,retry:()=>setRevision(value=>value+1)};
}
