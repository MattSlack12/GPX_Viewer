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
    methods: ['GET', 'POST', 'OPTIONS'],
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

// Save route endpoint
app.post('/api/save-gpx', (req, res) => {
  try {
    const { filename, gpxXml } = req.body;
    if (!filename || !gpxXml) {
      return res.status(400).json({ error: 'Missing filename or gpxXml content.' });
    }

    if (typeof gpxXml !== 'string' || !/<gpx(?:\s|>)/i.test(gpxXml)) {
      return res.status(400).json({ error: 'gpxXml must contain valid GPX XML.' });
    }

    const cleanName = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
    const requestedFileName = cleanName.endsWith('.gpx') ? cleanName : `${cleanName}.gpx`;
    const fullFileName = makeUniqueFilename(requestedFileName);
    const targetFilePath = path.join(gpxDir, fullFileName);

    fs.writeFileSync(targetFilePath, gpxXml, 'utf8');
    console.log(`Saved GPX route to disk: ${targetFilePath}`);

    return res.json({ message: 'Route successfully saved', filename: fullFileName });
  } catch (err) {
    console.error('Error writing file:', err);
    return res.status(500).json({ error: `Disk write error: ${err.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`GPX server running on http://localhost:${PORT}`);
  console.log(`Saving files directly to: ${gpxDir}`);
});