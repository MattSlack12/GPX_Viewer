/* eslint-disable react-hooks/set-state-in-effect */
// src/components/RouteDetailsBar.jsx
import { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Download,
  MapPin,
  TrendingUp,
  Navigation,
  Mountain,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
  Loader2,
  RefreshCw,
  Pencil,
} from 'lucide-react';
import {
  formatDistance,
  formatElevation,
  convertDistance,
  convertElevation,
  DISTANCE_UNITS,
  ELEVATION_UNITS,
} from '../utils/units';

function ElevationMiniChart({
  profile,
  color = '#2563eb',
  distanceUnit = DISTANCE_UNITS.KM,
  elevationUnit = ELEVATION_UNITS.FEET,
  hoveredPoint,
  onHoverPoint,
  onFetchElevation,
  isFetchingElevation = false,
}) {
  const containerRef = useRef(null);
  const lastHoveredRef = useRef(null);

  const { minEle, maxEle, maxDist, points, areaPoints, chartMin, chartSpan, maxD, w, h } = useMemo(() => {
    if (!profile || profile.length < 2) {
      return { minEle: 0, maxEle: 0, maxDist: 0, points: '', areaPoints: '', chartMin: 0, chartSpan: 1, maxD: 1, w: 300, h: 55 };
    }

    let min = Infinity;
    let max = -Infinity;
    profile.forEach((p) => {
      if (p.elevation < min) min = p.elevation;
      if (p.elevation > max) max = p.elevation;
    });

    const eleSpan = max - min || 1;
    const chartMax = max + eleSpan * 0.1;
    const chartMin = Math.max(0, min - eleSpan * 0.1);
    const chartSpan = chartMax - chartMin;
    const maxD = profile[profile.length - 1].distance || 1;
    const w = 300;
    const h = 55;

    const pts = profile
      .map((p) => {
        const x = (p.distance / maxD) * w;
        const y = h - ((p.elevation - chartMin) / chartSpan) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    return {
      minEle: Math.round(convertElevation(min, elevationUnit)),
      maxEle: Math.round(convertElevation(max, elevationUnit)),
      maxDist: convertDistance(maxD, distanceUnit),
      points: pts,
      areaPoints: `0,${h} ${pts} ${w},${h}`,
      chartMin,
      chartSpan,
      maxD,
      w,
      h,
    };
  }, [profile, distanceUnit, elevationUnit]);

  const hoverPos = useMemo(() => {
    if (!hoveredPoint || !profile || profile.length < 2 || !maxD) return null;
    const x = Math.max(0, Math.min(w, (hoveredPoint.distance / maxD) * w));
    const y = Math.max(0, Math.min(h, h - ((hoveredPoint.elevation - chartMin) / chartSpan) * h));
    return { x, y };
  }, [hoveredPoint, profile, maxD, chartMin, chartSpan, w, h]);

  const handlePointerMove = (e) => {
    if (!profile || profile.length < 2 || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
    if (clientX == null) return;
    const offsetX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = offsetX / rect.width;
    const targetDist = ratio * maxD;

    let closest = profile[0];
    let minDiff = Math.abs(profile[0].distance - targetDist);
    for (let i = 1; i < profile.length; i++) {
      const diff = Math.abs(profile[i].distance - targetDist);
      if (diff < minDiff) {
        minDiff = diff;
        closest = profile[i];
      }
    }
    if (closest !== lastHoveredRef.current) {
      lastHoveredRef.current = closest;
      if (onHoverPoint) {
        onHoverPoint(closest);
      }
    }
  };

  const handlePointerLeave = () => {
    lastHoveredRef.current = null;
    if (onHoverPoint) {
      onHoverPoint(null);
    }
  };

  const hasElevationData =
    profile &&
    profile.length >= 2 &&
    profile.some((p) => p.elevation != null && p.elevation !== 0);

  if (!hasElevationData) {
    return (
      <div className="flex items-center justify-between gap-3 h-14 bg-amber-50/80 rounded-xl border border-dashed border-amber-200/90 px-3 text-xs">
        <div className="flex items-center gap-2 min-w-0 text-amber-900">
          <Mountain size={16} className="text-amber-600 flex-shrink-0" />
          <div className="truncate">
            <span className="font-bold text-[11px] block leading-tight">No elevation data</span>
            <span className="text-[10px] text-amber-700/80 block leading-tight">Free Open-Meteo terrain data</span>
          </div>
        </div>

        {onFetchElevation && (
          <button
            type="button"
            disabled={isFetchingElevation}
            onClick={onFetchElevation}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer flex-shrink-0 disabled:opacity-50"
            title="Fetch elevation data from Open-Meteo"
          >
            {isFetchingElevation ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Sparkles size={13} />
            )}
            <span>{isFetchingElevation ? 'Fetching...' : 'Fetch Elevation'}</span>
          </button>
        )}
      </div>
    );
  }

  const gradId = `eleGrad-${color.replace('#', '')}`;

  return (
    <div className="flex flex-col justify-center flex-1 min-w-0 w-full">
      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
        <span className="flex items-center gap-1 font-semibold text-slate-700">
          <Mountain size={13} style={{ color }} />
          Elevation Profile
          {onFetchElevation && (
            <button
              type="button"
              disabled={isFetchingElevation}
              onClick={onFetchElevation}
              className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded transition cursor-pointer ml-1"
              title="Refresh elevation data from Open-Meteo"
              aria-label="Refresh elevation"
            >
              <RefreshCw size={11} className={isFetchingElevation ? 'animate-spin' : ''} />
            </button>
          )}
        </span>
        {hoveredPoint ? (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-bold shadow-xs">
            <span style={{ color }}>●</span>
            <span>{formatDistance(hoveredPoint.distance, distanceUnit)}</span>
            <span className="text-slate-500">|</span>
            <span>{formatElevation(hoveredPoint.elevation, elevationUnit, true, true)}</span>
          </span>
        ) : (
          <span className="text-[10px] text-slate-500 font-medium">
            Min: <b>{minEle}{elevationUnit}</b> · Max: <b>{maxEle}{elevationUnit}</b>
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        onMouseMove={handlePointerMove}
        onMouseLeave={handlePointerLeave}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerLeave}
        className="h-12 w-full relative cursor-crosshair select-none touch-none overflow-hidden rounded-md"
      >
        <svg
          viewBox="0 0 300 55"
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible pointer-events-none"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <polygon points={areaPoints} fill={`url(#${gradId})`} />
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

          {hoverPos && (
            <g>
              <line
                x1={hoverPos.x}
                y1={0}
                x2={hoverPos.x}
                y2={h}
                stroke={color}
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.85"
              />
              <circle
                cx={hoverPos.x}
                cy={hoverPos.y}
                r="6"
                fill={color}
                fillOpacity="0.3"
              />
              <circle
                cx={hoverPos.x}
                cy={hoverPos.y}
                r="3"
                fill="#ffffff"
                stroke={color}
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
      </div>

      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
        <span>0 {distanceUnit}</span>
        <span>{(maxDist / 2).toFixed(1)} {distanceUnit}</span>
        <span>{maxDist.toFixed(1)} {distanceUnit}</span>
      </div>
    </div>
  );
}

export default function RouteDetailsBar({
  route,
  routeColor = '#2563eb',
  selectedRoutesCount = 1,
  activeRouteIndex = 0,
  distanceUnit = DISTANCE_UNITS.KM,
  elevationUnit = ELEVATION_UNITS.FEET,
  hoveredPoint,
  onHoverPoint,
  onFetchElevation,
  isFetchingElevation = false,
  onClose,
  onExport,
  onEditRoute,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Re-open when route changes
  useEffect(() => {
    setIsCollapsed(false);
  }, [route?.id]);

  if (!route) return null;

  const maxDist = route.distanceKm || 0;

  return (
    <div className="w-full bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 text-slate-800 transition-all duration-200 overflow-hidden">
      {/* Top Multi-track switch hint (if multiple tracks selected) */}
      {selectedRoutesCount > 1 && !isCollapsed && (
        <div className="px-4 py-1.5 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5 font-medium">
            <Layers size={12} className="text-blue-600" />
            Showing track <b>{activeRouteIndex + 1}</b> of <b>{selectedRoutesCount}</b> on map
          </span>
          <span className="text-[10px] text-slate-400 hidden sm:inline">
            Click any route on the map to switch details
          </span>
        </div>
      )}

      {/* Top Accent Strip */}
      <div className="h-1.5 w-full" style={{ backgroundColor: routeColor }} />

      {isCollapsed ? (
        /* COLLAPSED MINI BAR */
        <div className="px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-white shadow-xs"
              style={{ backgroundColor: routeColor }}
            />
            <div className="truncate">
              <span className="text-xs font-bold text-slate-800 truncate block">
                {route.title}
              </span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-2 text-xs text-slate-500 flex-shrink-0 font-medium">
              <span>{formatDistance(maxDist, distanceUnit)}</span>
              <span>·</span>
              <span>{formatElevation(route.elevationGainM, elevationUnit, true, true)}</span>
            </div>
            {route.region && (
              <>
                <span className="text-slate-300 hidden sm:inline">•</span>
                <span className="text-[11px] text-blue-600 font-semibold truncate hidden sm:flex items-center gap-1">
                  <MapPin size={11} />
                  {route.region}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {onEditRoute && (
              <button
                type="button"
                onClick={() => onEditRoute(route)}
                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                title="Edit this route on map"
              >
                <Pencil size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={() => onExport(route)}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              title="Download GPX file"
            >
              <Download size={15} />
            </button>
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
              title="Expand route details"
            >
              <ChevronUp size={15} />
              <span className="hidden sm:inline">Details</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              title="Close details bar"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : (
        /* EXPANDED VIEW */
        <div className="p-3 sm:p-3.5">
          {/* Top Header Row: Status, Region, Meta, and Action Controls */}
          <div className="flex items-center justify-between gap-3 pb-2 mb-2.5 border-b border-slate-100">
            {/* Left: Badges & Meta */}
            <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-white shadow-xs"
                style={{ backgroundColor: routeColor }}
              />
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex-shrink-0">
                {selectedRoutesCount > 1 ? `Track ${activeRouteIndex + 1}` : 'Active Route'}
              </span>
              {route.region && (
                <span className="text-xs font-medium text-blue-600 flex items-center gap-0.5 truncate flex-shrink-0">
                  <MapPin size={12} />
                  {route.region}
                </span>
              )}
              <span className="text-slate-300 hidden md:inline">•</span>
            
            </div>

            {/* Right: Actions & Window Controls */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {onEditRoute && (
                <button
                  type="button"
                  onClick={() => onEditRoute(route)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
                  title="Edit route geometry and waypoints on the map"
                >
                  <Pencil size={13} className="text-amber-600" />
                  <span className="hidden sm:inline">Edit Route</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onExport(route)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                title="Download GPX File"
              >
                <Download size={13} />
                <span className="hidden sm:inline">Export</span>
              </button>

              <div className="h-4 w-px bg-slate-200 mx-0.5" />

              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title="Collapse to mini bar"
                aria-label="Collapse"
              >
                <ChevronDown size={17} />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title="Close details bar"
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Main Body: Title & Metrics on Left, Elevation Chart on Right */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
            {/* Title & Quick Stats */}
            <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0 min-w-0">
              <div className="min-w-0 max-w-[200px] sm:max-w-xs md:max-w-[260px]">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 truncate leading-snug" title={route.title}>
                  {route.title}
                </h3>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 truncate">
                  {route.startLocation && (
                    <span>
                      Start: {route.startLocation.lat.toFixed(3)}, {route.startLocation.lng.toFixed(3)}
                    </span>
                  )}
                  {route.pointCount && (
                    <>
                      <span>•</span>
                      <span>{route.pointCount} pts</span>
                    </>
                  )}
                </div>
              </div>

              {/* Quick Metrics */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="p-1 rounded-lg bg-blue-100/80 text-blue-600">
                    <Navigation size={13} />
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-slate-400">Distance</span>
                    <span className="text-xs sm:text-sm font-extrabold text-slate-800">
                      {formatDistance(route.distanceKm, distanceUnit, 1, false)}{' '}
                      <span className="text-[10px] font-medium text-slate-500">{distanceUnit}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="p-1 rounded-lg bg-emerald-100/80 text-emerald-600">
                    <TrendingUp size={13} />
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-slate-400">Gain</span>
                    <span className="text-xs sm:text-sm font-extrabold text-slate-800">
                      {formatElevation(route.elevationGainM, elevationUnit, false, true)}{' '}
                      <span className="text-[10px] font-medium text-slate-500">{elevationUnit}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Elevation Profile Chart - Generous full remaining width */}
            <div className="flex-1 min-w-0 w-full">
              <ElevationMiniChart
                profile={route.elevationProfile}
                color={routeColor}
                distanceUnit={distanceUnit}
                elevationUnit={elevationUnit}
                hoveredPoint={hoveredPoint}
                onHoverPoint={onHoverPoint}
                onFetchElevation={onFetchElevation ? () => onFetchElevation(route) : undefined}
                isFetchingElevation={isFetchingElevation}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

