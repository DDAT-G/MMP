console.log("내가 수정한 app.js 로드됨");


const API_CONFIG = {
  useMockData: false,
  searchUrl: 'http://localhost:3000/playlist',
  mockUrl: './data/playlists.json',
};

const fallbackData = {
  playlists: [
    {
      mood: '집중',
      title: 'Deep Focus Session',
      tracks: [
        {
          id: 'focus-1',
          title: 'Lofi Study Beats',
          artist: 'Mood Lab',
          channelTitle: 'Mood Lab',
          duration: '3:42',
          thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
          mood: '집중',
        },
      ],
    },
  ],
};

const state = {
  playlists: [],
  activeMood: '집중',
  trackCount: 8,
  minDuration: 1,
  maxDuration: 120,
  activeTracks: [],
  selectedTrackId: null,
  selectedTrackIds: [],
  savedPlaylists: [],
  renameMode: false,
  editingPlaylistId: null,
};

const elements = {
  appShell: document.querySelector('.app-shell'),
  sidebarToggle: document.querySelector('#sidebarToggle'),
  randomButton: document.querySelector('#randomButton'),
  form: document.querySelector('#moodForm'),
  input: document.querySelector('#moodInput'),
  trackCountInput: document.querySelector('#trackCountInput'),
  minDurationInput: document.querySelector('#minDurationInput'),
  maxDurationInput: document.querySelector('#maxDurationInput'),
  minVal: document.querySelector('#minVal'),
  maxVal: document.querySelector('#maxVal'),
  sliderTrack: document.querySelector('.slider-track'),
  chips: document.querySelectorAll('[data-mood]'),
  reloadButton: document.querySelector('#reloadButton'),
  playSelectedButton: document.querySelector('#playSelectedButton'),
  mainSaveButton: document.querySelector('#mainSaveButton'),
  savePlaylistButton: document.querySelector('#savePlaylistButton'),
  savedPlaylistsContainer: document.querySelector('#savedPlaylistsContainer'),
  renameModeButton: document.querySelector('#renameModeButton'),
  playlistEditor: document.querySelector('#playlistEditor'),
  editorTitle: document.querySelector('#editorTitle'),
  editorTrackList: document.querySelector('#editorTrackList'),
  editorAddButton: document.querySelector('#editorAddButton'),
  editorCloseButton: document.querySelector('#editorCloseButton'),
  playlistToggle: document.querySelector('#playlistToggle'),
  playlistDrawer: document.querySelector('#playlistDrawer'),
  closeDrawer: document.querySelector('#closeDrawer'),
  selectedTrackList: document.querySelector('#selectedTrackList'),
  playlistTitle: document.querySelector('#playlistTitle'),
  trackList: document.querySelector('#trackList'),
  playerCover: document.querySelector('#playerCover'),
  playerTitle: document.querySelector('#playerTitle'),
  playerArtist: document.querySelector('#playerArtist'),
  volumeButton: document.querySelector('#volumeButton'),
  volumeSlider: document.querySelector('#volumeSlider'),
  watchVideoButton: document.querySelector('#watchVideoButton'),
  expandedPlayer: document.querySelector('#expandedPlayer'),
  closeExpandedPlayer: document.querySelector('#closeExpandedPlayer'),
  videoPlayer: document.querySelector('#videoPlayer'),
  expandedTitle: document.querySelector('#expandedTitle'),
  expandedArtist: document.querySelector('#expandedArtist'),
  expandedQueueList: document.querySelector('#expandedQueueList'),
  expandedPlaylistsList: document.querySelector('#expandedPlaylistsList'),
  sideTabButtons: document.querySelectorAll('.side-tab-button'),
};

const trackCache = new Map();

function cacheTracks(playlists) {
  playlists.forEach((playlist) => playlist.tracks.forEach((track) => trackCache.set(track.id, track)));
}

function getTrackById(id) {
  return trackCache.get(id);
}

function getTracksByIds(ids) {
  return ids.map(getTrackById).filter(Boolean);
}

function getUniqueTracks(tracks) {
  return tracks.filter((track, index, self) =>
    index === self.findIndex((t) => t.id === track.id)
  );
}

