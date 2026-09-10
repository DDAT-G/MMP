console.log("★★★★★ GPT playlist.js 로드됨 ★★★★★");


const axios = require('axios');
const express = require('express');
const OpenAI = require('openai');

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

let playlists = [];

async function searchYoutubeVideo(query) {

  const response = await axios.get(
    'https://www.googleapis.com/youtube/v3/search',
    {
      params: {
        part: 'snippet',
        q: `${query} 공식 audio`,
        type: 'video',
        maxResults: 5,
        key: process.env.YOUTUBE_API_KEY
      }
    }
  );

  const items = response.data.items || [];

  const artistName = query.split('-')[0].trim();

  const item =
    items.find(video =>
      video.snippet.title.includes(artistName) ||
      video.snippet.channelTitle.includes(artistName)
    ) || items[0];

  if (!item) {
    return null;
  }

  return {
    id: item.id.videoId,
    title: item.snippet.title,
    artist: item.snippet.channelTitle,
    channelTitle: item.snippet.channelTitle,
    thumbnail:
      item.snippet.thumbnails.high?.url ||
      item.snippet.thumbnails.default.url,
    duration: "3:30",
    mood: query
  };
}

// 생성
router.post('/playlist', async (req, res) => {

  try {

    const userInput = req.body.input;

    const count = req.body.count || 5;

    console.log('입력값:', userInput);
    console.log('곡 수:', count);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
  {
    role: "system",
    content: `
너는 음악 플레이리스트 추천 AI다.

사용자 입력을 먼저 판단해라.

1. 사용자 입력이 가수/아티스트 이름이면:
- 반드시 해당 아티스트의 실제 발매곡만 ${count}곡 추천해라.
- 비슷한 장르의 다른 가수 노래는 절대 추천하지 마라.

2. 사용자 입력이 노래 제목이면:
- 해당 노래와 비슷한 분위기/장르의 곡을 추천해라.

3. 사용자 입력이 분위기/장르/상황이면:
- 그 조건에 맞는 곡을 추천해라.

공통 규칙:
- 존재하지 않는 곡은 만들지 마라.
- 한국어 입력이면 한국 음악 위주로 추천해라.
- 결과는 반드시 "가수 - 노래제목" 형식으로만 ${count}곡 출력해라.
- 번호, 설명, 따옴표, 추가 문장 금지.
`
  },
  {
    role: "user",
    content: `
사용자 입력: ${userInput}

추천 개수: ${count}곡

입력이 아티스트 이름이면 해당 아티스트의 실제 곡만 추천해.
`
  }
]
    });

    const result = completion.choices[0].message.content;

    const playlist = result
  .split('\n')
  .map(line => line.trim())
  .filter(line => line !== '');

const youtubeResults = [];

for (const song of playlist) {
  const video = await searchYoutubeVideo(song);
  if (video) {
    youtubeResults.push(video);
  }
}

res.json({
  message: '플레이리스트 생성 완료!',
  userInput,
  playlist,
  videos: youtubeResults
});

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: 'GPT 호출 실패'
    });

  }

});


// 저장
router.post('/save-playlist', (req, res) => {

  const newPlaylist = req.body;

  playlists.push(newPlaylist);

  console.log(playlists);

  res.json({
    message: '플레이리스트 저장 완료!',
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
router.delete('/playlist/:index', (req, res) => {

  const index = req.params.index;

  playlists.splice(index, 1);

  res.json({
    message: '플레이리스트 삭제 완료!',
    playlists: playlists
  });

});

// 수정
router.put('/playlist/:index', (req, res) => {

  const index = req.params.index;
  const updatedData = req.body;

  if (!playlists[index]) {
    return res.status(404).json({
      message: '해당 플레이리스트가 존재하지 않습니다.'
    });
  }

  playlists[index] = updatedData;

  res.json({
    message: '플레이리스트 수정 완료!',
    playlists: playlists
  });

});

module.exports = router;