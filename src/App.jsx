// src/App.jsx
import { useState, useEffect, useRef } from 'react';
import {
  parseGpxFile,
  enrichCoordinatesWithElevation,
  buildGpxXml,
} from './utils/gpxParser';
import RouteMap from './components/RouteMap';
import RouteDetailsDrawer from './components/RouteDetailsDrawer';
import RouteCreatorBar from './components/RouteCreatorBar';
import { apiRequest } from './utils/api';
import useRouteDrawing from './hooks/useRouteDrawing';
import useRouteFilters from './hooks/useRouteFilters';
import { Info, Download, Filter, MapPin, UploadCloud, PenTool } from 'lucide-react';

export default function App() {
  const [routes, setRoutes] = useState([]);
  // Initializes empty so no routes are checked on load
  const [selectedRouteIds, setSelectedRouteIds] = useState(new Set());
  const [activeDrawerRoute, setActiveDrawerRoute] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true);
  const [appError, setAppError] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [routeName, setRouteName] = useState('');
  const fileInputRef = useRef(null);

  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const {
    isDrawing,
    startDrawing,
    cancelDrawing,
    routingMode,
    setRoutingMode,
    userWaypoints,
    draftTrackCoords,
    isRoutingLoading,
    handleMapClick,
    handleUndoPoint,
  } = useRouteDrawing();
  const { filters, setFilters, availableRegions, filteredRoutes } = useRouteFilters(routes);

  const handleCancelDrawing = () => {
    cancelDrawing();
    setRouteName('');
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

  const handleSaveDrawnRoute = async () => {
    if (draftTrackCoords.length < 2) return;

    const trimmedRouteName = routeName.trim();
    if (!trimmedRouteName) {
      setAppError('Enter a route name before saving.');
      return;
    }

    setIsSavingRoute(true);
    setAppError('');

    try {
      const coordsWithElevation = await enrichCoordinatesWithElevation(draftTrackCoords);
      const gpxXml = buildGpxXml(trimmedRouteName, coordsWithElevation);
      const filename = `${trimmedRouteName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.gpx`;

      const result = await apiRequest('/api/save-gpx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ filename, gpxXml }),
      });

      const parsed = parseGpxFile(result.filename, gpxXml);
      setRoutes((prev) => [parsed, ...prev.filter((route) => route.id !== parsed.id)]);
      setSelectedRouteIds(new Set([parsed.id]));
      setActiveDrawerRoute(parsed);

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
      setActiveDrawerRoute(parsed);
    } catch (err) {
      console.error(err);
      setAppError(`Could not upload file: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleToggleRoute = (id) => {
    const updated = new Set(selectedRouteIds);
    if (updated.has(id)) updated.delete(id);
    else updated.add(id);
    setSelectedRouteIds(updated);
  };

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

  const selectedRoutesList = routes.filter((r) => selectedRouteIds.has(r.id));
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
              onClick={() => {
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
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Min km</label>
                <input
                  type="number"
                  placeholder="0"
                  value={filters.minDistance}
                  onChange={(e) => setFilters({ ...filters, minDistance: e.target.value })}
                  className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Max km</label>
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
                onClick={() => setSelectedRouteIds(new Set(filteredRoutes.map((route) => route.id)))}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
              >
                Select visible
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={() => setSelectedRouteIds(new Set())}
                className="text-[11px] font-semibold text-gray-500 hover:text-gray-800"
              >
                Clear
              </button>
            </div>

            {selectedRoutesList.length > 0 && (
              <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                <div>
                  <span className="block text-[10px] font-bold uppercase text-blue-500">Selected distance</span>
                  <strong className="text-sm text-blue-950">{selectedTotals.distance.toFixed(1)} km</strong>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase text-blue-500">Elevation gain</span>
                  <strong className="text-sm text-blue-950">+{Math.round(selectedTotals.elevation)} m</strong>
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
                return (
                  <div
                    key={route.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-200'
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
                      <div className="truncate">
                        <p className="text-xs font-semibold text-gray-800 truncate">{route.title}</p>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                          <span>{route.distanceKm} km · +{route.elevationGainM}m</span>
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
                        title="Route details"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRouteName(`My Route ${routes.length + 1}`);
                          setActiveDrawerRoute(route);
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg border border-transparent transition cursor-pointer"
                      >
                        <Info size={16} />
                      </button>
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
        <RouteCreatorBar
          isDrawing={isDrawing}
          onCancel={handleCancelDrawing}
          routingMode={routingMode}
          setRoutingMode={setRoutingMode}
          routeName={routeName}
          setRouteName={setRouteName}
          draftPointsCount={userWaypoints.length}
          onUndo={handleUndoPoint}
          onSave={handleSaveDrawnRoute}
          isRoutingLoading={isRoutingLoading}
          isSaving={isSavingRoute}
        />

        <RouteMap
          selectedRoutes={selectedRoutesList}
          isDrawing={isDrawing}
          draftCoordinates={draftTrackCoords}
          onMapClick={handleMapClick}
        />
      </main>

      {/* FLYOUT */}
      <RouteDetailsDrawer
        route={activeDrawerRoute}
        isOpen={Boolean(activeDrawerRoute)}
        onClose={() => setActiveDrawerRoute(null)}
        onExport={handleExport}
      />
    </div>
  );
}