async function fetchPlaylistData() {
  if (API_CONFIG.useMockData) {
    const response = await fetch(API_CONFIG.mockUrl);
    if (!response.ok) throw new Error('목 JSON 파일을 불러오지 못했습니다.');
    return response.json();
  }

  const response = await fetch(API_CONFIG.searchUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    input: state.activeMood,
    count: state.trackCount
  })
});


  if (!response.ok) throw new Error('백엔드 API 응답을 확인해 주세요.');

 const data = await response.json();

return {
  playlists: [
    {
      mood: data.userInput,
      title: `${data.userInput} 추천 플레이리스트`,
      tracks: data.videos.map((video) => ({
        id: video.id,
        title: video.title,
        artist: video.artist,
        channelTitle: video.channelTitle,
        duration: video.duration,
        thumbnail: video.thumbnail,
        mood: data.userInput,
      })),
    },
  ],
};

}

async function loadData() {
  setLoadingView();
  try {
    const data = await fetchPlaylistData();
    state.playlists = Array.isArray(data.playlists) ? data.playlists : [];
  } catch (error) {
    console.warn(error.message, '→ 목 데이터로 대체합니다.');
    try {
      const mock = await fetch(API_CONFIG.mockUrl).then((r) => r.json());
      state.playlists = mock.playlists;
    } catch {
      state.playlists = fallbackData.playlists;
    }
  }
  cacheTracks(state.playlists);
  applyMood(state.activeMood);
}

function applyMood(mood) {
  state.activeMood = mood.trim() || '집중';
  state.trackCount = parseInt(elements.trackCountInput.value, 10) || 8;
  state.minDuration = parseInt(elements.minDurationInput.value, 10) || 1;
  state.maxDuration = parseInt(elements.maxDurationInput.value, 10) || 120;

  elements.playlistTitle.textContent = `${state.activeMood} 플레이리스트`;

  const matchedPlaylist =
    state.playlists.find((playlist) => playlist.mood === state.activeMood) ||
    state.playlists.find((playlist) => playlist.tracks.some((track) => track.mood === state.activeMood)) ||
    state.playlists[0];

  if (!matchedPlaylist) {
    state.activeTracks = [];
    render();
    return;
  }

  state.activeTracks = matchedPlaylist.tracks;
  state.selectedTrackId = state.activeTracks[0]?.id || null;
  render();
}

function render() {
  elements.playSelectedButton.disabled = state.selectedTrackIds.length === 0;
  if (elements.mainSaveButton) {
    elements.mainSaveButton.disabled = state.selectedTrackIds.length === 0;
  }
  elements.playSelectedButton.querySelector('span').textContent = state.selectedTrackIds.length > 0 ? `▶ (${state.selectedTrackIds.length})` : '▶';

  if (state.activeTracks.length === 0) {
    elements.trackList.innerHTML = '<div class="empty-state">표시할 음악 데이터가 없습니다.</div>';
    updatePlayer(null);
    return;
  }

  elements.trackList.innerHTML = state.activeTracks.map(createTrackTemplate).join('');

  document.querySelectorAll('.video-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.select-button')) return;
      const track = state.activeTracks.find((item) => item.id === card.dataset.trackId);
      state.selectedTrackId = track.id;
      render();
      updatePlayer(track);
    });
  });

  document.querySelectorAll('.select-button').forEach((button) => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const trackId = button.dataset.selectId;
      if (state.selectedTrackIds.includes(trackId)) {
        state.selectedTrackIds = state.selectedTrackIds.filter((id) => id !== trackId);
      } else {
        state.selectedTrackIds.push(trackId);
      }
      render();
    });
  });

  const currentTrack = state.activeTracks.find((track) => track.id === state.selectedTrackId) || state.activeTracks[0];
  updatePlayer(currentTrack);
  renderSelectedPlaylist();
}

