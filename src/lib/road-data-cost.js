// References must be prepared from comparable roads for the same measurement period.
// No reference or no observation means unknown, never a measured zero.
export const ROAD_DATA_COST_WEIGHTS = {traffic:2,accidents:3};
const observed=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const reference=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
const samePeriod=(period,referencePeriod)=>typeof period==='string'&&period.trim().length>0&&period===referencePeriod;

export function roadDataCost(properties,meters) {
 const p=properties;
 const trafficKnown=reference(meters)&&observed(p.trafficVolume)&&Number.isInteger(p.lanes)&&p.lanes>0&&reference(p.trafficPerLaneReference)&&samePeriod(p.trafficPeriod,p.trafficReferencePeriod);
 const accidentsKnown=reference(meters)&&observed(p.accidentCount)&&Number.isInteger(p.accidentCount)&&reference(p.accidentsPerKmReference)&&samePeriod(p.accidentPeriod,p.accidentReferencePeriod);
 const trafficPerLane=trafficKnown?p.trafficVolume/p.lanes:null;
 const accidentsPerKm=accidentsKnown?p.accidentCount/(meters/1000):null;
 const trafficScore=trafficKnown?Math.min(1,trafficPerLane/p.trafficPerLaneReference):null;
 const accidentScore=accidentsKnown?Math.min(1,accidentsPerKm/p.accidentsPerKmReference):null;
 return {trafficPerLane,accidentsPerKm,trafficScore,accidentScore,
  trafficCost:trafficKnown?meters*ROAD_DATA_COST_WEIGHTS.traffic*trafficScore:0,
  accidentCost:accidentsKnown?meters*ROAD_DATA_COST_WEIGHTS.accidents*accidentScore:0};
}
