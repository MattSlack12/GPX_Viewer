/* eslint-disable react-hooks/set-state-in-effect */
// src/App.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  parseGpxFile,
  enrichCoordinatesWithElevation,
  enrichGpxXmlWithElevation,
  buildGpxXml,
} from './utils/gpxParser';
import RouteMap, { ROUTE_COLORS } from './components/RouteMap';
import RouteDetailsBar from './components/RouteDetailsBar';
import RouteCreatorBar from './components/RouteCreatorBar';
import SettingsModal from './components/SettingsModal';
import SaveRouteModal from './components/SaveRouteModal';
import MapLayerSelector from './components/MapLayerSelector';
import { apiRequest } from './utils/api';
import useRouteDrawing from './hooks/useRouteDrawing';
import useRouteFilters from './hooks/useRouteFilters';
import { prepareRouteForEditing } from './utils/routeEditor';
import { Trash2, Download, Filter, MapPin, UploadCloud, PenTool, Settings, Loader2, Pencil } from 'lucide-react';
import {
  DISTANCE_UNITS,
  ELEVATION_UNITS,
  formatDistance,
  formatElevation,
} from './utils/units';
import { DEFAULT_MAP_LAYER } from './utils/mapLayers';

export default function App() {
  const [routes, setRoutes] = useState([]);
  // Initializes empty so no routes are checked on load
  const [selectedRouteIds, setSelectedRouteIds] = useState(new Set());
  const [activeRouteId, setActiveRouteId] = useState(null);
  const [editingRoute, setEditingRoute] = useState(null);
  const [hoveredTrackPoint, setHoveredTrackPoint] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingRouteId, setDeletingRouteId] = useState(null);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true);
  const [appError, setAppError] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [routeName, setRouteName] = useState('');
  const fileInputRef = useRef(null);

  // Units state: distance defaults to km, elevation defaults to ft
  const [distanceUnit, setDistanceUnit] = useState(() => {
    return localStorage.getItem('gpx_distance_unit') || DISTANCE_UNITS.KM;
  });
  const [elevationUnit, setElevationUnit] = useState(() => {
    return localStorage.getItem('gpx_elevation_unit') || ELEVATION_UNITS.FEET;
  });
  const [mapLayer, setMapLayer] = useState(() => {
    return localStorage.getItem('gpx_map_layer') || DEFAULT_MAP_LAYER;
  });
  const [osApiKey, setOsApiKey] = useState(() => {
    return localStorage.getItem('gpx_os_api_key') || import.meta.env.VITE_OS_API_KEY || '';
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleDistanceUnitChange = (unit) => {
    setDistanceUnit(unit);
    localStorage.setItem('gpx_distance_unit', unit);
  };

  const handleElevationUnitChange = (unit) => {
    setElevationUnit(unit);
    localStorage.setItem('gpx_elevation_unit', unit);
  };

  const handleMapLayerChange = (layerId) => {
    setMapLayer(layerId);
    localStorage.setItem('gpx_map_layer', layerId);
  };

  const handleOsApiKeyChange = (key) => {
    setOsApiKey(key);
    if (key) {
      localStorage.setItem('gpx_os_api_key', key);
    } else {
      localStorage.removeItem('gpx_os_api_key');
    }
  };

  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isFetchingElevation, setIsFetchingElevation] = useState(false);
  const {
    isDrawing,
    startDrawing,
    loadRouteForEditing,
    cancelDrawing,
    routingMode,
    setRoutingMode,
    userWaypoints,
    routeLegs,
    draftTrackCoords,
    isRoutingLoading,
    canUndo,
    handleMapClick,
    handleMoveWaypoint,
    handleInsertWaypoint,
    handleDeleteWaypoint,
    handleUndoPoint,
  } = useRouteDrawing();
  const { filters, setFilters, availableRegions, filteredRoutes } = useRouteFilters(routes, distanceUnit);

  const draftDistanceKm = useMemo(() => {
    if (!draftTrackCoords || draftTrackCoords.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < draftTrackCoords.length; i++) {
      const [lon1, lat1] = draftTrackCoords[i - 1];
      const [lon2, lat2] = draftTrackCoords[i];
      const toRad = (x) => (x * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      total += 6371 * c;
    }
    return parseFloat(total.toFixed(2));
  }, [draftTrackCoords]);

  const handleCancelDrawing = () => {
    cancelDrawing();
    setRouteName('');
    setEditingRoute(null);
    setIsSaveModalOpen(false);
  };

  const handleStartEditingRoute = (route, e) => {
    if (e) e.stopPropagation();
    if (!route) return;

    const prepared = prepareRouteForEditing(route);
    loadRouteForEditing(prepared);
    setEditingRoute({ ...route });
    setRouteName(prepared.routeName);
    if (!selectedRouteIds.has(route.id)) {
      setSelectedRouteIds((prev) => new Set([route.id, ...prev]));
    }
    setActiveRouteId(route.id);
    setIsSidebarOpen(false);
  };

  // Load existing routes from src/gpx/
  useEffect(() => {
    async function loadGPXFiles() {
      try {
        const files = import.meta.glob('/src/gpx/*.gpx', { query: '?raw', import: 'default' });
        const parsedRoutes = [];

        for (const path in files) {
          const rawContent = await files[path]();
          const fileName = path.split('/').pop();
          const parsed = parseGpxFile(fileName, rawContent);
          parsedRoutes.push(parsed);
        }

        setRoutes(parsedRoutes);
      } catch (err) {
        console.error(err);
        setAppError(`Could not load the route library: ${err.message}`);
      } finally {
        setIsLoadingRoutes(false);
      }
    }

    loadGPXFiles();
  }, []);

  const handleConfirmSaveRoute = async ({ routeName: finalTitle, fileName: finalFileName, overwrite = false }) => {
    if (draftTrackCoords.length < 2) return;

    setIsSavingRoute(true);
    setAppError('');

    try {
      const coordsWithElevation = await enrichCoordinatesWithElevation(draftTrackCoords);
      const gpxXml = buildGpxXml(finalTitle, coordsWithElevation);

      const shouldOverwrite =
        Boolean(overwrite) ||
        (Boolean(editingRoute) && finalFileName.toLowerCase() === editingRoute.fileName.toLowerCase());

      const result = await apiRequest('/api/save-gpx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          filename: finalFileName,
          gpxXml,
          overwrite: shouldOverwrite,
        }),
      });

      const parsed = parseGpxFile(result.filename, gpxXml);
      setRoutes((prev) => {
        const oldIdToRemove = shouldOverwrite && editingRoute ? editingRoute.id : parsed.id;
        const remaining = prev.filter((route) => route.id !== oldIdToRemove && route.id !== parsed.id);
        return [parsed, ...remaining];
      });

      setSelectedRouteIds(new Set([parsed.id]));
      setActiveRouteId(parsed.id);

      setIsSaveModalOpen(false);
      setEditingRoute(null);
      handleCancelDrawing();
    } catch (err) {
      console.error(err);
      setAppError(`Failed to save route: ${err.message}`);
    } finally {
      setIsSavingRoute(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.gpx')) {
      setAppError('Please upload a valid .gpx file.');
      return;
    }

    setIsUploading(true);
    setAppError('');
    try {
      const formData = new FormData();
      formData.append('gpxFile', file);

      const result = await apiRequest('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const rawXml = await file.text();
      const parsed = parseGpxFile(result.filename, rawXml);

      setRoutes((prev) => [parsed, ...prev.filter((r) => r.id !== parsed.id)]);
      setSelectedRouteIds((prev) => new Set([parsed.id, ...prev]));
      setActiveRouteId(parsed.id);
    } catch (err) {
      console.error(err);
      setAppError(`Could not upload file: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFetchElevation = async (route) => {
    if (!route || !route.rawXml || isFetchingElevation) return;

    setIsFetchingElevation(true);
    setAppError('');

    try {
      const enrichedXml = await enrichGpxXmlWithElevation(route.rawXml);
      const parsed = parseGpxFile(route.fileName, enrichedXml);

      // Update route in state
      setRoutes((prev) => prev.map((r) => (r.id === route.id ? parsed : r)));

      // Overwrite file on disk
      await apiRequest('/api/save-gpx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          filename: route.fileName,
          gpxXml: enrichedXml,
          overwrite: true,
        }),
      });

      setHoveredTrackPoint(null);
    } catch (err) {
      console.error('Failed to fetch elevation:', err);
      setAppError(`Could not fetch elevation: ${err.message}`);
    } finally {
      setIsFetchingElevation(false);
    }
  };

  const handleToggleRoute = (id) => {
    const updated = new Set(selectedRouteIds);
    if (updated.has(id)) {
      updated.delete(id);
      setSelectedRouteIds(updated);
      if (activeRouteId === id) {
        const remaining = Array.from(updated);
        setActiveRouteId(remaining.length > 0 ? remaining[0] : null);
      }
    } else {
      updated.add(id);
      setSelectedRouteIds(updated);
      setActiveRouteId(id);
    }
  };

  // Keep activeRouteId aligned with selected routes
  useEffect(() => {
    if (selectedRouteIds.size === 0) {
      if (activeRouteId !== null) setActiveRouteId(null);
    } else if (activeRouteId && !selectedRouteIds.has(activeRouteId)) {
      const nextId = Array.from(selectedRouteIds)[0];
      setActiveRouteId(nextId || null);
    }
  }, [selectedRouteIds, activeRouteId]);

  // Clear hovered point when active route changes or drawing mode toggles
  useEffect(() => {
    setHoveredTrackPoint(null);
  }, [activeRouteId, isDrawing]);

  const handleExport = (route, e) => {
    if (e) e.stopPropagation();
    if (!route || !route.rawXml) return;

    const safeName = (route.fileName || `${route.title}.gpx`).replace(/[^\w.-]/g, '_');
    const blob = new Blob([route.rawXml], { type: 'application/gpx+xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = safeName.endsWith('.gpx') ? safeName : `${safeName}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleDeleteRoute = async (route, e) => {
    if (e) e.stopPropagation();
    if (!route || !route.fileName) return;

    const routeDisplayName = route.title || route.fileName;
    const isConfirmed = window.confirm(
      `Are you sure you want to permanently delete "${routeDisplayName}" (${route.fileName}) from the src/gpx folder?`
    );
    if (!isConfirmed) return;

    setDeletingRouteId(route.id);
    setAppError('');

    try {
      await apiRequest('/api/delete-gpx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ filename: route.fileName }),
      });

      // Remove route from state
      setRoutes((prev) => prev.filter((r) => r.id !== route.id));

      // Remove from selected routes
      setSelectedRouteIds((prev) => {
        const next = new Set(prev);
        next.delete(route.id);
        return next;
      });

      // Clear active route if it was deleted
      if (activeRouteId === route.id) {
        setActiveRouteId(null);
      }
      setHoveredTrackPoint(null);
    } catch (err) {
      console.error('Failed to delete route:', err);
      setAppError(`Failed to delete route "${routeDisplayName}": ${err.message}`);
    } finally {
      setDeletingRouteId(null);
    }
  };

  const selectedRoutesList = routes.filter((r) => selectedRouteIds.has(r.id));
  const activeRoute = routes.find((r) => r.id === activeRouteId) || null;
  const activeRouteIndex = selectedRoutesList.findIndex((r) => r.id === activeRouteId);
  const activeRouteColor =
    activeRouteIndex >= 0
      ? ROUTE_COLORS[activeRouteIndex % ROUTE_COLORS.length]
      : ROUTE_COLORS[0];

  const selectedTotals = selectedRoutesList.reduce(
    (totals, route) => ({
      distance: totals.distance + route.distanceKm,
      elevation: totals.elevation + route.elevationGainM,
    }),
    { distance: 0, elevation: 0 }
  );

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-slate-100">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".gpx"
        className="hidden"
      />

      {/* SIDEBAR */}
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close route library"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-slate-950/25 md:hidden"
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-30 w-[min(88vw,24rem)] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full transition-transform duration-200 md:relative md:z-10 md:w-80 md:translate-x-0 lg:w-96 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <header className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">GPX Explorer</h1>
            <p className="text-xs text-gray-500">Search and display GPX routes</p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
              title="Measurement units settings"
              aria-label="Measurement units settings"
            >
              <Settings size={15} />
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingRoute(null);
                startDrawing();
                setRouteName(`My Route ${routes.length + 1}`);
                setIsSidebarOpen(false);
              }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer ${
                isDrawing
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 text-gray-700 hover:bg-slate-200'
              }`}
              title="Create new route on map"
            >
              <PenTool size={14} />
              <span>{isDrawing ? 'Drawing' : 'Draw'}</span>
            </button>

            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
              title="Upload GPX file to src/gpx"
            >
              <UploadCloud size={14} />
              <span>{isUploading ? '...' : 'Upload'}</span>
            </button>
          </div>
        </header>

        {appError && (
          <div role="alert" className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {appError}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Filters */}
          <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600 uppercase">
              <Filter size={14} />
              <span>Filters</span>
            </div>

            <input
              type="text"
              placeholder="Search route name..."
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                Region / Area
              </label>
              <select
                value={filters.region}
                onChange={(e) => setFilters({ ...filters, region: e.target.value })}
                className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="all">All Regions ({routes.length})</option>
                {availableRegions.map((region) => (
                  <option key={region} value={region}>
                    {region} ({routes.filter((r) => r.region === region).length})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                  Min {distanceUnit}
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={filters.minDistance}
                  onChange={(e) => setFilters({ ...filters, minDistance: e.target.value })}
                  className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                  Max {distanceUnit}
                </label>
                <input
                  type="number"
                  placeholder="Any"
                  value={filters.maxDistance}
                  onChange={(e) => setFilters({ ...filters, maxDistance: e.target.value })}
                  className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Route List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase text-gray-500 tracking-wider">
                Routes ({filteredRoutes.length})
              </span>
              <span className="text-[11px] text-gray-400">
                {selectedRouteIds.size} visible
              </span>
            </div>

            <div className="mb-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const newSet = new Set(filteredRoutes.map((route) => route.id));
                  setSelectedRouteIds(newSet);
                  if (filteredRoutes.length > 0 && !newSet.has(activeRouteId)) {
                    setActiveRouteId(filteredRoutes[0].id);
                  }
                }}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
              >
                Select visible
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedRouteIds(new Set());
                  setActiveRouteId(null);
                }}
                className="text-[11px] font-semibold text-gray-500 hover:text-gray-800"
              >
                Clear
              </button>
            </div>

            {selectedRoutesList.length > 0 && (
              <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                <div>
                  <span className="block text-[10px] font-bold uppercase text-blue-500">Selected distance</span>
                  <strong className="text-sm text-blue-950">{formatDistance(selectedTotals.distance, distanceUnit)}</strong>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase text-blue-500">Elevation gain</span>
                  <strong className="text-sm text-blue-950">{formatElevation(selectedTotals.elevation, elevationUnit, true, true)}</strong>
                </div>
              </div>
            )}

            {isLoadingRoutes && <p className="text-xs text-gray-500 py-4">Loading routes...</p>}
            {!isLoadingRoutes && filteredRoutes.length === 0 && (
              <p className="text-xs text-gray-500 py-4">No routes match the current filters.</p>
            )}
            <div className="space-y-1.5">
              {filteredRoutes.map((route) => {
                const isSelected = selectedRouteIds.has(route.id);
                const isActive = activeRouteId === route.id;
                const routeIndex = selectedRoutesList.findIndex((r) => r.id === route.id);
                const routeColor =
                  isSelected && routeIndex >= 0
                    ? ROUTE_COLORS[routeIndex % ROUTE_COLORS.length]
                    : null;

                return (
                  <div
                    key={route.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                      isActive
                        ? 'bg-blue-50/90 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
                        : isSelected
                        ? 'bg-blue-50/40 border-blue-200'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleRoute(route.id)}
                      className="flex items-center gap-2.5 flex-1 min-w-0 pr-2 text-left bg-transparent border-0 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="rounded text-blue-600 pointer-events-none"
                      />
                      {routeColor && (
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-white"
                          style={{ backgroundColor: routeColor }}
                          title="Track color on map"
                        />
                      )}
                      <div className="truncate">
                        <p className="text-xs font-semibold text-gray-800 truncate">{route.title}</p>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                          <span>{formatDistance(route.distanceKm, distanceUnit)} · {formatElevation(route.elevationGainM, elevationUnit, true, true)}</span>
                          <span>•</span>
                          <span className="text-blue-600 font-medium truncate flex items-center gap-0.5">
                            <MapPin size={10} />
                            {route.region}
                          </span>
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        title={`Delete ${route.title || route.fileName} from library`}
                        disabled={deletingRouteId === route.id}
                        onClick={(e) => handleDeleteRoute(route, e)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletingRouteId === route.id ? (
                          <Loader2 size={16} className="animate-spin text-red-500" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                      {isSelected && (
                        <button
                          type="button"
                          title={`Edit ${route.title || route.fileName} on map`}
                          onClick={(e) => handleStartEditingRoute(route, e)}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg border border-transparent transition cursor-pointer"
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      <button
                        type="button"
                        title="Download GPX"
                        onClick={(e) => handleExport(route, e)}
                        className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-slate-100 rounded-lg border border-transparent transition cursor-pointer"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      {/* MAP */}
      <main className="flex-1 relative h-full w-full overflow-hidden">
        <button
          type="button"
          aria-label="Open route library"
          onClick={() => setIsSidebarOpen(true)}
          className="absolute left-4 top-4 z-[1000] rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-lg md:hidden"
        >
          Routes
        </button>

        {/* Top-Right Map Controls: Layers & Settings */}
        <div className="absolute right-4 top-4 z-[1000] flex items-center gap-2 pointer-events-auto">
          <MapLayerSelector
            currentLayerId={mapLayer}
            onSelectLayer={handleMapLayerChange}
            hasOsApiKey={Boolean(osApiKey && osApiKey.trim())}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />

          <button
            type="button"
            aria-label="Measurement units settings"
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white/95 backdrop-blur-md px-3 py-2 text-xs font-semibold text-gray-700 shadow-lg hover:bg-slate-50 transition cursor-pointer"
            title="Change measurement units (km/mi, m/ft)"
          >
            <Settings size={14} className="text-blue-600" />
            <span className="hidden sm:inline font-bold uppercase text-[10px] tracking-wider text-slate-500">
              {distanceUnit} / {elevationUnit}
            </span>
          </button>
        </div>

        <RouteCreatorBar
          isDrawing={isDrawing}
          onCancel={handleCancelDrawing}
          routingMode={routingMode}
          setRoutingMode={setRoutingMode}
          routeName={routeName}
          setRouteName={setRouteName}
          draftPointsCount={userWaypoints.length}
          draftDistanceKm={draftDistanceKm}
          distanceUnit={distanceUnit}
          isEditing={Boolean(editingRoute)}
          canUndo={canUndo}
          onUndo={handleUndoPoint}
          onSave={() => setIsSaveModalOpen(true)}
          isRoutingLoading={isRoutingLoading}
          isSaving={isSavingRoute}
        />

        <RouteMap
          selectedRoutes={selectedRoutesList}
          activeRouteId={activeRouteId}
          onSelectRoute={(route) => setActiveRouteId(route.id)}
          isDrawing={isDrawing}
          editingRoute={editingRoute}
          userWaypoints={userWaypoints}
          routeLegs={routeLegs}
          draftCoordinates={draftTrackCoords}
          onMapClick={handleMapClick}
          onMoveWaypoint={handleMoveWaypoint}
          onInsertWaypoint={handleInsertWaypoint}
          onDeleteWaypoint={handleDeleteWaypoint}
          isRoutingLoading={isRoutingLoading}
          distanceUnit={distanceUnit}
          elevationUnit={elevationUnit}
          hoveredPoint={hoveredTrackPoint}
          onHoverPoint={setHoveredTrackPoint}
          currentLayerId={mapLayer}
          osApiKey={osApiKey}
        />

        {/* BOTTOM ROUTE DETAILS BAR */}
        {activeRoute && !isDrawing && (
          <div className="absolute bottom-3 inset-x-3 md:bottom-4 md:inset-x-6 z-[950] pointer-events-none flex justify-center">
            <div className="w-full max-w-5xl pointer-events-auto">
              <RouteDetailsBar
                route={activeRoute}
                routeColor={activeRouteColor}
                selectedRoutesCount={selectedRoutesList.length}
                activeRouteIndex={activeRouteIndex >= 0 ? activeRouteIndex : 0}
                distanceUnit={distanceUnit}
                elevationUnit={elevationUnit}
                hoveredPoint={hoveredTrackPoint}
                onHoverPoint={setHoveredTrackPoint}
                onFetchElevation={handleFetchElevation}
                isFetchingElevation={isFetchingElevation}
                onClose={() => setActiveRouteId(null)}
                onExport={handleExport}
                onEditRoute={handleStartEditingRoute}
              />
            </div>
          </div>
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        distanceUnit={distanceUnit}
        onDistanceUnitChange={handleDistanceUnitChange}
        elevationUnit={elevationUnit}
        onElevationUnitChange={handleElevationUnitChange}
        osApiKey={osApiKey}
        onOsApiKeyChange={handleOsApiKeyChange}
      />

      {/* Save Route Modal */}
      <SaveRouteModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        initialRouteName={routeName}
        originalFileName={editingRoute?.fileName || ''}
        isEditing={Boolean(editingRoute)}
        existingFileNames={routes.map((r) => r.fileName)}
        draftPointsCount={userWaypoints.length}
        draftDistanceKm={draftDistanceKm}
        distanceUnit={distanceUnit}
        onConfirmSave={handleConfirmSaveRoute}
        isSaving={isSavingRoute}
      />
    </div>
  );
}