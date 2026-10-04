import React from 'react';
import LeafletMapView from './LeafletMapView';
import NaverMapView from './NaverMapView';
export default function MapView(props) {
 const clientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID?.trim();
 return clientId ? <NaverMapView {...props} clientId={clientId}/> : <LeafletMapView {...props}/>;
}
