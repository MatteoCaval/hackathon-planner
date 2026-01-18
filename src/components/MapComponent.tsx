import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { DUBLIN_COORDS } from '../types';
import L from 'leaflet';

// Fix for default marker icon in leaflet with webpack/vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
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

// Component to update map view when props change
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center, 4);
  return null;
}

const MapComponent: React.FC<Props> = ({ destLat, destLng, destName }) => {
  const destCoords: [number, number] = [destLat, destLng];
  const route = [DUBLIN_COORDS, destCoords];

  return (
    <div style={{ height: '300px', width: '100%', marginBottom: '20px', borderRadius: '8px', overflow: 'hidden' }}>
      <MapContainer center={destCoords} zoom={4} style={{ height: '100%', width: '100%' }}>
        <ChangeView center={destCoords} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Dublin Marker */}
        <Marker position={DUBLIN_COORDS}>
          <Popup>Dublin (Office)</Popup>
        </Marker>

        {/* Destination Marker */}
        <Marker position={destCoords}>
          <Popup>{destName}</Popup>
        </Marker>

        {/* Route Line */}
        <Polyline positions={route as any} color="blue" />
      </MapContainer>
    </div>
  );
};

export default MapComponent;
