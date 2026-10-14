// References must be prepared from comparable roads for the same measurement period.
// No reference or no observation means unknown, never a measured zero.
export const ROAD_DATA_COST_WEIGHTS = {traffic:2,accidents:3};
export const ACCIDENT_EXCLUSION_COUNT = 12;
export const ACCIDENT_DENSITY_MIN_COUNT = 3;
export const ACCIDENT_DENSITY_EXCLUSION_PER_KM = 30;
export const ACCIDENT_DENSITY_REFERENCE_PER_KM = 20;
export const ACCIDENT_EXPONENTIAL_SCALE = 3;
const observed=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const reference=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
const samePeriod=(period,referencePeriod)=>typeof period==='string'&&period.trim().length>0&&period===referencePeriod;

export function roadDataCost(properties,meters) {
 const p=properties;
 const trafficKnown=reference(meters)&&observed(p.trafficVolume)&&Number.isInteger(p.lanes)&&p.lanes>0&&reference(p.trafficPerLaneReference)&&samePeriod(p.trafficPeriod,p.trafficReferencePeriod);
 const accidentLength=p.accidentLengthMeters??meters;
 const accidentsKnown=reference(meters)&&reference(accidentLength)&&observed(p.accidentCount)&&Number.isInteger(p.accidentCount)&&samePeriod(p.accidentPeriod,p.accidentReferencePeriod);
 const trafficPerLane=trafficKnown?p.trafficVolume/p.lanes:null;
 const accidentsPerKm=accidentsKnown?p.accidentCount/(accidentLength/1000):null;
 const trafficScore=trafficKnown?Math.min(1,trafficPerLane/p.trafficPerLaneReference):null;
 const accidentExcluded=accidentsKnown&&(p.accidentCount>=ACCIDENT_EXCLUSION_COUNT||(p.accidentCount>=ACCIDENT_DENSITY_MIN_COUNT&&accidentsPerKm>=ACCIDENT_DENSITY_EXCLUSION_PER_KM));
 // Density doubles the exponential term every 3 crashes/km; exclude 12+ annual crashes, or 3+ crashes at 30+/km.
 const accidentScore=accidentsKnown?Math.expm1(Math.LN2*accidentsPerKm/ACCIDENT_EXPONENTIAL_SCALE)/Math.expm1(Math.LN2*ACCIDENT_DENSITY_REFERENCE_PER_KM/ACCIDENT_EXPONENTIAL_SCALE):null;
 return {trafficPerLane,accidentsPerKm,trafficScore,accidentScore,accidentExcluded,
  trafficCost:trafficKnown?meters*ROAD_DATA_COST_WEIGHTS.traffic*trafficScore:0,
  accidentCost:accidentsKnown?meters*ROAD_DATA_COST_WEIGHTS.accidents*accidentScore:0};
}
