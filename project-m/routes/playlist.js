console.log("★★★★★ GPT playlist.js 로드됨 ★★★★★");


const axios = require('axios');
const express = require('express');
const OpenAI = require('openai');

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

let playlists = [];

// 같은 곡을 다시 검색하지 않도록 캐시 (YouTube 검색은 1회 100 quota)
// ponytail: 서버 재시작하면 비워짐, quota가 부족해지면 파일/DB로 옮기기
const videoCache = new Map();

const LOW_QUALITY = /가사|lyrics|cover|커버|노래방|karaoke|reaction|리액션|1시간|1 ?hour|교차편집|직캠|fancam|playlist|플레이리스트/i;

// 공식 음원일수록 높은 점수. 동점이면 YouTube 검색 순서(관련도)를 따른다
function scoreVideo(snippet, artist) {
  const channel = snippet.channelTitle.toLowerCase();
  const name = artist.toLowerCase();
  let score = 0;

  if (channel.endsWith(' - topic')) score += 4;            // YouTube Music 자동 생성 공식 음원 채널
  if (channel.includes(name)) score += 3;                  // 아티스트 본인 채널
  if (/official|공식|vevo/i.test(channel)) score += 2;     // "이지금 [IU Official]" 같은 공식 채널
  if (snippet.title.toLowerCase().includes(name)) score += 1;
  if (LOW_QUALITY.test(snippet.title)) score -= 3;         // 가사/커버/노래방 영상은 뒤로

  return score;
}

async function searchYoutubeVideo(artist, title) {

  const query = `${artist} - ${title}`;

  if (videoCache.has(query)) {
    return videoCache.get(query);
  }

  const response = await axios.get(
    'https://www.googleapis.com/youtube/v3/search',
    {
      params: {
        part: 'snippet',
        q: `${artist} ${title}`,
        type: 'video',
        videoCategoryId: '10', // 음악 카테고리만
        maxResults: 10,        // 5개든 10개든 quota는 100으로 같다
        key: process.env.YOUTUBE_API_KEY
      }
    }
  );

  const items = response.data.items || [];

  let item = null;
  let bestScore = -Infinity;
  for (const candidate of items) {
    const score = scoreVideo(candidate.snippet, artist);
    if (score > bestScore) {
      item = candidate;
      bestScore = score;
    }
  }

  if (!item) {
    return null;
  }

  const video = {
    id: item.id.videoId,
    title: item.snippet.title,
    artist: item.snippet.channelTitle,
    channelTitle: item.snippet.channelTitle,
    thumbnail:
      item.snippet.thumbnails.high?.url ||
      item.snippet.thumbnails.default.url,
    duration: null,
    mood: query
  };

  videoCache.set(query, video);
  return video;
}

// 실제 영상 길이(ISO 8601, 예: PT4M13S)를 한 번에 조회 (최대 50개, 1 quota)
async function fillDurations(videos) {
  const missing = videos.filter(video => !video.duration);
  if (missing.length === 0) return;

  const response = await axios.get(
    'https://www.googleapis.com/youtube/v3/videos',
    {
      params: {
        part: 'contentDetails',
        id: missing.map(video => video.id).join(','),
        key: process.env.YOUTUBE_API_KEY
      }
    }
  );

  const durations = new Map(
    (response.data.items || []).map(item => [item.id, item.contentDetails.duration])
  );

  for (const video of missing) {
    video.duration = durations.get(video.id) || null;
    const cached = videoCache.get(video.mood);
    if (cached) cached.duration = video.duration;
  }
}

function systemPrompt(count) {
  return `
너는 음악 플레이리스트 추천 AI다.

사용자 입력을 먼저 판단해라.

1. 사용자 입력이 가수/아티스트 이름이면:
- 반드시 해당 아티스트의 실제 발매곡만 ${count}곡 추천해라.
- 비슷한 장르의 다른 가수 노래는 절대 추천하지 마라.

2. 사용자 입력이 노래 제목이면:
- 해당 노래와 비슷한 분위기/장르의 곡을 추천해라.

3. 사용자 입력이 분위기/장르/상황/시간대/날씨이면:
- 그 조건에 맞는 곡을 추천해라. 시간대와 날씨가 함께 오면 둘 다 반영해라.

4. 사진이 함께 오면:
- 사진의 장소, 색감, 분위기를 읽고 그에 어울리는 곡을 추천해라.

5. "현재 플레이리스트"가 함께 오면:
- 사용자 입력은 수정 요청이다. 요청에 맞게 리스트를 고쳐라.
- 요청과 상관없는 곡은 최대한 유지해라.

공통 규칙:
- 존재하지 않는 곡은 만들지 마라.
- 한국어 입력이면 한국 음악 위주로 추천해라.
- songs는 정확히 ${count}개.
- 반드시 아래 JSON 형식으로만 답해라.

{
  "mood": "이 플레이리스트를 대표하는 짧은 키워드 (10자 이내)",
  "analysis": "사용자 입력을 어떻게 이해했고 어떤 방향으로 골랐는지 한 문장",
  "songs": [
    { "artist": "가수", "title": "노래 제목", "reason": "이 곡을 고른 이유 한 문장" }
  ]
}
`;
}

