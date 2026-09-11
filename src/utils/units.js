// src/utils/units.js

export const DISTANCE_UNITS = {
  KM: 'km',
  MILES: 'mi',
};

export const ELEVATION_UNITS = {
  METERS: 'm',
  FEET: 'ft',
};

// 1 km = 0.621371192 miles
const KM_TO_MILES = 0.621371192;
// 1 meter = 3.2808399 feet
const M_TO_FEET = 3.2808399;

/**
 * Convert km to target distance unit
 */
export function convertDistance(km, unit = DISTANCE_UNITS.KM) {
  if (km == null || Number.isNaN(km)) return 0;
  return unit === DISTANCE_UNITS.MILES ? km * KM_TO_MILES : km;
}

/**
 * Convert distance from specified unit back to km (useful for filters)
 */
export function distanceToKm(dist, unit = DISTANCE_UNITS.KM) {
  if (dist == null || Number.isNaN(dist)) return 0;
  return unit === DISTANCE_UNITS.MILES ? dist / KM_TO_MILES : dist;
}

/**
 * Format distance with unit label
 */
export function formatDistance(km, unit = DISTANCE_UNITS.KM, decimals = 1, includeUnit = true) {
  const converted = convertDistance(km, unit);
  const formatted = converted.toFixed(decimals);
  return includeUnit ? `${formatted} ${unit}` : formatted;
}

/**
 * Convert meters to target elevation unit
 */
export function convertElevation(m, unit = ELEVATION_UNITS.FEET) {
  if (m == null || Number.isNaN(m)) return 0;
  return unit === ELEVATION_UNITS.FEET ? m * M_TO_FEET : m;
}

/**
 * Format elevation with unit label and optional '+' prefix for gain
 */
export function formatElevation(m, unit = ELEVATION_UNITS.FEET, includeUnit = true, showPlus = false) {
  const converted = Math.round(convertElevation(m, unit));
  const prefix = showPlus && converted > 0 ? '+' : '';
  const unitLabel = unit === ELEVATION_UNITS.FEET ? 'ft' : 'm';
  return includeUnit ? `${prefix}${converted} ${unitLabel}` : `${prefix}${converted}`;
}

