// src/components/RouteCreatorBar.jsx
import { Footprints, Bike, ArrowUpRight, Undo2, X, Check, Loader2 } from 'lucide-react';

export default function RouteCreatorBar({
  isDrawing,
  onCancel,
  routingMode,
  setRoutingMode,
  routeName,
  setRouteName,
  draftPointsCount,
  onUndo,
  onSave,
  isRoutingLoading,
  isSaving,
}) {
  if (!isDrawing) return null;

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-xl border border-gray-200 flex items-center gap-3 select-none">
      {/* Mode Selector */}
      <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
        <button
          type="button"
          onClick={() => setRoutingMode('foot')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
            routingMode === 'foot' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-500 hover:text-gray-800'
          }`}
          title="Snap to Footpaths / Hiking Trails"
        >
          <Footprints size={14} />
          <span>Hike / Foot</span>
        </button>

        <button
          type="button"
          onClick={() => setRoutingMode('bike')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
            routingMode === 'bike' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-500 hover:text-gray-800'
          }`}
          title="Snap to Cycle Paths & Roads"
        >
          <Bike size={14} />
          <span>Cycle</span>
        </button>

        <button
          type="button"
          onClick={() => setRoutingMode('straight')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
            routingMode === 'straight' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-500 hover:text-gray-800'
          }`}
          title="Direct Straight Lines (Off-Trail)"
        >
          <ArrowUpRight size={14} />
          <span>Straight</span>
        </button>
      </div>

      <div className="h-6 w-px bg-gray-200" />

      <label className="flex items-center gap-1.5 text-xs text-gray-500">
        <span className="sr-only">Route name</span>
        <input
          type="text"
          value={routeName}
          onChange={(event) => setRouteName(event.target.value)}
          placeholder="Route name"
          className="w-32 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </label>

      <div className="h-6 w-px bg-gray-200" />

      {/* Info Status */}
      <div className="text-xs text-gray-600 min-w-28 flex items-center gap-1.5">
        {isRoutingLoading ? (
          <>
            <Loader2 size={13} className="animate-spin text-blue-600" />
            <span className="text-blue-600 font-medium">Snapping...</span>
          </>
        ) : (
          <span>
            {draftPointsCount === 0
              ? 'Click map to start'
              : `${draftPointsCount} point${draftPointsCount > 1 ? 's' : ''}`}
          </span>
        )}
      </div>

      <div className="h-6 w-px bg-gray-200" />

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onUndo}
          disabled={draftPointsCount === 0 || isRoutingLoading}
          className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-slate-100 rounded-lg disabled:opacity-40 transition cursor-pointer"
          title="Undo last click"
        >
          <Undo2 size={16} />
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 px-2.5 py-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold transition cursor-pointer"
        >
          <X size={14} />
          <span>Cancel</span>
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={draftPointsCount < 2 || isSaving || isRoutingLoading}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition cursor-pointer"
        >
          {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
          <span>{isSaving ? 'Saving...' : 'Save Route'}</span>
        </button>
      </div>
    </div>
  );
}