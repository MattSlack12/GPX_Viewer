import { describe, it, expect } from 'vitest';
import {
  DISTANCE_UNITS,
  ELEVATION_UNITS,
  convertDistance,
  distanceToKm,
  formatDistance,
  convertElevation,
  formatElevation,
} from './units';

describe('units utility', () => {
  describe('distance conversions', () => {
    it('converts km to miles and back', () => {
      const km = 10;
      const miles = convertDistance(km, DISTANCE_UNITS.MILES);
      expect(miles).toBeCloseTo(6.2137, 2);

      const backToKm = distanceToKm(miles, DISTANCE_UNITS.MILES);
      expect(backToKm).toBeCloseTo(10, 2);
    });

    it('keeps km unchanged when unit is km', () => {
      expect(convertDistance(15.5, DISTANCE_UNITS.KM)).toBe(15.5);
      expect(distanceToKm(15.5, DISTANCE_UNITS.KM)).toBe(15.5);
    });

    it('formats distance correctly', () => {
      expect(formatDistance(10, DISTANCE_UNITS.KM)).toBe('10.0 km');
      expect(formatDistance(10, DISTANCE_UNITS.MILES)).toBe('6.2 mi');
      expect(formatDistance(10, DISTANCE_UNITS.MILES, 2, false)).toBe('6.21');
    });
  });

  describe('elevation conversions', () => {
    it('converts meters to feet and formats with defaults', () => {
      const meters = 100;
      const feet = convertElevation(meters, ELEVATION_UNITS.FEET);
      expect(Math.round(feet)).toBe(328);

      expect(formatElevation(100, ELEVATION_UNITS.FEET)).toBe('328 ft');
      expect(formatElevation(100, ELEVATION_UNITS.FEET, true, true)).toBe('+328 ft');
    });

    it('keeps meters unchanged when unit is meters', () => {
      expect(convertElevation(250, ELEVATION_UNITS.METERS)).toBe(250);
      expect(formatElevation(250, ELEVATION_UNITS.METERS, true, true)).toBe('+250 m');
      expect(formatElevation(250, ELEVATION_UNITS.METERS, false)).toBe('250');
    });
  });
});

