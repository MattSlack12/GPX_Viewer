// src/components/MapLayerSelector.jsx
import { useState, useRef, useEffect } from 'react';
import {
  Layers,
  Map as MapIcon,
  Globe,
  Bike,
  Mountain,
  Compass,
  Check,
  Key,
} from 'lucide-react';
import { MAP_LAYERS } from '../utils/mapLayers';

const LAYER_ICONS = {
  osm: MapIcon,
  satellite: Globe,
  cyclosm: Bike,
  opentopo: Mountain,
  ordnance_survey: Compass,
};

export default function MapLayerSelector({
  currentLayerId,
  onSelectLayer,
  hasOsApiKey = false,
  onOpenSettings,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const activeLayer = MAP_LAYERS[currentLayerId] || MAP_LAYERS.osm;
  const ActiveIcon = LAYER_ICONS[currentLayerId] || Layers;

  return (
    <div ref={containerRef} className="relative z-[1000] pointer-events-auto">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white/95 backdrop-blur-md px-3 py-2 text-xs font-semibold shadow-lg transition cursor-pointer ${
          isOpen ? 'bg-blue-50 border-blue-300 text-blue-600' : 'text-gray-700 hover:bg-slate-50'
        }`}
        title="Choose map layer (Satellite, Cycling, UK OS, Topo, Standard)"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <ActiveIcon size={14} className="text-blue-600" />
        <span className="font-bold text-xs">{activeLayer.shortName || activeLayer.name}</span>
        <Layers size={13} className="text-gray-400 ml-0.5" />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Map Layers
            </span>
            <span className="text-[10px] text-slate-400">Click to switch</span>
          </div>

          <div className="py-1 space-y-1">
            {Object.values(MAP_LAYERS).map((layer) => {
              const Icon = LAYER_ICONS[layer.id] || Layers;
              const isSelected = currentLayerId === layer.id;

              return (
                <div
                  key={layer.id}
                  className={`group rounded-xl p-2 transition cursor-pointer flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-blue-50/90 text-blue-900 ring-1 ring-blue-500/30'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                  onClick={() => {
                    onSelectLayer(layer.id);
                    setIsOpen(false);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onSelectLayer(layer.id);
                      setIsOpen(false);
                    }
                  }}
                >
                  <div
                    className={`p-2 rounded-lg flex-shrink-0 mt-0.5 ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                    }`}
                  >
                    <Icon size={16} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold truncate">{layer.name}</span>
                      {isSelected && <Check size={14} className="text-blue-600 flex-shrink-0 ml-1" />}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                      {layer.description}
                    </p>

                    {/* Ordnance Survey key info badge */}
                    {layer.requiresKey && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {hasOsApiKey ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            <Check size={10} />
                            Key active
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsOpen(false);
                              if (onOpenSettings) onOpenSettings();
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded transition cursor-pointer"
                            title="Add your free OS Data Hub key in Settings"
                          >
                            <Key size={10} />
                            <span>Add free OS API key</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

