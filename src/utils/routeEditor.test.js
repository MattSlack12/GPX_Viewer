import { describe, it, expect } from 'vitest';
import {
  extractRouteCoordinates,
  rdpWithIndices,
  getOptimalControlIndices,
  prepareRouteForEditing,
} from './routeEditor';

describe('routeEditor utility', () => {
  it('extracts coordinates from rawCoordinates', () => {
    const route = {
      rawCoordinates: [
        [-2.1, 54.1, 100],
        [-2.2, 54.2, 120],
      ],
    };
    const coords = extractRouteCoordinates(route);
    expect(coords).toEqual([
      [-2.1, 54.1],
      [-2.2, 54.2],
    ]);
  });

  it('extracts coordinates from geojson when rawCoordinates missing', () => {
    const route = {
      geojson: {
        features: [
          {
            geometry: {
              type: 'LineString',
              coordinates: [
                [-1.5, 53.5, 50],
                [-1.6, 53.6, 60],
              ],
            },
          },
        ],
      },
    };
    const coords = extractRouteCoordinates(route);
    expect(coords).toEqual([
      [-1.5, 53.5],
      [-1.6, 53.6],
    ]);
  });

  it('simplifies lines with rdpWithIndices', () => {
    const straight = [
      [0, 0],
      [1, 1],
      [2, 2],
    ];
    const indices = rdpWithIndices(straight, 0.01);
    expect(indices).toEqual([0, 2]);
  });

  it('selects optimal control indices for dense points', () => {
    const points = Array.from({ length: 60 }, (_, i) => [i * 0.01, i * 0.01]);
    const indices = getOptimalControlIndices(points, 5, 20);
    expect(indices.length).toBeLessThanOrEqual(20);
    expect(indices[0]).toBe(0);
    expect(indices[indices.length - 1]).toBe(59);
  });

  it('prepares short route (< 35 points) using 1:1 points as waypoints', () => {
    const points = [
      [-2.0, 54.0],
      [-2.1, 54.1],
      [-2.2, 54.2],
      [-2.3, 54.3],
    ];
    const route = {
      title: 'Short Trail',
      fileName: 'short_trail.gpx',
      rawCoordinates: points,
    };

    const prep = prepareRouteForEditing(route);
    expect(prep.userWaypoints.length).toBe(4);
    expect(prep.routeLegs.length).toBe(3);
    expect(prep.draftTrackCoords).toEqual(points);
    expect(prep.routeName).toBe('Short Trail');
    expect(prep.originalFileName).toBe('short_trail.gpx');
  });

  it('prepares long route (e.g. 500 points) extracting 15 to 35 control points without breaking track', () => {
    // Generate 500 points along a sine curve
    const points = [];
    for (let i = 0; i < 500; i++) {
      const lng = -2.5 + i * 0.001;
      const lat = 54.0 + Math.sin(i / 20) * 0.05;
      points.push([lng, lat]);
    }

    const route = {
      title: 'Long Mountain Ride',
      fileName: 'long_ride.gpx',
      rawCoordinates: points,
    };

    const prep = prepareRouteForEditing(route);
    expect(prep.userWaypoints.length).toBeGreaterThanOrEqual(15);
    expect(prep.userWaypoints.length).toBeLessThanOrEqual(40);
    expect(prep.routeLegs.length).toBe(prep.userWaypoints.length - 1);
    expect(prep.draftTrackCoords.length).toBe(500);

    // Verify first and last waypoint match start and end
    expect(prep.userWaypoints[0].lng).toBeCloseTo(points[0][0]);
    expect(prep.userWaypoints[0].lat).toBeCloseTo(points[0][1]);
    expect(prep.userWaypoints[prep.userWaypoints.length - 1].lng).toBeCloseTo(points[499][0]);
    expect(prep.userWaypoints[prep.userWaypoints.length - 1].lat).toBeCloseTo(points[499][1]);
  });

  it('provides points suitable for bounds fitting', () => {
    const route = {
      title: 'Peak Ride',
      fileName: 'peak.gpx',
      bounds: [[53.0, -2.0], [53.5, -1.5]],
      rawCoordinates: [[-2.0, 53.0], [-1.5, 53.5]],
    };
    const prep = prepareRouteForEditing(route);
    expect(route.bounds).toBeDefined();
    expect(route.bounds[0][0]).toBeLessThan(route.bounds[1][0]);
    expect(prep.draftTrackCoords.length).toBe(2);
  });
});
