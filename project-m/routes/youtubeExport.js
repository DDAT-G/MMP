
const express = require('express');
const { google } = require('googleapis');

const router = express.Router();

// YouTube 재생목록 내보내기
router.post('/export', async (req, res) => {
  const tokens = req.session?.youtubeTokens;

  if (!tokens?.access_token) {
    return res.status(401).json({
      error: 'Google 계정 연결이 필요합니다.'
    });
  }

  const { title, videoIds } = req.body || {};

  // 잘못된 입력이나 테스트용 영상 ID 차단
  if (
    typeof title !== 'string' ||
    !title.trim() ||
    title.length > 150 ||
    !Array.isArray(videoIds) ||
    videoIds.length < 1 ||
    videoIds.length > 20 ||
    !videoIds.every(
      id => typeof id === 'string' &&
      /^[a-zA-Z0-9_-]{11}$/.test(id)
    )
  ) {
    return res.status(400).json({
      error: '재생목록 제목 또는 YouTube 영상 ID가 올바르지 않습니다.'
    });
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials(tokens);

  const youtube = google.youtube({
    version: 'v3',
    auth: oauth2Client
  });

  let playlistId = null;

  try {
    // 1. YouTube 재생목록 생성
    const response = await youtube.playlists.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: title.trim(),
          description: 'Created with MMP (My Mood Playlist)'
        },
        status: {
          privacyStatus: 'private'
        }
      }
    });

    playlistId = response.data.id;

    if (!playlistId) {
      throw new Error('재생목록 ID를 받지 못했습니다.');
    }

    // 2. 영상 추가
    let addedCount = 0;
    const failedVideoIds = [];

    for (const videoId of videoIds) {
      try {
        await youtube.playlistItems.insert({
          part: ['snippet'],
          requestBody: {
            snippet: {
              playlistId,
              resourceId: {
                kind: 'youtube#video',
                videoId
              }
            }
          }
        });

        addedCount++;
      } catch (error) {
        console.error(
          '영상 추가 실패:',
          videoId,
          error.response?.status || error.message
        );

        failedVideoIds.push(videoId);
      }
    }

    // 3. 결과 반환
    res.json({
      success: failedVideoIds.length === 0,
      playlistId,
      playlistUrl:
        `https://www.youtube.com/playlist?list=${playlistId}`,
      addedCount,
      failedVideoIds
    });

  } catch (error) {
    console.error(
      'YouTube Export 오류:',
      error.response?.status || error.message
    );

    res.status(500).json({
      error: 'YouTube 재생목록 생성에 실패했습니다.',
      playlistId
    });
  }
});

module.exports = router;