function renderSelectedPlaylist() {
  const selectedTracks = getTracksByIds(state.selectedTrackIds);
  const uniqueSelected = getUniqueTracks(selectedTracks);

  if (uniqueSelected.length === 0) {
    elements.selectedTrackList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--muted); font-size: 0.9rem;">선택된 곡이 없습니다.</div>';
    return;
  }

  elements.selectedTrackList.innerHTML = uniqueSelected.map(track => `
    <div class="drawer-item">
      <img src="${track.thumbnail}" alt="">
      <div class="drawer-item-info">
        <strong>${escapeHtml(track.title)}</strong>
        <span>${escapeHtml(track.artist || track.channelTitle)}</span>
      </div>
    </div>
  `).join('');
}

elements.playlistToggle.addEventListener('click', () => {
  elements.playlistDrawer.classList.toggle('active');
});

elements.closeDrawer.addEventListener('click', () => {
  elements.playlistDrawer.classList.remove('active');
});

elements.sidebarToggle.addEventListener('click', () => {
  elements.appShell.classList.toggle('collapsed');
});

let lastVolume = 80;

elements.volumeSlider.addEventListener('input', (e) => {
  const volume = e.target.value;
  updateVolumeIcon(volume);
  if (volume > 0) lastVolume = volume;
});

elements.volumeButton.addEventListener('click', () => {
  if (elements.volumeSlider.value > 0) {
    lastVolume = elements.volumeSlider.value;
    elements.volumeSlider.value = 0;
  } else {
    elements.volumeSlider.value = lastVolume;
  }
  updateVolumeIcon(elements.volumeSlider.value);
});

function updateVolumeIcon(volume) {
  let icon = '🔇';
  if (volume > 60) icon = '🔊';
  else if (volume > 20) icon = '🔉';
  else if (volume > 0) icon = '🔈';
  elements.volumeButton.textContent = icon;
}

elements.playSelectedButton.addEventListener('click', () => {
  elements.playlistDrawer.classList.add('active');
});

const handleSavePlaylist = () => {
  if (state.selectedTrackIds.length === 0) return;

  const name = prompt('리스트 이름을 입력하세요:', `내 리스트 ${state.savedPlaylists.length + 1}`);
  if (!name) return;

  const newPlaylist = {
    id: Date.now().toString(),
    name: name,
    trackIds: [...state.selectedTrackIds]
  };

  state.savedPlaylists.push(newPlaylist);
  renderSavedPlaylists();
  alert('리스트가 저장되었습니다.');
};

elements.savePlaylistButton.addEventListener('click', handleSavePlaylist);
if (elements.mainSaveButton) {
  elements.mainSaveButton.addEventListener('click', handleSavePlaylist);
}

const ICON_EDIT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="M14.5 5.5l4 4"/></svg>';
const ICON_DELETE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg>';

function renderSavedPlaylists() {
  elements.savedPlaylistsContainer.innerHTML = state.savedPlaylists.map(playlist => {
    const name = escapeHtml(playlist.name);

    if (state.renameMode) {
      return `
        <div class="saved-playlist-row is-renaming" data-playlist-id="${playlist.id}">
          <input class="saved-playlist-name-input" type="text" value="${name}" aria-label="리스트 이름 수정" />
          <div class="saved-playlist-actions is-static">
            <button class="saved-playlist-action" type="button" data-action="delete" title="삭제" aria-label="${name} 삭제">${ICON_DELETE}</button>
          </div>
        </div>
      `;
    }

    return `
      <div class="saved-playlist-row" data-playlist-id="${playlist.id}">
        <button class="saved-playlist-item" type="button">
          <span class="item-text">${name}</span>
        </button>
        <span class="saved-playlist-count">${playlist.trackIds.length}</span>
        <div class="saved-playlist-actions">
          <button class="saved-playlist-action" type="button" data-action="edit" title="곡 편집" aria-label="${name} 곡 편집">${ICON_EDIT}</button>
          <button class="saved-playlist-action" type="button" data-action="delete" title="삭제" aria-label="${name} 삭제">${ICON_DELETE}</button>
        </div>
      </div>
    `;
  }).join('');

  elements.savedPlaylistsContainer.querySelectorAll('.saved-playlist-row').forEach(row => {
    const findPlaylist = () => state.savedPlaylists.find(p => p.id === row.dataset.playlistId);

    const nameInput = row.querySelector('.saved-playlist-name-input');
    if (nameInput) {
      // change는 blur/Enter 양쪽에서 뜬다. 포커스가 날아가지 않게 사이드바는 다시 그리지 않는다.
      nameInput.addEventListener('change', () => {
        const playlist = findPlaylist();
        if (!playlist) return;

        const value = nameInput.value.trim();
        if (!value) {
          nameInput.value = playlist.name;
          return;
        }

        playlist.name = value;
        if (state.editingPlaylistId === playlist.id) elements.editorTitle.textContent = value;
        renderExpandedPlaylists();
      });

      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') nameInput.blur();
      });
    }

    const openButton = row.querySelector('.saved-playlist-item');
    if (openButton) {
      openButton.addEventListener('click', () => {
        const playlist = findPlaylist();
        if (playlist) loadSavedPlaylist(playlist);
      });
    }

    const editButton = row.querySelector('[data-action="edit"]');
    if (editButton) {
      editButton.addEventListener('click', () => {
        const playlist = findPlaylist();
        if (playlist) openPlaylistEditor(playlist.id);
      });
    }

    row.querySelector('[data-action="delete"]').addEventListener('click', () => {
      const playlist = findPlaylist();
      if (!playlist) return;
      if (!confirm(`"${playlist.name}" 리스트를 삭제할까요?`)) return;

      state.savedPlaylists = state.savedPlaylists.filter(p => p.id !== playlist.id);
      if (state.editingPlaylistId === playlist.id) closePlaylistEditor();
      refreshSavedPlaylistViews();
    });
  });
}

