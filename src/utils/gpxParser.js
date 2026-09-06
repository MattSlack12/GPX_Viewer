// src/utils/gpxParser.js
import { gpx } from '@tmcw/togeojson';

function calculateDistance(coord1, coord2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371; // km

  const dLat = toRad(coord2[1] - coord1[1]);
  const dLon = toRad(coord2[0] - coord1[0]);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1[1])) *
      Math.cos(toRad(coord2[1])) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getOfflineRegion(lat, lng) {
  if (!lat && !lng) return 'General';
  if (lat >= 54.3 && lat <= 54.8 && lng >= -3.5 && lng <= -2.6) return 'Lake District';
  if (lat >= 53.0 && lat <= 53.5 && lng >= -2.1 && lng <= -1.4) return 'Peak District';
  if (lat >= 54.1 && lat <= 54.5 && lng >= -2.4 && lng <= -1.6) return 'Yorkshire Dales';
  if (lat >= 56.5 && lat <= 58.7 && lng >= -6.0 && lng <= -3.0) return 'Scottish Highlands';
  if (lat >= 52.8 && lat <= 53.3 && lng >= -4.2 && lng <= -3.6) return 'Snowdonia (Eryri)';
  if (lat >= 51.7 && lat <= 52.1 && lng >= -3.8 && lng <= -3.1) return 'Brecon Beacons';
  if (lat >= 50.4 && lat <= 50.8 && lng >= -4.1 && lng <= -3.6) return 'Dartmoor';
  if (lat >= 51.0 && lat <= 51.4 && lng >= -3.9 && lng <= -3.4) return 'Exmoor';
  if (lat >= 51.3 && lat <= 51.7 && lng >= -0.5 && lng <= 0.3) return 'Greater London';
  if (lat >= 50.7 && lat <= 51.2 && lng >= -1.0 && lng <= 0.8) return 'South East';
  if (lat >= 50.1 && lat <= 51.5 && lng >= -5.7 && lng <= -2.0) return 'South West';
  if (lat >= 52.0 && lat <= 53.2 && lng >= -2.4 && lng <= 0.5) return 'Midlands';
  if (lat >= 53.3 && lat <= 55.8 && lng >= -3.6 && lng <= -0.5) return 'Northern England';
  if (lat >= 51.3 && lat <= 53.5 && lng >= -5.4 && lng <= -2.6) return 'Wales';
  if (lat >= 54.6 && lat <= 59.0 && lng >= -7.6 && lng <= -1.7) return 'Scotland';
  if (lat > 0 && lng < 0) return 'North-West Quadrant';
  if (lat > 0 && lng >= 0) return 'North-East Quadrant';
  return 'General Region';
}

// ----------------------------------------------------------------------
// Path B: Routing & Trail Snapping (OSRM)
// ----------------------------------------------------------------------

export async function fetchSnappedRouteLeg(fromCoord, toCoord, mode = 'foot') {
  // mode: 'foot' | 'bike' | 'straight'
  if (mode === 'straight') {
    return [
      [fromCoord.lng, fromCoord.lat],
      [toCoord.lng, toCoord.lat],
    ];
  }

  const profile = mode === 'bike' ? 'bike' : 'foot';
  const url = `https://router.project-osrm.org/route/v1/${profile}/${fromCoord.lng},${fromCoord.lat};${toCoord.lng},${toCoord.lat}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Routing request failed');
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      return data.routes[0].geometry.coordinates; // Array of [lng, lat]
    }
  } catch (err) {
    console.warn('OSRM routing failed, falling back to straight line:', err);
  }

  // Fallback if snapping fails
  return [
    [fromCoord.lng, fromCoord.lat],
    [toCoord.lng, toCoord.lat],
  ];
}

// ----------------------------------------------------------------------
// Path B: Elevation Batch Enrichment (Open-Meteo)
// ----------------------------------------------------------------------

export async function enrichCoordinatesWithElevation(coordinates) {
  // coordinates is array of [lng, lat]
  if (coordinates.length === 0) return [];

  // Downsample to max 100 points for the elevation API URL limit
  const step = Math.max(1, Math.ceil(coordinates.length / 100));
  const sampledIndices = [];
  const lats = [];
  const lngs = [];

  for (let i = 0; i < coordinates.length; i += step) {
    sampledIndices.push(i);
    lats.push(coordinates[i][1].toFixed(5));
    lngs.push(coordinates[i][0].toFixed(5));
  }

  // Always include the last coordinate
  if (sampledIndices[sampledIndices.length - 1] !== coordinates.length - 1) {
    sampledIndices.push(coordinates.length - 1);
    lats.push(coordinates[coordinates.length - 1][1].toFixed(5));
    lngs.push(coordinates[coordinates.length - 1][0].toFixed(5));
  }

  try {
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats.join(',')}&longitude=${lngs.join(',')}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Elevation API error');
    const data = await res.json();

    const elevations = data.elevation || [];

    // Interpolate back to full coordinates array
    let currentSampleIdx = 0;
    return coordinates.map((c, idx) => {
      if (idx >= sampledIndices[currentSampleIdx + 1] && currentSampleIdx < sampledIndices.length - 2) {
        currentSampleIdx++;
      }
      const ele = Math.round(elevations[currentSampleIdx] || 0);
      return [c[0], c[1], ele]; // [lng, lat, ele]
    });
  } catch (err) {
    console.warn('Elevation lookup failed, defaulting to 0m:', err);
    return coordinates.map((c) => [c[0], c[1], 0]);
  }
}

// ----------------------------------------------------------------------
// Path B: GPX XML Generator
// ----------------------------------------------------------------------

export function buildGpxXml(title, coordinates) {
  // coordinates is [[lng, lat, ele], ...]
  const escapeXml = (value) =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  const safeTitle = escapeXml(title);
  const trkpts = coordinates
    .map(
      ([lng, lat, ele = 0]) =>
        `      <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}"><ele>${Math.round(ele)}</ele></trkpt>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GPX Explorer" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${safeTitle}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${safeTitle}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

