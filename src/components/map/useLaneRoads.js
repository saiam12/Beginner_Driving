import {useEffect, useState} from 'react';
import {LANE_MIN_ZOOM, loadLaneRoads} from '../../lib/lane-roads';

export default function useLaneRoads(viewport) {
 const [state, setState] = useState({features: [], kind: 'waiting'});
 const [retry, setRetry] = useState(0);
 useEffect(() => {
  const controller = new AbortController();
  if (!viewport) {setState({features: [], kind: 'waiting'}); return;}
  if (viewport.zoom < LANE_MIN_ZOOM) {setState({features: [], kind: 'zoom'}); return;}
  setState(previous => ({...previous, kind: 'loading'}));
  const timer = setTimeout(async () => {
   try {
    const result = await loadLaneRoads(viewport.bounds, null, {signal: controller.signal});
    if (!controller.signal.aborted) setState({features: result.features, kind: result.tooWide ? 'zoom' : 'ready'});
   } catch {
    if (!controller.signal.aborted) setState(previous=>({...previous,kind:'error'}));
   }
  }, 200);
  return () => {clearTimeout(timer); controller.abort();};
 }, [viewport, retry]);
 return {...state, retry: () => setRetry(value => value + 1)};
}
