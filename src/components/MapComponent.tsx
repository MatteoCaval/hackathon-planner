import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { DUBLIN_COORDS } from '../types';
import L from 'leaflet';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface Props {
  destLat: number;
  destLng: number;
  destName: string;
}

function ChangeView({ center, bounds }: { center: [number, number]; bounds: [number, number][] }) {
  const map = useMap();
  React.useEffect(() => {
    map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [30, 30] });
  }, [map, center[0], center[1]]);
  return null;
}

const MapComponent: React.FC<Props> = ({ destLat, destLng, destName }) => {
  const destCoords: [number, number] = [destLat, destLng];
  const bounds: [number, number][] = [DUBLIN_COORDS, destCoords];

  return (
    <MapContainer
      center={destCoords}
      zoom={4}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
      scrollWheelZoom={false}
      attributionControl={false}
    >
      <ChangeView center={destCoords} bounds={bounds} />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <Marker position={DUBLIN_COORDS}>
        <Popup>Dublin</Popup>
      </Marker>
      <Marker position={destCoords}>
        <Popup>{destName}</Popup>
      </Marker>
      <Polyline
        positions={[DUBLIN_COORDS, destCoords]}
        pathOptions={{ color: 'var(--accent, #3a6b8c)', weight: 2, opacity: 0.6, dashArray: '6 4' }}
      />
    </MapContainer>
  );
};

export default MapComponent;
