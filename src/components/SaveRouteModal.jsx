// src/components/SaveRouteModal.jsx
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, FileText, Loader2, AlertCircle } from 'lucide-react';
import { formatDistance, DISTANCE_UNITS } from '../utils/units';

function sanitizeToFileName(name) {
  const clean = (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_');
  return clean ? `${clean}.gpx` : 'my_route.gpx';
}

export default function SaveRouteModal(props) {
  if (!props.isOpen) return null;
  return createPortal(<SaveRouteModalContent {...props} />, document.body);
}

function SaveRouteModalContent({
  onClose,
  initialRouteName = '',
  originalFileName = '',
  isEditing = false,
  existingFileNames = [],
  draftPointsCount = 0,
  draftDistanceKm = 0,
  distanceUnit = DISTANCE_UNITS.KM,
  onConfirmSave,
  isSaving = false,
}) {
  const initial = (initialRouteName || '').trim() || 'My Route';
  const [routeName, setRouteName] = useState(initial);
  const [fileName, setFileName] = useState(() => (isEditing && originalFileName ? originalFileName : sanitizeToFileName(initial)));
  const [isFileNameCustomized, setIsFileNameCustomized] = useState(isEditing);
  const [overwrite, setOverwrite] = useState(isEditing);
  const [validationError, setValidationError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSaving) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onClose]);

  const handleRouteNameChange = (val) => {
    setRouteName(val);
    setValidationError('');
    if (!isFileNameCustomized) {
      setFileName(sanitizeToFileName(val));
    }
  };

  const handleFileNameChange = (val) => {
    setIsFileNameCustomized(true);
    setFileName(val);
    setValidationError('');
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const cleanTitle = routeName.trim();
    if (!cleanTitle) {
      setValidationError('Please enter a route name.');
      return;
    }

    let cleanFile = fileName.trim();
    if (!cleanFile) {
      cleanFile = sanitizeToFileName(cleanTitle);
    }
    if (!cleanFile.toLowerCase().endsWith('.gpx')) {
      cleanFile = `${cleanFile}.gpx`;
    }

    onConfirmSave({
      routeName: cleanTitle,
      fileName: cleanFile,
      overwrite: isEditing ? overwrite : false,
    });
  };

  const cleanFileCandidate = fileName.trim().toLowerCase();
  const normalizedFile = cleanFileCandidate.endsWith('.gpx') ? cleanFileCandidate : `${cleanFileCandidate}.gpx`;
  const isTargetingOriginal = isEditing && originalFileName && normalizedFile === originalFileName.toLowerCase();
  const isDuplicateOther = !isTargetingOriginal && existingFileNames.some((f) => f.toLowerCase() === normalizedFile);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-route-dialog-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={() => !isSaving && onClose()}
      />

      {/* Dialog Box */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-5 sm:p-6 z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Save size={18} />
            </div>
            <div>
              <h2 id="save-route-dialog-title" className="text-base font-bold text-slate-900">
                {isEditing ? 'Save Changes to Route' : 'Save New Route'}
              </h2>
              <p className="text-xs text-slate-500">
                {isEditing
                  ? 'Update this GPX route or save changes as a new file'
                  : 'Name your route and customize the file name before saving'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer disabled:opacity-40"
            aria-label="Close save dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="py-4 space-y-4">
          {/* Route Summary Badge */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600">
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Estimated Distance</span>
              <strong className="text-slate-800 text-sm">{formatDistance(draftDistanceKm, distanceUnit)}</strong>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Control Points</span>
              <strong className="text-slate-800 text-sm">{draftPointsCount} waypoints</strong>
            </div>
          </div>

          {/* Route Name Input */}
          <div>
            <label htmlFor="modal-route-name" className="block text-xs font-bold text-slate-700 mb-1">
              Route Name (Display Title)
            </label>
            <div className="relative">
              <input
                id="modal-route-name"
                ref={inputRef}
                type="text"
                value={routeName}
                onChange={(e) => handleRouteNameChange(e.target.value)}
                placeholder="e.g. Helvellyn Ridge Walk"
                disabled={isSaving}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 text-slate-800 font-medium"
              />
            </div>
          </div>

          {/* File Name Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="modal-file-name" className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <FileText size={13} className="text-slate-400" />
                <span>GPX File Name</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Saved to src/gpx/</span>
            </div>
            <div className="relative">
              <input
                id="modal-file-name"
                type="text"
                value={fileName}
                onChange={(e) => handleFileNameChange(e.target.value)}
                placeholder="e.g. helvellyn_ridge_walk.gpx"
                disabled={isSaving}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 text-slate-800"
              />
            </div>
            {isDuplicateOther && (
              <p className="mt-1 text-[11px] text-amber-600 flex items-center gap-1 font-medium">
                <AlertCircle size={12} />
                <span>A file with this name already exists and will be overwritten or given a unique suffix.</span>
              </p>
            )}

            {isEditing && (
              <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={overwrite}
                    onChange={(e) => setOverwrite(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Overwrite original file ({originalFileName || fileName})</span>
                </label>
                <p className="text-[11px] text-slate-500 ml-5 mt-0.5">
                  {overwrite
                    ? 'Directly updates the existing GPX file on disk in src/gpx/'
                    : 'Saves as a separate new file in src/gpx/ without touching the original'}
                </p>
              </div>
            )}
          </div>

          {validationError && (
            <div role="alert" className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600">
              {validationError}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving || !routeName.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50 transition cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Enriching & Saving...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>{isEditing ? 'Save Changes' : 'Save Route'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