elements.renameModeButton.addEventListener('click', () => {
  state.renameMode = !state.renameMode;
  elements.renameModeButton.setAttribute('aria-pressed', String(state.renameMode));
  elements.renameModeButton.classList.toggle('active', state.renameMode);
  elements.renameModeButton.title = state.renameMode ? '이름 수정 완료' : '이름 수정';

  renderSavedPlaylists();

  const firstInput = elements.savedPlaylistsContainer.querySelector('.saved-playlist-name-input');
  if (firstInput) firstInput.focus();
});

function openPlaylistEditor(playlistId) {
  state.editingPlaylistId = playlistId;
  renderPlaylistEditor();
  elements.playlistEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closePlaylistEditor() {
  state.editingPlaylistId = null;
  elements.playlistEditor.hidden = true;
}

function renderPlaylistEditor() {
  const playlist = state.savedPlaylists.find(p => p.id === state.editingPlaylistId);
  if (!playlist) {
    closePlaylistEditor();
    return;
  }

  elements.playlistEditor.hidden = false;
  elements.editorTitle.textContent = playlist.name;

  const tracks = getTracksByIds(playlist.trackIds);

  elements.editorTrackList.innerHTML = tracks.length === 0
    ? '<div class="empty-state">이 리스트에 곡이 없습니다. 아래 목록에서 곡을 선택한 뒤 [선택한 곡 추가]를 누르세요.</div>'
    : tracks.map(track => `
      <div class="editor-track" data-track-id="${escapeHtml(track.id)}">
        <img src="${track.thumbnail}" alt="" />
        <div class="editor-track-copy">
          <strong>${escapeHtml(track.title)}</strong>
          <span>${escapeHtml(track.artist || track.channelTitle)}</span>
        </div>
        <button class="saved-playlist-action" type="button" data-action="remove" title="이 곡 빼기" aria-label="${escapeHtml(track.title)} 빼기">${ICON_DELETE}</button>
      </div>
    `).join('');

  elements.editorTrackList.querySelectorAll('[data-action="remove"]').forEach(button => {
    button.addEventListener('click', () => {
      const trackId = button.closest('.editor-track').dataset.trackId;
      playlist.trackIds = playlist.trackIds.filter(id => id !== trackId);
      refreshSavedPlaylistViews();
    });
  });
}

elements.editorAddButton.addEventListener('click', () => {
  const playlist = state.savedPlaylists.find(p => p.id === state.editingPlaylistId);
  if (!playlist) return;

  const newIds = state.selectedTrackIds.filter(id => !playlist.trackIds.includes(id));
  if (newIds.length === 0) {
    alert('아래 목록에서 추가할 곡을 먼저 선택하세요.');
    return;
  }

  playlist.trackIds.push(...newIds);
  refreshSavedPlaylistViews();
});

elements.editorCloseButton.addEventListener('click', closePlaylistEditor);

function refreshSavedPlaylistViews() {
  renderSavedPlaylists();
  if (elements.expandedPlaylistsList) renderExpandedPlaylists();
  if (state.editingPlaylistId) renderPlaylistEditor();
}

function loadSavedPlaylist(playlist) {
  state.selectedTrackIds = [...playlist.trackIds];
  state.activeMood = playlist.name;

  const filteredTracks = getTracksByIds(state.selectedTrackIds);

  state.activeTracks = getUniqueTracks(filteredTracks);
  elements.playlistTitle.textContent = playlist.name;
  state.selectedTrackId = state.activeTracks[0]?.id || null;

  render();
  elements.playlistDrawer.classList.add('active');
}

function createTrackTemplate(track) {
  const activeClass = track.id === state.selectedTrackId ? ' active' : '';
  const isSelected = state.selectedTrackIds.includes(track.id);
  const selectedClass = isSelected ? ' selected' : '';

  return `
    <article class="video-card${activeClass}" data-track-id="${escapeHtml(track.id)}">
      <div class="thumbnail-container">
        <img src="${track.thumbnail}" alt="${escapeHtml(track.title)} thumbnail" />
        <span class="video-time">${escapeHtml(track.duration)}</span>
        <div class="play-overlay">▶</div>
        <button class="select-button${selectedClass}" type="button" data-select-id="${escapeHtml(track.id)}" aria-label="선택하기">
          ${isSelected ? '✓' : '+'}
        </button>
      </div>
      <div class="video-info">
        <div class="video-text">
          <strong class="video-title">${escapeHtml(track.title)}</strong>
          <span class="video-meta">${escapeHtml(track.artist || track.channelTitle)}</span>
          <span class="video-mood">#${escapeHtml(track.mood)}</span>
        </div>
      </div>
    </article>
  `;
}

function updatePlayer(track) {
  if (!track) {
    elements.playerCover.removeAttribute('src');
    elements.playerTitle.textContent = '곡을 선택하세요';
    elements.playerArtist.textContent = '목 데이터로 재생 UI만 확인';
    if (elements.watchVideoButton) elements.watchVideoButton.style.display = 'none';
    return;
  }

  elements.playerCover.src = track.thumbnail;
  elements.playerCover.alt = `${track.title} cover`;
  elements.playerTitle.textContent = track.title;
  elements.playerArtist.textContent = track.artist || track.channelTitle;

  if (elements.watchVideoButton) {
    elements.watchVideoButton.style.display = 'inline-flex';
    elements.watchVideoButton.onclick = () => openExpandedPlayer(track);
  }

  if (elements.expandedPlayer.classList.contains('active')) {
    updateExpandedPlayerInfo(track);
  }
}

function openExpandedPlayer(track) {
  if (!track) return;
  updateExpandedPlayerInfo(track);
  elements.expandedPlayer.classList.add('active');
}

function updateExpandedPlayerInfo(track) {
  const embedUrl = `https://www.youtube.com/embed/${track.id}?autoplay=1`;
  if (elements.videoPlayer.src !== embedUrl) {
    elements.videoPlayer.src = embedUrl;
  }
  elements.expandedTitle.textContent = track.title;
  elements.expandedArtist.textContent = track.artist || track.channelTitle;
  renderExpandedQueue();
  renderExpandedPlaylists();
}

function renderExpandedPlaylists() {
  if (state.savedPlaylists.length === 0) {
    elements.expandedPlaylistsList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--muted); font-size: 0.9rem;">저장된 리스트가 없습니다.</div>';
    return;
  }

  elements.expandedPlaylistsList.innerHTML = state.savedPlaylists.map(playlist => `
    <div class="queue-item" data-playlist-id="${playlist.id}">
      <div class="queue-info">
        <strong>${escapeHtml(playlist.name)}</strong>
        <span>${playlist.trackIds.length}개의 트랙</span>
      </div>
    </div>
  `).join('');

  elements.expandedPlaylistsList.querySelectorAll('.queue-item').forEach(item => {
    item.addEventListener('click', () => {
      const playlistId = item.dataset.playlistId;
      const playlist = state.savedPlaylists.find(p => p.id === playlistId);
      if (playlist) {
        const firstTrackId = playlist.trackIds[0];
        const track = getTrackById(firstTrackId);
        if (track) {
          state.selectedTrackIds = [...playlist.trackIds];
          state.selectedTrackId = track.id;
          render();
          updatePlayer(track);
        }
      }
    });
  });
}

