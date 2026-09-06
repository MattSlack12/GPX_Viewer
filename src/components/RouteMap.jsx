// src/components/RouteMap.jsx
import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const ROUTE_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

// Handles initial geolocation & route bounds transitions
function MapController({ selectedRoutes, isDrawing, userLocation, hasLocatedUser }) {
  const map = useMap();
  const initialLocateDone = useRef(false);

  // 1. Initial Geolocation Focus
  useEffect(() => {
    if (userLocation && !initialLocateDone.current) {
      initialLocateDone.current = true;
      map.flyTo([userLocation.lat, userLocation.lng], 13, {
        duration: 1.5,
      });
    }
  }, [userLocation, map]);

  // 2. Fits bounds around selected routes
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    if (isDrawing || selectedRoutes.length === 0) return () => clearTimeout(timer);
    if (!hasLocatedUser && userLocation) return () => clearTimeout(timer);

    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    selectedRoutes.forEach((r) => {
      minLat = Math.min(minLat, r.bounds[0][0]);
      minLng = Math.min(minLng, r.bounds[0][1]);
      maxLat = Math.max(maxLat, r.bounds[1][0]);
      maxLng = Math.max(maxLng, r.bounds[1][1]);
    });

    if (minLat <= maxLat && minLng <= maxLng) {
      map.fitBounds(
        [
          [minLat, minLng],
          [maxLat, maxLng],
        ],
        { padding: [50, 50] }
      );
    }

    return () => clearTimeout(timer);
  }, [selectedRoutes, isDrawing, hasLocatedUser, userLocation, map]);

  return null;
}

// Drawing Click Listener
function MapDrawingHandler({ isDrawing, onMapClick }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    if (isDrawing) {
      map.doubleClickZoom.disable();

      const handleClick = (e) => {
        if (e.latlng) {
          onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      };

      map.on('click', handleClick);

      return () => {
        map.off('click', handleClick);
        map.doubleClickZoom.enable();
      };
    } else {
      map.doubleClickZoom.enable();
    }
  }, [map, isDrawing, onMapClick]);

  return null;
}

export default function RouteMap({ selectedRoutes, isDrawing, draftCoordinates = [], onMapClick }) {
  const defaultCenter = [54.5, -2.5];
  const [userLocation, setUserLocation] = useState(null);
  const [hasLocatedUser, setHasLocatedUser] = useState(false);

  // Request browser location on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setHasLocatedUser(true);
        },
        (err) => {
          console.warn('Geolocation denied or unavailable:', err.message);
          setHasLocatedUser(true);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  const onEachFeature = (feature, layer) => {
    if (feature.geometry.type === 'Point') {
      const props = feature.properties || {};
      const name = props.name || 'Waypoint';
      const desc = props.desc || '';
      const sym = props.sym
        ? `<span style="font-size: 11px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #475569;">${props.sym}</span>`
        : '';
      const ele =
        feature.geometry.coordinates?.[2] != null
          ? `<p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">Elevation: <b>${Math.round(
              feature.geometry.coordinates[2]
            )} m</b></p>`
          : '';

      layer.bindTooltip(name, {
        permanent: false,
        direction: 'top',
        offset: [0, -32],
      });

      const popupHtml = `
        <div style="font-family: inherit; min-width: 160px; max-width: 240px; padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
            <strong style="font-size: 13px; color: #0f172a;">${name}</strong>
            ${sym}
          </div>
          ${desc ? `<p style="margin: 4px 0 0; font-size: 12px; color: #334155; line-height: 1.4;">${desc}</p>` : ''}
          ${ele}
        </div>
      `;
      layer.bindPopup(popupHtml);
    }
  };

  const pointToLayer = (feature, latlng) => L.marker(latlng);
  const draftLatLngs = draftCoordinates.map(([lng, lat]) => [lat, lng]);

  return (
    <div className={`w-full h-full relative ${isDrawing ? 'cursor-crosshair' : ''}`}>
      <MapContainer
        center={defaultCenter}
        zoom={6}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController
          selectedRoutes={selectedRoutes}
          isDrawing={isDrawing}
          userLocation={userLocation}
          hasLocatedUser={hasLocatedUser}
        />
        <MapDrawingHandler isDrawing={isDrawing} onMapClick={onMapClick} />

        {/* User's Current Location Marker (Fixed with React-Leaflet Tooltip) */}
        {userLocation && (
          <>
            <CircleMarker
              center={[userLocation.lat, userLocation.lng]}
              radius={14}
              interactive={false}
              pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2, weight: 1 }}
            />
            <CircleMarker
              center={[userLocation.lat, userLocation.lng]}
              radius={6}
              pathOptions={{ color: '#ffffff', fillColor: '#2563eb', fillOpacity: 1, weight: 2 }}
            >
              <Tooltip permanent={false} direction="top" offset={[0, -8]}>
                You are here
              </Tooltip>
            </CircleMarker>
          </>
        )}

        {/* Existing Routes */}
        {!isDrawing &&
          selectedRoutes.map((route, idx) => {
            const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
            const endLocation = route.endLocation || route.startLocation;
            return [
              <GeoJSON
                key={route.id}
                data={route.geojson}
                interactive={!isDrawing}
                style={{
                  color: color,
                  weight: 5,
                  opacity: 0.85,
                }}
                pointToLayer={pointToLayer}
                onEachFeature={onEachFeature}
              />,
              <CircleMarker
                key={`${route.id}-start`}
                center={[route.startLocation.lat, route.startLocation.lng]}
                radius={7}
                pathOptions={{ color: '#166534', fillColor: '#22c55e', fillOpacity: 1, weight: 2 }}
              >
                <Tooltip direction="top" offset={[0, -7]}>
                  Start: {route.title}
                </Tooltip>
              </CircleMarker>,
              <CircleMarker
                key={`${route.id}-end`}
                center={[endLocation.lat, endLocation.lng]}
                radius={7}
                pathOptions={{ color: '#991b1b', fillColor: '#ef4444', fillOpacity: 1, weight: 2 }}
              >
                <Tooltip direction="top" offset={[0, -7]}>
                  End: {route.title}
                </Tooltip>
              </CircleMarker>,
            ];
          })}

        {/* Snapped Draft Polyline */}
        {isDrawing && draftLatLngs.length > 0 && (
          <>
            <Polyline
              positions={draftLatLngs}
              interactive={false}
              pathOptions={{ color: '#2563eb', weight: 5, dashArray: '4, 8', opacity: 0.9 }}
            />
            <CircleMarker
              center={draftLatLngs[0]}
              radius={7}
              interactive={false}
              pathOptions={{ color: '#16a34a', fillColor: '#ffffff', fillOpacity: 1, weight: 3 }}
            />
            {draftLatLngs.length > 1 && (
              <CircleMarker
                center={draftLatLngs[draftLatLngs.length - 1]}
                radius={6}
                interactive={false}
                pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 1 }}
              />
            )}
          </>
        )}
      </MapContainer>
    </div>
  );
}