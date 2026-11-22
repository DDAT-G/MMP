
const express = require('express');
const { google } = require('googleapis');
const crypto = require('node:crypto');

const router = express.Router();

const createOAuthClient = () =>
  new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

// Google 계정 연결 시작
router.get('/google', (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');

  req.session.googleOAuthState = state;

  const oauth2Client = createOAuthClient();

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/youtube.force-ssl'
    ],
    state
  });

  req.session.save((err) => {
    if (err) {
      return res.status(500).send('세션 저장 실패');
    }

    res.redirect(url);
  });
});

// Google 인증 완료 후 돌아오는 주소
router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).send('Google 계정 연결이 취소되었습니다.');
  }

  if (
    !req.session.googleOAuthState ||
    typeof state !== 'string' ||
    state !== req.session.googleOAuthState ||
    typeof code !== 'string'
  ) {
    return res.status(400).send('잘못된 인증 요청입니다.');
  }

  delete req.session.googleOAuthState;

  try {
    const oauth2Client = createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    req.session.youtubeTokens = tokens;

    req.session.save((err) => {
      if (err) {
        return res.status(500).send('인증 정보 저장 실패');
      }

      res.redirect('/?youtube_connected=1');
    });
  } catch (err) {
    console.error('Google OAuth 인증 실패:', err.message);
    res.status(500).send('Google 계정 연결 실패');
  }
});

module.exports = router;


router.get('/google/status', (req, res) => {
  const connected = Boolean(
    req.session.youtubeTokens?.access_token
  );

  res.json({
    connected
  });
});

