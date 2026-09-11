// server.js
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// 1. Permissive CORS for local Vite dev server
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
  })
);

// 2. Large body limit for long GPX XML tracks
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 3. Absolute path to src/gpx
const gpxDir = path.resolve(__dirname, 'src', 'gpx');
if (!fs.existsSync(gpxDir)) {
  fs.mkdirSync(gpxDir, { recursive: true });
}

function makeUniqueFilename(filename) {
  const extension = path.extname(filename).toLowerCase() === '.gpx' ? '.gpx' : '.gpx';
  const baseName = path.basename(filename, path.extname(filename));
  let candidate = `${baseName}${extension}`;
  let suffix = 2;

  while (fs.existsSync(path.join(gpxDir, candidate))) {
    candidate = `${baseName}-${suffix}${extension}`;
    suffix += 1;
  }

  return candidate;
}

// Upload file endpoint
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, gpxDir),
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, makeUniqueFilename(cleanName));
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.post('/api/upload', upload.single('gpxFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const content = fs.readFileSync(req.file.path, 'utf8');
  if (!/<gpx(?:\s|>)/i.test(content)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Uploaded file does not contain valid GPX XML.' });
  }
  res.json({ message: 'File uploaded', filename: req.file.filename });
});

// Chrome DevTools workspace probe endpoint to prevent CSP / 404 console errors
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.status(204).end();
});

// Root landing endpoint when opening port 3001 in a browser
app.get('/', (req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>GPX Route Viewer API</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; max-width: 540px; margin: 40px auto; padding: 24px; line-height: 1.5; color: #1e293b; background: #f8fafc; }
          .card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
          h1 { margin: 0 0 12px; font-size: 1.25rem; font-weight: 600; color: #0f172a; }
          p { margin: 0 0 12px; font-size: 0.95rem; }
          a.btn { display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-size: 0.9rem; font-weight: 500; }
          a.btn:hover { background: #1d4ed8; }
          code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.85em; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>GPX Route Viewer API</h1>
          <p>The backend API server is running on port <code>3001</code>.</p>
          <p>The web application is served by Vite at port <code>5173</code>:</p>
          <a class="btn" href="http://localhost:5173">Open GPX Viewer UI</a>
        </div>
      </body>
    </html>
  `);
});

// Save route endpoint
app.post('/api/save-gpx', (req, res) => {
  try {
    const { filename, gpxXml, overwrite } = req.body;
    if (!filename || !gpxXml) {
      return res.status(400).json({ error: 'Missing filename or gpxXml content.' });
    }

    if (typeof gpxXml !== 'string' || !/<gpx(?:\s|>)/i.test(gpxXml)) {
      return res.status(400).json({ error: 'gpxXml must contain valid GPX XML.' });
    }

    const baseOnly = path.basename(filename);
    if (!baseOnly || baseOnly === '.' || baseOnly === '..') {
      return res.status(400).json({ error: 'Invalid filename.' });
    }

    const directPath = path.join(gpxDir, baseOnly);
    let fullFileName;

    // If overwrite is requested and the exact file exists on disk, overwrite directly without altering filename
    if (overwrite && fs.existsSync(directPath)) {
      fullFileName = baseOnly;
    } else {
      // Strip illegal characters for Windows/POSIX filesystem, preserving spaces and dots
      // eslint-disable-next-line no-control-regex
      const cleanName = baseOnly.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
      const requestedFileName = cleanName.toLowerCase().endsWith('.gpx') ? cleanName : `${cleanName}.gpx`;
      fullFileName = overwrite ? requestedFileName : makeUniqueFilename(requestedFileName);
    }

    const targetFilePath = path.join(gpxDir, fullFileName);

    fs.writeFileSync(targetFilePath, gpxXml, 'utf8');
    console.log(`Saved GPX route to disk (${overwrite ? 'overwritten' : 'new'}): ${targetFilePath}`);

    return res.json({ message: 'Route successfully saved', filename: fullFileName });
  } catch (err) {
    console.error('Error writing file:', err);
    return res.status(500).json({ error: `Disk write error: ${err.message}` });
  }
});

// Delete route endpoint
function handleDeleteGpx(req, res) {
  try {
    const rawFilename = req.params?.filename || req.body?.filename;
    if (!rawFilename) {
      return res.status(400).json({ error: 'Missing filename parameter.' });
    }

    const decoded = decodeURIComponent(rawFilename).trim();
    const baseOnly = path.basename(decoded);

    if (!baseOnly || baseOnly === '.' || baseOnly === '..') {
      return res.status(400).json({ error: 'Invalid filename.' });
    }

    const targetFilePath = path.resolve(gpxDir, baseOnly);
    const normalizedGpxDir = path.resolve(gpxDir);

    if (!targetFilePath.startsWith(normalizedGpxDir)) {
      return res.status(403).json({ error: 'Access denied: Invalid file path.' });
    }

    if (!fs.existsSync(targetFilePath)) {
      return res.json({ message: 'File not found on disk (already deleted)', filename: baseOnly });
    }

    fs.unlinkSync(targetFilePath);
    console.log(`Successfully deleted GPX file from disk: ${targetFilePath}`);

    return res.json({ message: 'File deleted successfully', filename: baseOnly });
  } catch (err) {
    console.error('Error deleting GPX file:', err);
    return res.status(500).json({ error: `Failed to delete file from disk: ${err.message}` });
  }
}

app.delete('/api/delete-gpx/:filename', handleDeleteGpx);
app.post('/api/delete-gpx', handleDeleteGpx);

// Custom 404 handler to prevent Express 5 default HTML CSP errors
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
});

app.listen(PORT, () => {
  console.log(`GPX server running on http://localhost:${PORT}`);
  console.log(`Saving files directly to: ${gpxDir}`);
});