// 생성 / 수정 요청 / 사진 기반 추천 모두 여기서 처리
router.post('/playlist', async (req, res) => {

  try {

    const userInput = String(req.body.input || '');
    const count = Math.min(50, Math.max(1, Math.floor(Number(req.body.count) || 5)));
    const current = Array.isArray(req.body.current) ? req.body.current : [];
    const image = req.body.image;
    if (!userInput.trim() && !image && current.length === 0) {
      return res.status(400).json({ message: '검색어 또는 이미지가 필요합니다.' });
    }

    if (image && !/^data:image\/(jpeg|png|webp|gif);base64,/.test(image)) {
      return res.status(400).json({ message: '이미지 형식이 올바르지 않습니다.' });
    }

    console.log('입력값:', userInput, '| 곡 수:', count, '| 수정:', current.length > 0, '| 사진:', Boolean(image));

    const minMinutes = Math.max(1, Math.min(120, Number(req.body.minMinutes) || 1));
    const maxMinutes = Math.max(minMinutes, Math.min(120, Number(req.body.maxMinutes) || 120));

    let text = `사용자 입력: ${userInput}\n\n추천 개수: ${count}곡`;
    if (minMinutes > 1 || maxMinutes < 120) {
      text += `\n\n곡 길이: ${minMinutes}분 ~ ${maxMinutes}분. 이 길이에 들어가는 곡만 골라라.`;
    }
    if (current.length > 0) {
      text += `\n\n현재 플레이리스트:\n${current.join('\n')}`;
    }

    const content = image
      ? [{ type: 'text', text }, { type: 'image_url', image_url: { url: image } }]
      : text;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: "system", content: systemPrompt(count) },
        { role: "user", content }
      ]
    });

    const ai = JSON.parse(completion.choices[0].message.content);
    const songs = (ai.songs || []).slice(0, count);
    const playlist = songs.map(song => `${song.artist} - ${song.title}`);

    const videos = await Promise.all(
      songs.map(song => searchYoutubeVideo(song.artist, song.title))
    );

    // 카드에는 영상 제목("... [가사/Lyrics]")/업로더 대신 AI가 고른 곡명/가수를 보여준다
    const youtubeResults = videos
      .map((video, i) => video && {
        ...video,
        title: songs[i].title,
        artist: songs[i].artist,
        reason: songs[i].reason
      })
      .filter(Boolean);

    await fillDurations(youtubeResults).catch(console.error); // 길이 조회 실패해도 추천은 보여준다

    res.json({
      message: '플레이리스트 생성 완료!',
      userInput,
      mood: ai.mood,
      analysis: ai.analysis,
      playlist,
      videos: youtubeResults
    });

  } catch (error) {

    console.error('AI 추천 오류:', error.status || error.response?.status || error.code || error.message);

    res.status(500).json({ message: 'AI 추천 또는 YouTube 검색 실패' });

  }

});


// 저장할 때 곡 목록을 보고 리스트 이름/소개 지어주기
router.post('/playlist-name', async (req, res) => {

  try {

    const tracks = (req.body.tracks || [])
      .map(track => `${track.artist} - ${track.title}`)
      .join('\n');

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: "system",
          content: `아래 곡들로 만든 플레이리스트의 감성적인 한국어 제목(15자 이내)과 한 줄 소개를 지어라.
반드시 JSON으로만 답해라: { "title": "제목", "description": "한 줄 소개" }`
        },
        { role: "user", content: tracks }
      ]
    });

    res.json(JSON.parse(completion.choices[0].message.content));

  } catch (error) {

    console.error('AI 이름 생성 오류:', error.status || error.response?.status || error.code || error.message);

    res.status(500).json({ message: 'AI 이름 생성 실패' });

  }

});

// 저장
router.post('/save-playlist', (req, res) => {

  const newPlaylist = req.body;

  if (!newPlaylist.id) {
    newPlaylist.id = Date.now().toString();
  }

  playlists.push(newPlaylist);

  console.log('저장된 플레이리스트:', playlists);

  res.json({
    message: '플레이리스트 저장 완료!',
    playlist: newPlaylist,
    playlists: playlists
  });

});

// 조회
router.get('/playlists', (req, res) => {

  res.json({
    playlists: playlists
  });

});

// 삭제
router.delete('/playlist/:id', (req, res) => {

  const id = req.params.id;

  const index = playlists.findIndex(
    playlist => playlist.id === id
  );

  if (index === -1) {
    return res.status(404).json({
      message: '해당 플레이리스트가 존재하지 않습니다.'
    });
  }

  playlists.splice(index, 1);

  res.json({
    message: '플레이리스트 삭제 완료!',
    playlists: playlists
  });

});

// 수정
router.put('/playlist/:id', (req, res) => {

  const id = req.params.id;
  const updatedData = req.body;

  const index = playlists.findIndex(
    playlist => playlist.id === id
  );

  if (index === -1) {
    return res.status(404).json({
      message: '해당 플레이리스트가 존재하지 않습니다.'
    });
  }

  // 기존 ID는 유지하면서 수정된 내용 반영
  playlists[index] = {
    ...updatedData,
    id: id
  };

  res.json({
    message: '플레이리스트 수정 완료!',
    playlist: playlists[index],
    playlists: playlists
  });

});

module.exports = router;
module.exports.scoreVideo = scoreVideo;
