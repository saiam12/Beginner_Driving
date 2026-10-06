import {useEffect, useState} from 'react';
import {LANE_MIN_ZOOM, laneMatches, loadLaneRoads} from '../../lib/lane-roads';

export default function useLaneRoads(viewport, selected) {
 const [state, setState] = useState({features: [], kind: 'off'});
 const [retry, setRetry] = useState(0);
 useEffect(() => {
  const controller = new AbortController();
  if (!selected.length) {setState({features: [], kind: 'off'}); return;}
  if (!viewport) {setState({features: [], kind: 'waiting'}); return;}
  if (viewport.zoom < LANE_MIN_ZOOM) {setState({features: [], kind: 'zoom'}); return;}
  // Panning must not blank the layer while the next viewport is being loaded.
  // A changed lane selection still removes deselected categories immediately.
  setState(previous => ({features: previous.features.every(f=>laneMatches(f.properties.lanes,selected))
   ? previous.features : previous.features.filter(f=>laneMatches(f.properties.lanes,selected)), kind: 'loading'}));
  const timer = setTimeout(async () => {
   try {
    const result = await loadLaneRoads(viewport.bounds, selected, {signal: controller.signal});
    if (!controller.signal.aborted) setState({features: result.features, kind: result.tooWide ? 'zoom' : 'ready'});
   } catch {
    if (!controller.signal.aborted) setState(previous=>({...previous,kind:'error'}));
   }
  }, 200);
  return () => {clearTimeout(timer); controller.abort();};
 }, [viewport, selected, retry]);
 return {...state, retry: () => setRetry(value => value + 1)};
}