elements.sideTabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const tabName = button.dataset.tab;

    elements.sideTabButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    const contents = document.querySelectorAll('.side-content');
    contents.forEach(content => content.classList.remove('active'));

    if (tabName === 'queue') {
      elements.expandedQueueList.classList.add('active');
    } else {
      elements.expandedPlaylistsList.classList.add('active');
    }
  });
});

function closeExpandedPlayer() {
  elements.videoPlayer.src = '';
  elements.expandedPlayer.classList.remove('active');
}

function renderExpandedQueue() {
  const queueTracks = state.activeTracks;
  elements.expandedQueueList.innerHTML = queueTracks.map(track => `
    <div class="queue-item ${track.id === state.selectedTrackId ? 'active' : ''}" data-track-id="${track.id}">
      <img src="${track.thumbnail}" alt="">
      <div class="queue-info">
        <strong>${escapeHtml(track.title)}</strong>
        <span>${escapeHtml(track.artist || track.channelTitle)}</span>
      </div>
    </div>
  `).join('');

  elements.expandedQueueList.querySelectorAll('.queue-item').forEach(item => {
    item.addEventListener('click', () => {
      const trackId = item.dataset.trackId;
      const track = state.activeTracks.find(t => t.id === trackId);
      state.selectedTrackId = track.id;
      render();
      updatePlayer(track);
    });
  });
}

