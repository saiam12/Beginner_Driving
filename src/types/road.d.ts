// The app's road identifiers are official Level 5.5 k_link_id values.
export type RoadLinkId = string;
export interface RoadLink {
 linkId: RoadLinkId;
 lev5_5_link_id: RoadLinkId;
 identifierSystem: 'level5.5';
 roadName: string;
 lanes: number | null;
 roadRank: string | null;
 roadType: string | null;
 roadNo: string | null;
 fNode: string | null;
 tNode: string | null;
 fNodeName: string | null;
 tNodeName: string | null;
 centerLat: number;
 centerLng: number;
 regions: string[];
 lengthMeters: number;
 speedLimit: number | null;
 trafficVolume: number | null;
 accidentCount: number | null;
 // Optional future cost inputs. Traffic volume is vehicles/hour for this directed LINK.
 trafficPeriod?: string;
 trafficPerLaneReference?: number; // Comparable vehicles/hour/lane scale, e.g. cohort P95.
 trafficReferencePeriod?: string;
 accidentPeriod?: string;
 accidentLengthMeters?: number; // Full observed link length; retained when a route splits it.
 accidentSource?: string;
 accidentMatchMethod?: string;
 accidentsPerKmReference?: number; // Comparable accidents/km over the same period.
 accidentReferencePeriod?: string;
 floatingPopulation: number | null;
 difficultyScore: number | null;
}
export interface RoadGeometry {
 type: 'LineString' | 'MultiLineString';
 coordinates: number[][] | number[][][]; // GeoJSON [longitude, latitude]
}
export interface RoadGroup {
 roadGroupId: string;
 roadName: string;
 regions: string[];
 bounds: [number, number, number, number]; // west, south, east, north
 centerLat: number;
 centerLng: number;
 laneMin: number | null;
 laneMax: number | null;
 linkCount: number;
 lengthMeters: number;
 geometryShard: string;
}
export interface RoadRoute {
 routeId: string;
 linkIds: RoadLinkId[]; // ordered IDs; scoring and legal routing added separately
}
