// src/components/SettingsModal.jsx
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Settings, RotateCcw, Check } from 'lucide-react';
import { DISTANCE_UNITS, ELEVATION_UNITS } from '../utils/units';

export default function SettingsModal({
  isOpen,
  onClose,
  distanceUnit,
  onDistanceUnitChange,
  elevationUnit,
  onElevationUnitChange,
  osApiKey = '',
  onOsApiKeyChange,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleResetDefaults = () => {
    onDistanceUnitChange(DISTANCE_UNITS.KM);
    onElevationUnitChange(ELEVATION_UNITS.FEET);
  };

  const isDefault =
    distanceUnit === DISTANCE_UNITS.KM && elevationUnit === ELEVATION_UNITS.FEET;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Dialog Box */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-5 sm:p-6 z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Settings size={18} />
            </div>
            <div>
              <h2 id="settings-dialog-title" className="text-base font-bold text-slate-900">
                Measurement Settings
              </h2>
              <p className="text-xs text-slate-500">
                Choose metric or imperial units independently
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-5">
          {/* Distance Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Distance
              </label>
              <span className="text-[11px] text-slate-400">
                Default: <b>Kilometers (km)</b>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => onDistanceUnitChange(DISTANCE_UNITS.KM)}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                  distanceUnit === DISTANCE_UNITS.KM
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {distanceUnit === DISTANCE_UNITS.KM && <Check size={14} />}
                <span>Kilometers (km)</span>
              </button>

              <button
                type="button"
                onClick={() => onDistanceUnitChange(DISTANCE_UNITS.MILES)}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                  distanceUnit === DISTANCE_UNITS.MILES
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {distanceUnit === DISTANCE_UNITS.MILES && <Check size={14} />}
                <span>Miles (mi)</span>
              </button>
            </div>
          </div>

          {/* Elevation / Height Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Elevation / Height
              </label>
              <span className="text-[11px] text-slate-400">
                Default: <b>Feet (ft)</b>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => onElevationUnitChange(ELEVATION_UNITS.FEET)}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                  elevationUnit === ELEVATION_UNITS.FEET
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {elevationUnit === ELEVATION_UNITS.FEET && <Check size={14} />}
                <span>Feet (ft)</span>
              </button>

              <button
                type="button"
                onClick={() => onElevationUnitChange(ELEVATION_UNITS.METERS)}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                  elevationUnit === ELEVATION_UNITS.METERS
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {elevationUnit === ELEVATION_UNITS.METERS && <Check size={14} />}
                <span>Meters (m)</span>
              </button>
            </div>
          </div>

          {/* UK Ordnance Survey API Key Section */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="os-api-key-input" className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span>UK Ordnance Survey API Key</span>
                <span className="text-[10px] font-normal text-slate-400 lowercase">(optional)</span>
              </label>
              <a
                href="https://osdatahub.os.uk/"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-medium text-blue-600 hover:underline"
              >
                Get free key &rarr;
              </a>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              Required to access official UK OS Leisure & Outdoor map tiles. Free accounts include up to &pound;1,000 monthly usage credit on the OS Data Hub.
            </p>
            <div className="flex items-center gap-2">
              <input
                id="os-api-key-input"
                type="text"
                value={osApiKey || ''}
                onChange={(e) => onOsApiKeyChange?.(e.target.value.trim())}
                placeholder="Paste your OS project API key..."
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 font-mono"
              />
              {osApiKey && (
                <button
                  type="button"
                  onClick={() => onOsApiKeyChange?.('')}
                  className="px-2 py-2 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Clear key"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Current Summary */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 flex items-center justify-between">
            <span>
              Distance in <b>{distanceUnit === DISTANCE_UNITS.KM ? 'Kilometers' : 'Miles'}</b>, Height in <b>{elevationUnit === ELEVATION_UNITS.FEET ? 'Feet' : 'Meters'}</b>.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <button
            type="button"
            disabled={isDefault}
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            title="Reset to km for distance and feet for elevation"
          >
            <RotateCcw size={13} />
            <span>Reset to defaults</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

