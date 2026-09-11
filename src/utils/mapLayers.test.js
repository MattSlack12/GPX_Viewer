import { describe, it, expect } from 'vitest';
import { MAP_LAYERS, getActiveLayerConfig, DEFAULT_MAP_LAYER } from './mapLayers';

describe('mapLayers utility', () => {
  it('defines standard layers correctly', () => {
    expect(MAP_LAYERS.osm).toBeDefined();
    expect(MAP_LAYERS.satellite).toBeDefined();
    expect(MAP_LAYERS.cyclosm).toBeDefined();
    expect(MAP_LAYERS.opentopo).toBeDefined();
    expect(MAP_LAYERS.ordnance_survey).toBeDefined();

    expect(MAP_LAYERS.osm.url).toContain('openstreetmap.org');
    expect(MAP_LAYERS.satellite.url).toContain('arcgisonline.com');
    expect(MAP_LAYERS.cyclosm.url).toContain('cyclosm');
    expect(MAP_LAYERS.opentopo.url).toContain('opentopomap.org');
  });

  it('returns default layer when invalid ID provided', () => {
    const config = getActiveLayerConfig('unknown_layer');
    expect(config.id).toBe(DEFAULT_MAP_LAYER);
    expect(config.isFallback).toBe(false);
  });

  it('resolves Ordnance Survey with valid API key', () => {
    const config = getActiveLayerConfig('ordnance_survey', 'test-os-key-123');
    expect(config.url).toContain('https://api.os.uk/maps/raster/v1/zxy/Outdoor_3857/');
    expect(config.url).toContain('key=test-os-key-123');
    expect(config.isFallback).toBe(false);
  });

  it('falls back to OpenTopoMap when Ordnance Survey has no key', () => {
    const config = getActiveLayerConfig('ordnance_survey', '');
    expect(config.url).toContain('opentopomap.org');
    expect(config.isFallback).toBe(true);
  });
});

