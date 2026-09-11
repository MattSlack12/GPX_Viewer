# GPX Explorer

GPX Explorer is a local route library and map workspace. It loads GPX files from `src/gpx`, displays selected routes on a Leaflet map, shows route metrics and elevation profiles, and supports uploading or drawing new routes.

## Development

Install dependencies and start both the Vite frontend and Express persistence API:

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. The API runs on `http://localhost:3001` and writes uploaded or drawn routes to `src/gpx`.

The frontend API base can be changed with a Vite environment variable:

```text
VITE_API_URL=http://localhost:3001
```

## Checks

```powershell
npm run lint
npm test
npm run build
```

The parser tests cover multi-segment routes, elevation and distance metrics, XML escaping, and invalid GPX input.

## Features

- Search routes by name, file name, region, and distance range.
- Select multiple routes and compare total distance and elevation gain.
- Focus the map on the current browser location when permission is available.
- Inspect elevation profiles, bounds, start coordinates, and point counts.
- Upload GPX files or draw walking, cycling, and straight-line routes.
- Snap drawn route legs through OSRM and enrich them with Open-Meteo elevation data.
- Download any route as a GPX file.

<img width="2529" height="1347" alt="image" src="https://github.com/user-attachments/assets/58a7c421-f676-4cf2-8f73-0d31b73865f7" />

