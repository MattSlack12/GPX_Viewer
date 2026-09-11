// src/utils/mapLayers.js

export const MAP_LAYERS = {
  osm: {
    id: 'osm',
    name: 'Standard',
    shortName: 'OSM',
    description: 'OpenStreetMap standard map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    requiresKey: false,
  },
  satellite: {
    id: 'satellite',
    name: 'Satellite',
    shortName: 'Satellite',
    description: 'High-resolution aerial satellite imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
    requiresKey: false,
  },
  cyclosm: {
    id: 'cyclosm',
    name: 'Open Cycling',
    shortName: 'Cycling',
    description: 'Bicycle infrastructure, trails, contours & paths',
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.cyclosm.org">CyclOSM</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 20,
    requiresKey: false,
  },
  opentopo: {
    id: 'opentopo',
    name: 'UK Topo & Contours',
    shortName: 'Topo',
    description: 'Topographic contour lines, relief & hiking trails',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
    requiresKey: false,
  },
  ordnance_survey: {
    id: 'ordnance_survey',
    name: 'UK Ordnance Survey',
    shortName: 'OS Map',
    description: 'Official UK Ordnance Survey Outdoor / Leisure maps',
    getUrl: (key) => `https://api.os.uk/maps/raster/v1/zxy/Outdoor_3857/{z}/{x}/{y}.png?key=${key}`,
    attribution: 'Contains OS data &copy; Crown copyright and database right ' + new Date().getFullYear(),
    maxZoom: 20,
    requiresKey: true,
  },
};

export const DEFAULT_MAP_LAYER = 'osm';

export function getActiveLayerConfig(layerId, osApiKey = '') {
  const layer = MAP_LAYERS[layerId] || MAP_LAYERS[DEFAULT_MAP_LAYER];
  if (layer.requiresKey) {
    const key = (osApiKey || '').trim();
    if (key) {
      return {
        ...layer,
        url: layer.getUrl(key),
        isFallback: false,
      };
    }
    // If no key is configured, fallback smoothly to Topo with a flag
    const fallback = MAP_LAYERS.opentopo;
    return {
      ...fallback,
      id: layer.id,
      name: `${layer.name} (Requires Key - showing Topo)`,
      isFallback: true,
    };
  }

  return {
    ...layer,
    isFallback: false,
  };
}