if (elements.closeExpandedPlayer) {
  elements.closeExpandedPlayer.addEventListener('click', closeExpandedPlayer);
}

function setLoadingView() {
  elements.trackList.innerHTML = '<div class="empty-state">JSON 데이터를 불러오는 중입니다.</div>';
}

function formatIsoDuration(duration) {
  if (!duration) return '-';
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return duration;

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const secondText = String(seconds).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${secondText}`;
  }
  return `${minutes}:${secondText}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function fillTrack() {
  const min = parseInt(elements.minDurationInput.value, 10);
  const max = parseInt(elements.maxDurationInput.value, 10);
  const percent1 = (min / elements.minDurationInput.max) * 100;
  const percent2 = (max / elements.maxDurationInput.max) * 100;
  elements.sliderTrack.style.background = `linear-gradient(to right, var(--line) ${percent1}% , var(--green) ${percent1}% , var(--green) ${percent2}%, var(--line) ${percent2}%)`;
}

elements.minDurationInput.addEventListener('input', (e) => {
  const minVal = parseInt(e.target.value, 10);
  const maxVal = parseInt(elements.maxDurationInput.value, 10);

  if (minVal >= maxVal) e.target.value = maxVal - 1;
  elements.minVal.textContent = e.target.value;
  fillTrack();
});

elements.maxDurationInput.addEventListener('input', (e) => {
  const maxVal = parseInt(e.target.value, 10);
  const minVal = parseInt(elements.minDurationInput.value, 10);

  if (maxVal <= minVal) e.target.value = minVal + 1;
  elements.maxVal.textContent = e.target.value;
  fillTrack();
});

fillTrack();

elements.randomButton.addEventListener('click', () => {
  if (state.playlists.length > 0) {
    const moods = state.playlists.map((p) => p.mood);
    const randomMood = moods[Math.floor(Math.random() * moods.length)];
    applyMood(randomMood);
  }
});

elements.form.addEventListener('submit', async (event) => {
  event.preventDefault();

  console.log("검색 버튼 눌림");

  state.activeMood = elements.input.value;

  await loadData();
});

elements.chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    applyMood(chip.dataset.mood);
  });
});

elements.reloadButton.addEventListener('click', loadData);

loadData();