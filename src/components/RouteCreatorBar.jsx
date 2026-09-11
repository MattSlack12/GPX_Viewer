// src/components/RouteCreatorBar.jsx
import { Footprints, Bike, ArrowUpRight, Undo2, X, Check, Loader2 } from 'lucide-react';
import { formatDistance, DISTANCE_UNITS } from '../utils/units';

export default function RouteCreatorBar({
  isDrawing,
  onCancel,
  routingMode,
  setRoutingMode,
  routeName,
  setRouteName,
  draftPointsCount,
  draftDistanceKm = 0,
  distanceUnit = DISTANCE_UNITS.KM,
  isEditing = false,
  canUndo,
  onUndo,
  onSave,
  isRoutingLoading,
  isSaving,
}) {
  if (!isDrawing) return null;

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] flex flex-col items-center gap-1.5 pointer-events-auto">
      <div className="bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-xl border border-gray-200 flex items-center gap-3 select-none">
        {/* Mode Selector */}
        <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setRoutingMode('foot')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
              routingMode === 'foot' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-500 hover:text-gray-800'
            }`}
            title="Snap to footpaths, mountain trails, bridleways, tracks & roads"
          >
            <Footprints size={14} />
            <span>Footpaths & Roads</span>
          </button>

          <button
            type="button"
            onClick={() => setRoutingMode('bike')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
              routingMode === 'bike' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-500 hover:text-gray-800'
            }`}
            title="Snap to cycleways, bridleways, tracks & roads"
          >
            <Bike size={14} />
            <span>Cycle & Roads</span>
          </button>

          <button
            type="button"
            onClick={() => setRoutingMode('straight')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
              routingMode === 'straight' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-500 hover:text-gray-800'
            }`}
            title="Direct straight line (off-trail)"
          >
            <ArrowUpRight size={14} />
            <span>Straight</span>
          </button>
        </div>

        <div className="h-6 w-px bg-gray-200" />

        <div className="flex items-center gap-1.5">
          {isEditing && (
            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px] uppercase tracking-wide">
              Editing
            </span>
          )}
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
        </div>

        <div className="h-6 w-px bg-gray-200" />

        {/* Info Status & Running Distance */}
        <div className="text-xs text-gray-600 min-w-36 flex items-center gap-2">
          {isRoutingLoading ? (
            <>
              <Loader2 size={13} className="animate-spin text-blue-600" />
              <span className="text-blue-600 font-medium">Snapping...</span>
            </>
          ) : draftPointsCount === 0 ? (
            <span className="text-gray-400">Click map to start</span>
          ) : (
            <div className="flex items-center gap-1.5 font-medium">
              <span className="text-gray-700">
                {draftPointsCount} {draftPointsCount === 1 ? 'point' : 'points'}
              </span>
              <span className="text-gray-300">•</span>
              <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md">
                {formatDistance(draftDistanceKm, distanceUnit)}
              </span>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-gray-200" />

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={(!canUndo && draftPointsCount === 0) || isRoutingLoading}
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-slate-100 rounded-lg disabled:opacity-40 transition cursor-pointer"
            title="Undo last action (drag, point, delete)"
          >
            <Undo2 size={16} />
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1 px-2.5 py-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold transition cursor-pointer"
            title={isEditing ? 'Cancel editing route' : 'Cancel drawing route'}
          >
            <X size={14} />
            <span>{isEditing ? 'Cancel Edit' : 'Cancel'}</span>
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={draftPointsCount < 2 || isSaving || isRoutingLoading}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition cursor-pointer"
          >
            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
            <span>{isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Route'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Drag Hint */}
      {draftPointsCount >= 2 && (
        <div className="bg-slate-900/80 text-white text-[10px] font-medium px-3 py-1 rounded-full shadow-md backdrop-blur-xs flex items-center gap-2 animate-fade-in">
          <span>Tip: Drag points to move</span>
          <span className="text-slate-400">•</span>
          <span>Drag mid-dots to add</span>
          <span className="text-slate-400">•</span>
          <span>Right-click to remove</span>
        </div>
      )}
    </div>
  );
}