// src/utils/routeEditor.js

export function extractRouteCoordinates(route) {
  if (!route) return [];

  if (Array.isArray(route.rawCoordinates) && route.rawCoordinates.length > 0) {
    return route.rawCoordinates.map((c) => [c[0], c[1]]);
  }

  if (route.geojson?.features) {
    const coords = [];
    for (const feature of route.geojson.features) {
      if (feature.geometry?.type === 'LineString') {
        coords.push(...feature.geometry.coordinates);
      } else if (feature.geometry?.type === 'MultiLineString') {
        coords.push(...feature.geometry.coordinates.flat());
      }
    }
    if (coords.length > 0) {
      return coords.map((c) => [c[0], c[1]]);
    }
  }

  return [];
}

export function rdpWithIndices(points, epsilon) {
  if (points.length <= 2) {
    return points.map((_, i) => i);
  }

  function findMaxDist(startIndex, endIndex) {
    let maxDist = 0;
    let maxIndex = startIndex;
    const p1 = points[startIndex];
    const p2 = points[endIndex];
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const lenSq = dx * dx + dy * dy;

    for (let i = startIndex + 1; i < endIndex; i++) {
      const p = points[i];
      let dist;
      if (lenSq === 0) {
        dist = Math.hypot(p[0] - p1[0], p[1] - p1[1]);
      } else {
        const t = Math.max(0, Math.min(1, ((p[0] - p1[0]) * dx + (p[1] - p1[1]) * dy) / lenSq));
        const projX = p1[0] + t * dx;
        const projY = p1[1] + t * dy;
        dist = Math.hypot(p[0] - projX, p[1] - projY);
      }

      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }
    return { maxDist, maxIndex };
  }

  function simplify(startIndex, endIndex) {
    const { maxDist, maxIndex } = findMaxDist(startIndex, endIndex);
    if (maxDist > epsilon) {
      const left = simplify(startIndex, maxIndex);
      const right = simplify(maxIndex, endIndex);
      return left.slice(0, -1).concat(right);
    } else {
      return [startIndex, endIndex];
    }
  }

  return simplify(0, points.length - 1);
}

export function getOptimalControlIndices(points, targetMin = 15, targetMax = 35) {
  if (points.length <= targetMax) {
    return points.map((_, i) => i);
  }

  // Calculate coordinate bounding box span
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of points) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  const span = Math.hypot(maxLng - minLng, maxLat - minLat) || 0.01;

  let lowEps = span / 1000;
  let highEps = span / 8;
  let bestIndices = points.map((_, i) => i);

  for (let iter = 0; iter < 7; iter++) {
    const midEps = (lowEps + highEps) / 2;
    const indices = rdpWithIndices(points, midEps);
    bestIndices = indices;

    if (indices.length > targetMax) {
      lowEps = midEps;
    } else if (indices.length < targetMin) {
      highEps = midEps;
    } else {
      break;
    }
  }

  // Ensure first and last are always included
  if (bestIndices[0] !== 0) bestIndices.unshift(0);
  if (bestIndices[bestIndices.length - 1] !== points.length - 1) {
    bestIndices.push(points.length - 1);
  }

  return bestIndices;
}

export function prepareRouteForEditing(route) {
  const coords = extractRouteCoordinates(route);
  if (coords.length === 0) {
    return {
      userWaypoints: [],
      routeLegs: [],
      draftTrackCoords: [],
      routeName: route?.title || 'Edited Route',
      originalFileName: route?.fileName || '',
    };
  }

  if (coords.length === 1) {
    return {
      userWaypoints: [{ lat: coords[0][1], lng: coords[0][0] }],
      routeLegs: [],
      draftTrackCoords: coords,
      routeName: route?.title || 'Edited Route',
      originalFileName: route?.fileName || '',
    };
  }

  const indices = getOptimalControlIndices(coords, 15, 35);
  const userWaypoints = indices.map((idx) => ({
    lat: coords[idx][1],
    lng: coords[idx][0],
  }));

  const routeLegs = [];
  for (let k = 0; k < indices.length - 1; k++) {
    const fromIdx = indices[k];
    const toIdx = indices[k + 1];
    routeLegs.push(coords.slice(fromIdx, toIdx + 1));
  }

  return {
    userWaypoints,
    routeLegs,
    draftTrackCoords: coords,
    routeName: route.title || route.fileName?.replace(/\.gpx$/i, '') || 'Edited Route',
    originalFileName: route.fileName || '',
  };
}

