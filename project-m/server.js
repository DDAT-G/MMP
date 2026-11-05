
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');

const playlistRoutes = require('./routes/playlist');
const googleAuthRoutes = require('./routes/googleAuth');
const youtubeExportRoutes = require('./routes/youtubeExport');

const app = express();


app.use(cors({
  origin: 'http://localhost:8080',
  credentials: true
}));

app.use(express.json({ limit: '5mb' })); // 사진 추천용 base64

// Google OAuth 로그인 세션 설정
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 60 * 60 * 1000
  }
}));

// Google OAuth 인증 라우터
app.use('/auth', googleAuthRoutes);

//유튜브 재생목록 내보내기
app.use('/youtube', youtubeExportRoutes);

// 기존 MMP 음악 추천 및 플레이리스트 라우터
app.use('/', playlistRoutes);

app.get('/', (req, res) => {
  res.send('서버 실행 성공!');
});

app.listen(3000, () => {
  console.log('서버 실행중');
});
