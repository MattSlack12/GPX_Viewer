// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { buildGpxXml, parseGpxFile } from './gpxParser';

const createGpx = (tracks) => `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  ${tracks
    .map(
      ({ name, points }) => `
        <trk>
          <name>${name}</name>
          <trkseg>
            ${points.map(([lat, lon, ele]) => `<trkpt lat="${lat}" lon="${lon}"><ele>${ele}</ele></trkpt>`).join('')}
          </trkseg>
        </trk>`
    )
    .join('')}
</gpx>`;

describe('GPX parser', () => {
  it('parses distance, elevation, bounds, and multiple track segments', () => {
    const xml = createGpx([
      {
        name: 'First Track',
        points: [
          [54, -2, 100],
          [54.01, -2, 150],
        ],
      },
      {
        name: 'Second Track',
        points: [
          [54.02, -2, 120],
          [54.03, -2, 180],
        ],
      },
    ]);

    const route = parseGpxFile('multi.gpx', xml);

    expect(route.title).toBe('First Track');
    expect(route.pointCount).toBe(4);
    expect(route.startLocation).toEqual({ lat: 54, lng: -2 });
    expect(route.endLocation).toEqual({ lat: 54.03, lng: -2 });
    expect(route.elevationGainM).toBe(110);
    expect(route.bounds).toEqual([
      [54, -2],
      [54.03, -2],
    ]);
    expect(route.distanceKm).toBeCloseTo(2.22, 1);
  });

  it('escapes route titles when generating GPX XML', () => {
    const xml = buildGpxXml('A & <B> "Trail"', [[-2, 54, 100], [-2.01, 54.01, 110]]);

    expect(xml).toContain('A &amp; &lt;B&gt; &quot;Trail&quot;');
    expect(() => parseGpxFile('escaped.gpx', xml)).not.toThrow();
  });

  it('rejects malformed and empty GPX files', () => {
    expect(() => parseGpxFile('broken.gpx', '<gpx>')).toThrow('Invalid GPX XML');
    expect(() => parseGpxFile('empty.gpx', '<gpx xmlns="http://www.topografix.com/GPX/1/1" />')).toThrow(
      'No track points found'
    );
  });
});
