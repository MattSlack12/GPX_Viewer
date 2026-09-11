import { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, Polyline, CircleMarker, Tooltip, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import {
  formatDistance,
  formatElevation,
  DISTANCE_UNITS,
  ELEVATION_UNITS,
} from '../utils/units';
import { getActiveLayerConfig } from '../utils/mapLayers';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// eslint-disable-next-line react-refresh/only-export-components
export const ROUTE_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

// Handles initial geolocation & route bounds transitions
function MapController({ selectedRoutes, isDrawing, editingRoute, userLocation, hasLocatedUser }) {
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

  // 3. Fits bounds to route being edited
  useEffect(() => {
    if (!editingRoute || !editingRoute.bounds) return;

    const fitRouteBounds = () => {
      map.invalidateSize();
      if (editingRoute.bounds) {
        map.fitBounds(editingRoute.bounds, { padding: [60, 60] });
      }
    };

    fitRouteBounds();
    const timer = setTimeout(fitRouteBounds, 200);

    return () => clearTimeout(timer);
  }, [editingRoute, map]);

  return null;
}

// Drawing Click Listener
function MapDrawingHandler({ isDrawing, onMapClick, isDraggingRef }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    if (isDrawing) {
      map.doubleClickZoom.disable();

      const handleClick = (e) => {
        if (isDraggingRef?.current) return;

        // Never trigger map click if the user clicked on any marker or control
        const target = e.originalEvent?.target;
        if (
          target &&
          target.closest(
            '.leaflet-marker-icon, .drawing-waypoint-icon, .drawing-midpoint-icon, .leaflet-popup'
          )
        ) {
          return;
        }

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
  }, [map, isDrawing, onMapClick, isDraggingRef]);

  return null;
}

function createWaypointIcon(index, isStart, isEnd, isSingle) {
  let bg = '#2563eb';
  if (isSingle || isStart) bg = '#16a34a';
  else if (isEnd) bg = '#dc2626';

  return L.divIcon({
    className: 'drawing-waypoint-icon',
    html: `
      <div style="
        width: 28px;
        height: 28px;
        background-color: ${bg};
        border: 2.5px solid #ffffff;
        border-radius: 9999px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-size: 11px;
        font-weight: 700;
        font-family: system-ui, -apple-system, sans-serif;
        cursor: grab;
        user-select: none;
        pointer-events: auto;
      ">
        ${index + 1}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createMidpointIcon() {
  return L.divIcon({
    className: 'drawing-midpoint-icon',
    html: `
      <div style="
        width: 18px;
        height: 18px;
        background-color: #ffffff;
        border: 2.5px solid #2563eb;
        border-radius: 9999px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
        user-select: none;
        pointer-events: auto;
      ">
        <div style="width: 5px; height: 5px; background-color: #2563eb; border-radius: 9999px;"></div>
      </div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export default function RouteMap({
  selectedRoutes,
  activeRouteId,
  onSelectRoute,
  isDrawing,
  editingRoute = null,
  userWaypoints = [],
  routeLegs = [],
  draftCoordinates = [],
  onMapClick,
  onMoveWaypoint,
  onInsertWaypoint,
  onDeleteWaypoint,
  isRoutingLoading = false,
  distanceUnit = DISTANCE_UNITS.KM,
  elevationUnit = ELEVATION_UNITS.FEET,
  hoveredPoint,
  onHoverPoint,
  currentLayerId = 'osm',
  osApiKey = '',
}) {
  const defaultCenter = [54.5, -2.5];
  const [userLocation, setUserLocation] = useState(null);
  const [hasLocatedUser, setHasLocatedUser] = useState(false);

  const activeLayerConfig = useMemo(() => {
    return getActiveLayerConfig(currentLayerId, osApiKey);
  }, [currentLayerId, osApiKey]);

  const onHoverPointRef = useRef(onHoverPoint);
  useEffect(() => {
    onHoverPointRef.current = onHoverPoint;
  }, [onHoverPoint]);
  const lastHoveredRef = useRef(null);
  const isDraggingRef = useRef(false);

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

  const createOnEachFeature = (route, isActive) => (feature, layer) => {
    if (feature.geometry.type === 'Point') {
      const props = feature.properties || {};
      const name = props.name || 'Waypoint';
      const desc = props.desc || '';
      const sym = props.sym
        ? `<span style="font-size: 11px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #475569;">${props.sym}</span>`
        : '';
      const ele =
        feature.geometry.coordinates?.[2] != null
          ? `<p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">Elevation: <b>${formatElevation(
              feature.geometry.coordinates[2],
              elevationUnit,
              true
            )}</b></p>`
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

      layer.on('click', () => {
        if (onSelectRoute) onSelectRoute(route);
      });
    } else {
      // Line track click & hover handlers
      layer.on({
        click: (e) => {
          L.DomEvent.stopPropagation(e);
          if (onSelectRoute) {
            onSelectRoute(route);
          }
        },
        mousemove: (e) => {
          if (!isActive || !route.elevationProfile || route.elevationProfile.length === 0) return;
          const lat = e.latlng.lat;
          const lng = e.latlng.lng;
          let closest = null;
          let minDistSq = Infinity;
          for (let i = 0; i < route.elevationProfile.length; i++) {
            const p = route.elevationProfile[i];
            const dSq = (p.lat - lat) ** 2 + (p.lng - lng) ** 2;
            if (dSq < minDistSq) {
              minDistSq = dSq;
              closest = p;
            }
          }
          if (closest && closest !== lastHoveredRef.current) {
            lastHoveredRef.current = closest;
            if (onHoverPointRef.current) {
              onHoverPointRef.current(closest);
            }
          }
        },
        mouseover: () => {
          layer.setStyle({
            weight: isActive ? 8 : 6,
            opacity: 1,
          });
        },
        mouseout: () => {
          layer.setStyle({
            weight: isActive ? 7 : (selectedRoutes.length > 1 ? 4 : 5),
            opacity: isActive ? 1.0 : (selectedRoutes.length > 1 ? 0.65 : 0.85),
          });
          if (isActive) {
            lastHoveredRef.current = null;
            if (onHoverPointRef.current) {
              onHoverPointRef.current(null);
            }
          }
        },
      });

      if (!isActive) {
        layer.bindTooltip(
          `<div style="font-family: system-ui, sans-serif; padding: 2px;">
            <div style="font-weight: 700; color: #0f172a; font-size: 12px;">${route.title}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
              ${formatDistance(route.distanceKm, distanceUnit)} · ${formatElevation(route.elevationGainM, elevationUnit, true, true)}
            </div>
            <div style="font-size: 10px; color: #2563eb; font-weight: 600; margin-top: 2px;">Click to view details</div>
          </div>`,
          { sticky: true, direction: 'top' }
        );
      }
    }
  };

  const pointToLayer = (feature, latlng) => L.marker(latlng);
  const draftLatLngs = draftCoordinates.map(([lng, lat]) => [lat, lng]);

  // Sort so activeRoute is drawn last (on top of overlapping routes)
  const sortedRoutes = [...selectedRoutes].sort((a, b) => {
    if (a.id === activeRouteId) return 1;
    if (b.id === activeRouteId) return -1;
    return 0;
  });

  const activeRouteIndex = selectedRoutes.findIndex((r) => r.id === activeRouteId);
  const activeRouteColor =
    activeRouteIndex >= 0
      ? ROUTE_COLORS[activeRouteIndex % ROUTE_COLORS.length]
      : ROUTE_COLORS[0];

  const midpoints = [];
  if (isDrawing && userWaypoints.length >= 2) {
    for (let i = 0; i < userWaypoints.length - 1; i++) {
      const leg = routeLegs[i];
      let lat, lng;
      if (leg && leg.length >= 2) {
        const midCoord = leg[Math.floor(leg.length / 2)];
        lng = midCoord[0];
        lat = midCoord[1];
      } else {
        lat = (userWaypoints[i].lat + userWaypoints[i + 1].lat) / 2;
        lng = (userWaypoints[i].lng + userWaypoints[i + 1].lng) / 2;
      }
      midpoints.push({ legIndex: i, lat, lng });
    }
  }

  return (
    <div className={`w-full h-full relative ${isDrawing ? 'cursor-crosshair' : ''}`}>
      <MapContainer
        center={defaultCenter}
        zoom={6}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          key={`${activeLayerConfig.id}-${activeLayerConfig.url}`}
          attribution={activeLayerConfig.attribution}
          url={activeLayerConfig.url}
          maxZoom={activeLayerConfig.maxZoom || 19}
        />

        <MapController
          selectedRoutes={selectedRoutes}
          isDrawing={isDrawing}
          editingRoute={editingRoute}
          userLocation={userLocation}
          hasLocatedUser={hasLocatedUser}
        />
        <MapDrawingHandler isDrawing={isDrawing} onMapClick={onMapClick} isDraggingRef={isDraggingRef} />

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
          sortedRoutes.map((route) => {
            const routeIndex = selectedRoutes.findIndex((r) => r.id === route.id);
            const color = ROUTE_COLORS[(routeIndex >= 0 ? routeIndex : 0) % ROUTE_COLORS.length];
            const isActive = route.id === activeRouteId;
            const endLocation = route.endLocation || route.startLocation;

            return [
              <GeoJSON
                key={`${route.id}-${isActive ? 'active' : 'inactive'}-${color}-${distanceUnit}-${elevationUnit}`}
                data={route.geojson}
                interactive={!isDrawing}
                style={() => ({
                  color: color,
                  weight: isActive ? 7 : (selectedRoutes.length > 1 ? 4 : 5),
                  opacity: isActive ? 1.0 : (selectedRoutes.length > 1 ? 0.65 : 0.85),
                })}
                pointToLayer={pointToLayer}
                onEachFeature={createOnEachFeature(route, isActive)}
              />,
              <CircleMarker
                key={`${route.id}-start`}
                center={[route.startLocation.lat, route.startLocation.lng]}
                radius={isActive ? 9 : 7}
                pathOptions={{
                  color: isActive ? '#15803d' : '#166534',
                  fillColor: '#22c55e',
                  fillOpacity: 1,
                  weight: isActive ? 3 : 2,
                }}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    if (onSelectRoute) onSelectRoute(route);
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -7]}>
                  Start: {route.title}
                </Tooltip>
              </CircleMarker>,
              <CircleMarker
                key={`${route.id}-end`}
                center={[endLocation.lat, endLocation.lng]}
                radius={isActive ? 9 : 7}
                pathOptions={{
                  color: isActive ? '#b91c1c' : '#991b1b',
                  fillColor: '#ef4444',
                  fillOpacity: 1,
                  weight: isActive ? 3 : 2,
                }}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    if (onSelectRoute) onSelectRoute(route);
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -7]}>
                  End: {route.title}
                </Tooltip>
              </CircleMarker>,
            ];
          })}

        {/* Snapped Draft Polyline & Interactive Waypoints */}
        {isDrawing && (
          <>
            {draftLatLngs.length > 0 && (
              <Polyline
                positions={draftLatLngs}
                interactive={false}
                pathOptions={{
                  color: '#2563eb',
                  weight: 5,
                  opacity: 0.9,
                  dashArray: isRoutingLoading ? '6, 8' : undefined,
                }}
              />
            )}

            {/* Midpoint handles for inserting points */}
            {midpoints.map((mp) => (
              <Marker
                key={`midpoint-${mp.legIndex}-${mp.lat.toFixed(5)}-${mp.lng.toFixed(5)}`}
                position={[mp.lat, mp.lng]}
                draggable={true}
                autoPan={true}
                icon={createMidpointIcon()}
                eventHandlers={{
                  mousedown: (e) => {
                    L.DomEvent.stopPropagation(e);
                  },
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    if (onInsertWaypoint) {
                      onInsertWaypoint(mp.legIndex, { lat: mp.lat, lng: mp.lng });
                    }
                  },
                  dragstart: (e) => {
                    isDraggingRef.current = true;
                    L.DomEvent.stopPropagation(e);
                  },
                  dragend: (e) => {
                    L.DomEvent.stopPropagation(e);
                    setTimeout(() => {
                      isDraggingRef.current = false;
                    }, 250);
                    const latlng = e.target.getLatLng();
                    if (onInsertWaypoint) {
                      onInsertWaypoint(mp.legIndex, { lat: latlng.lat, lng: latlng.lng });
                    }
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  <span className="text-[11px] font-medium font-sans">Drag or click to bend route</span>
                </Tooltip>
              </Marker>
            ))}

            {/* Draggable Waypoints */}
            {userWaypoints.map((wp, index) => {
              const isStart = index === 0;
              const isEnd = index === userWaypoints.length - 1 && userWaypoints.length > 1;
              const isSingle = userWaypoints.length === 1;

              return (
                <Marker
                  key={`waypoint-${index}-${wp.lat.toFixed(5)}-${wp.lng.toFixed(5)}`}
                  position={[wp.lat, wp.lng]}
                  draggable={true}
                  autoPan={true}
                  icon={createWaypointIcon(index, isStart, isEnd, isSingle)}
                  eventHandlers={{
                    mousedown: (e) => {
                      L.DomEvent.stopPropagation(e);
                    },
                    click: (e) => {
                      L.DomEvent.stopPropagation(e);
                    },
                    dragstart: (e) => {
                      isDraggingRef.current = true;
                      L.DomEvent.stopPropagation(e);
                    },
                    dragend: (e) => {
                      L.DomEvent.stopPropagation(e);
                      setTimeout(() => {
                        isDraggingRef.current = false;
                      }, 250);
                      const latlng = e.target.getLatLng();
                      if (onMoveWaypoint) {
                        onMoveWaypoint(index, { lat: latlng.lat, lng: latlng.lng });
                      }
                    },
                    contextmenu: (e) => {
                      L.DomEvent.stopPropagation(e);
                      if (onDeleteWaypoint) {
                        onDeleteWaypoint(index);
                      }
                    },
                  }}
                >
                  <Tooltip direction="top" offset={[0, -16]}>
                    <div className="text-[11px] font-sans">
                      <strong>
                        {isStart
                          ? 'Start (Point 1)'
                          : isEnd
                          ? `End (Point ${index + 1})`
                          : `Point ${index + 1}`}
                      </strong>
                      <div className="text-slate-500">
                        Drag to move{index > 0 || userWaypoints.length > 1 ? ' · Right-click to remove' : ''}
                      </div>
                    </div>
                  </Tooltip>
                </Marker>
              );
            })}
          </>
        )}

        {/* Synchronized Hover Marker along Active Track */}
        {!isDrawing &&
          hoveredPoint &&
          typeof hoveredPoint.lat === 'number' &&
          typeof hoveredPoint.lng === 'number' && (
            <>
              <CircleMarker
                center={[hoveredPoint.lat, hoveredPoint.lng]}
                radius={11}
                interactive={false}
                pathOptions={{
                  color: activeRouteColor,
                  fillColor: activeRouteColor,
                  fillOpacity: 0.25,
                  weight: 1.5,
                }}
              />
              <CircleMarker
                center={[hoveredPoint.lat, hoveredPoint.lng]}
                radius={5.5}
                interactive={false}
                pathOptions={{
                  color: '#ffffff',
                  fillColor: activeRouteColor,
                  fillOpacity: 1,
                  weight: 2.5,
                }}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className="elevation-hover-tooltip"
                >
                  <div className="text-center font-sans">
                    <div className="font-extrabold text-xs text-slate-900 leading-tight">
                      {formatDistance(hoveredPoint.distance, distanceUnit)}
                    </div>
                    <div className="text-[11px] font-semibold text-blue-600 leading-tight">
                      {formatElevation(hoveredPoint.elevation, elevationUnit, true, true)}
                    </div>
                  </div>
                </Tooltip>
              </CircleMarker>
            </>
          )}
      </MapContainer>
    </div>
  );
}