import {useEffect, useState} from 'react';
import {LANE_MIN_ZOOM, loadLaneRoads,loadDisplayLaneRoads} from '../../lib/lane-roads';

export default function useLaneRoads(viewport,{selected=null,display=false}={}) {
 const [state, setState] = useState({features: [], kind: 'waiting'});
 const [retry, setRetry] = useState(0);
 const selectionKey=selected?.join(',')??'all';
 useEffect(() => {
  const controller = new AbortController();
  if(display&&!selected?.length){setState({features:[],kind:'off'});return;}
  if (!viewport) {setState({features: [], kind: 'waiting'}); return;}
  if (viewport.zoom < LANE_MIN_ZOOM) {setState({features: [], kind: 'zoom'}); return;}
  setState(previous => ({...previous, kind: 'loading'}));
  const timer = setTimeout(async () => {
   try {
    const result = await (display?loadDisplayLaneRoads:loadLaneRoads)(viewport.bounds, selected, {signal: controller.signal,regional:!display&&viewport.regional});
    if (!controller.signal.aborted) setState({features: result.features, kind: result.tooWide ? 'zoom' : 'ready'});
   } catch {
    if (!controller.signal.aborted) setState(previous=>({...previous,kind:'error'}));
   }
  }, 200);
  return () => {clearTimeout(timer); controller.abort();};
 }, [viewport, retry,selectionKey,display]);
 return {...state, retry: () => setRetry(value => value + 1)};
}