// ----------------------------------------------------------------------
// Existing GPX Parser
// ----------------------------------------------------------------------

export function parseGpxFile(fileName, rawXmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(rawXmlString, 'text/xml');
  if (xmlDoc.querySelector('parsererror')) {
    throw new Error(`Invalid GPX XML in ${fileName}`);
  }

  const geojson = gpx(xmlDoc);
  if (!geojson?.features) {
    throw new Error(`No route data found in ${fileName}`);
  }

  let totalDistanceKm = 0;
  let elevationGainM = 0;
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  let rawPoints = [];
  const trackSegments = [];

  geojson.features.forEach((feature) => {
    if (
      feature.geometry.type === 'LineString' ||
      feature.geometry.type === 'MultiLineString'
    ) {
      const coords =
        feature.geometry.type === 'LineString'
          ? feature.geometry.coordinates
          : feature.geometry.coordinates.flat();

      rawPoints = rawPoints.concat(coords);
      trackSegments.push(coords);

      for (let i = 0; i < coords.length; i++) {
        const [lng, lat, ele] = coords[i];

        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;

        if (i > 0) {
          totalDistanceKm += calculateDistance(coords[i - 1], coords[i]);
          const prevEle = coords[i - 1][2] || 0;
          const currEle = ele || 0;
          if (currEle > prevEle) {
            elevationGainM += currEle - prevEle;
          }
        }
      }
    }
  });

  if (rawPoints.length === 0) {
    throw new Error(`No track points found in ${fileName}`);
  }

  const elevationProfile = [];
  let runningDist = 0;
  const sampleStep = Math.max(1, Math.floor(rawPoints.length / 120));
  let profileIndex = 0;

  trackSegments.forEach((segment, segmentIndex) => {
    for (let i = 0; i < segment.length; i++) {
      if (i > 0) {
        runningDist += calculateDistance(segment[i - 1], segment[i]);
      }
      if (profileIndex % sampleStep === 0 || (segmentIndex === trackSegments.length - 1 && i === segment.length - 1)) {
        elevationProfile.push({
          distance: parseFloat(runningDist.toFixed(2)),
          elevation: Math.round(segment[i][2] || 0),
        });
      }
      profileIndex++;
    }
  });

  const title =
    xmlDoc.querySelector('trk > name')?.textContent ||
    fileName.replace(/\.gpx$/i, '').replace(/[-_]/g, ' ');

  const startCoord = rawPoints.length > 0 ? [rawPoints[0][1], rawPoints[0][0]] : [0, 0];
  const endCoord = rawPoints.length > 0 ? [rawPoints[rawPoints.length - 1][1], rawPoints[rawPoints.length - 1][0]] : [0, 0];
  const region = getOfflineRegion(startCoord[0], startCoord[1]);

  return {
    id: fileName,
    fileName,
    rawXml: rawXmlString,
    title,
    geojson,
    distanceKm: parseFloat(totalDistanceKm.toFixed(2)),
    elevationGainM: Math.round(elevationGainM),
    elevationProfile,
    pointCount: rawPoints.length,
    startLocation: { lat: startCoord[0], lng: startCoord[1] },
    endLocation: { lat: endCoord[0], lng: endCoord[1] },
    region,
    bounds: [
      [minLat, minLng],
      [maxLat, maxLng],
    ],
  };
}