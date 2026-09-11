// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { buildGpxXml, parseGpxFile, enrichGpxXmlWithElevation, fetchSnappedRouteLeg } from './gpxParser';

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
    expect(route.elevationProfile.length).toBeGreaterThan(0);
    expect(route.elevationProfile[0]).toMatchObject({
      lat: expect.any(Number),
      lng: expect.any(Number),
      distance: expect.any(Number),
      elevation: expect.any(Number),
    });
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

  it('enriches GPX XML without elevation data using elevation API', async () => {
    const xmlWithoutEle = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Flat Route</name>
    <trkseg>
      <trkpt lat="54.0" lon="-2.0"></trkpt>
      <trkpt lat="54.01" lon="-2.0"></trkpt>
    </trkseg>
  </trk>
</gpx>`;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ elevation: [250, 310] }),
    });

    try {
      const enrichedXml = await enrichGpxXmlWithElevation(xmlWithoutEle);
      expect(enrichedXml).toContain('<ele>250</ele>');
      expect(enrichedXml).toContain('<ele>310</ele>');

      const parsed = parseGpxFile('enriched.gpx', enrichedXml);
      expect(parsed.elevationGainM).toBe(60);
      expect(parsed.elevationProfile[0].elevation).toBe(250);
      expect(parsed.elevationProfile[parsed.elevationProfile.length - 1].elevation).toBe(310);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  describe('fetchSnappedRouteLeg', () => {
    it('returns direct coordinates for straight mode without fetching', async () => {
      const from = { lat: 54.1, lng: -2.1 };
      const to = { lat: 54.2, lng: -2.2 };
      const coords = await fetchSnappedRouteLeg(from, to, 'straight');
      expect(coords).toEqual([
        [-2.1, 54.1],
        [-2.2, 54.2],
      ]);
    });

    it('queries BRouter with hiking-mountain profile for foot mode', async () => {
      const originalFetch = globalThis.fetch;
      const mockCoords = [
        [-2.1, 54.1, 100],
        [-2.15, 54.15, 120],
        [-2.2, 54.2, 140],
      ];
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            {
              geometry: { coordinates: mockCoords },
            },
          ],
        }),
      });

      try {
        const coords = await fetchSnappedRouteLeg({ lat: 54.1, lng: -2.1 }, { lat: 54.2, lng: -2.2 }, 'foot');
        expect(coords).toEqual(mockCoords);
        expect(globalThis.fetch).toHaveBeenCalledWith(
          expect.stringContaining('brouter.de/brouter?lonlats=-2.1,54.1|-2.2,54.2&profile=hiking-mountain'),
          expect.any(Object)
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('queries BRouter with trekking profile for bike mode', async () => {
      const originalFetch = globalThis.fetch;
      const mockCoords = [
        [-2.1, 54.1, 50],
        [-2.2, 54.2, 60],
      ];
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            {
              geometry: { coordinates: mockCoords },
            },
          ],
        }),
      });

      try {
        const coords = await fetchSnappedRouteLeg({ lat: 54.1, lng: -2.1 }, { lat: 54.2, lng: -2.2 }, 'bike');
        expect(coords).toEqual(mockCoords);
        expect(globalThis.fetch).toHaveBeenCalledWith(
          expect.stringContaining('brouter.de/brouter?lonlats=-2.1,54.1|-2.2,54.2&profile=trekking'),
          expect.any(Object)
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('falls back to OSRM if BRouter fails', async () => {
      const originalFetch = globalThis.fetch;
      const osrmCoords = [
        [-2.1, 54.1],
        [-2.18, 54.18],
        [-2.2, 54.2],
      ];

      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('brouter.de')) {
          return Promise.reject(new Error('BRouter connection timeout'));
        }
        if (url.includes('router.project-osrm.org')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              routes: [{ geometry: { coordinates: osrmCoords } }],
            }),
          });
        }
        return Promise.reject(new Error('Unknown url'));
      });

      try {
        const coords = await fetchSnappedRouteLeg({ lat: 54.1, lng: -2.1 }, { lat: 54.2, lng: -2.2 }, 'foot');
        expect(coords).toEqual(osrmCoords);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('falls back to straight line if both BRouter and OSRM fail', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      try {
        const from = { lat: 54.1, lng: -2.1 };
        const to = { lat: 54.2, lng: -2.2 };
        const coords = await fetchSnappedRouteLeg(from, to, 'foot');
        expect(coords).toEqual([
          [-2.1, 54.1],
          [-2.2, 54.2],
        ]);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
