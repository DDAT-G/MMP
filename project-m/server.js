require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');

const playlistRoutes = require('./routes/playlist');
const googleAuthRoutes = require('./routes/googleAuth');
const youtubeExportRoutes = require('./routes/youtubeExport');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production' ||
  process.env.RENDER === 'true';

app.set('trust proxy', 1);

/* Public readiness check for the MMP-Website loading screen.
   Only the official GitHub Pages origin may read the result. */
app.get('/health', cors({ origin: 'https://ddat-g.github.io' }), (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ status: 'ok' });
});

app.use(cors({
  origin: ['http://localhost:8080', 'http://127.0.0.1:8080'],
  credentials: true
}));

app.use(express.json({ limit: '5mb' }));

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET 환경변수가 필요합니다.');
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'local-development-only',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 60 * 60 * 1000
  }
}));

app.use('/auth', googleAuthRoutes);
app.use('/youtube', youtubeExportRoutes);
app.use('/', playlistRoutes);

// 프론트엔드 파일 제공
const frontendPath = path.join(__dirname, '..', 'front');

app.use(express.static(frontendPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('MMP 서버 실행 중: ' + PORT);
});
