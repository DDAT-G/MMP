console.log("내가 수정한 app.js 로드됨");


const API_CONFIG = {
  useMockData: false,
  searchUrl: '/playlist',
  nameUrl: '/playlist-name',
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
  analysis: null,
  lastSongs: [],
  loading: false,
  lastRequest: null,
  hiddenByDuration: 0,
};

const elements = {
  appShell: document.querySelector('.app-shell'),
  sidebarToggle: document.querySelector('#sidebarToggle'),
  randomButton: document.querySelector('#randomButton'),
  weatherButton: document.querySelector('#weatherButton'),
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
  youtubeExportButton: document.querySelector('#youtubeExportButton'),
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
  imageInput: document.querySelector('#imageInput'),
  imageChip: document.querySelector('#imageChip'),
  imagePreview: document.querySelector('#imagePreview'),
  imageName: document.querySelector('#imageName'),
  imageClear: document.querySelector('#imageClear'),
  aiAnalysis: document.querySelector('#aiAnalysis'),
  aiAnalysisText: document.querySelector('#aiAnalysisText'),
  refinePanel: document.querySelector('#refinePanel'),
  refineForm: document.querySelector('#refineForm'),
  refineInput: document.querySelector('#refineInput'),
  refineChips: document.querySelectorAll('[data-refine]'),
  saveDialog: document.querySelector('#saveDialog'),
  saveNameInput: document.querySelector('#saveNameInput'),
  saveDescription: document.querySelector('#saveDescription'),
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

// Backend responds with AI reasoning and recommended songs; extra supports photo/refinement.
async function fetchPlaylistData(extra = {}) {
  if (API_CONFIG.useMockData) {
    const response = await fetch(API_CONFIG.mockUrl);
    if (!response.ok) throw new Error('목 JSON 파일을 불러오지 못했습니다.');
    return response.json();
  }

  const response = await fetch(API_CONFIG.searchUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: state.activeMood,
      count: Math.min(50, Math.max(1, parseInt(elements.trackCountInput.value, 10) || 8)),
      minMinutes: parseInt(elements.minDurationInput.value, 10) || 1,
      maxMinutes: parseInt(elements.maxDurationInput.value, 10) || 120,
      ...extra,
    }),
  });

  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    throw new Error(details.message || `백엔드 응답 오류 (${response.status})`);
  }

  const data = await response.json();
  const mood = data.mood || data.userInput || state.activeMood;
  return {
    analysis: data.analysis,
    songs: data.playlist,
    playlists: [{
      mood,
      title: `${mood} 추천 플레이리스트`,
      tracks: (data.videos || []).map((video) => ({
        id: video.id,
        title: video.title,
        artist: video.artist,
        channelTitle: video.channelTitle,
        duration: video.duration,
        thumbnail: video.thumbnail,
        mood,
        reason: video.reason,
      })),
    }],
  };
}

async function loadData(extra = {}) {
  if (state.loading) return;
  state.loading = true;
  document.body.classList.add('is-loading');
  setLoadingView();
  if (!extra.current) state.lastRequest = { input: state.activeMood, extra };
  try {
    const data = await fetchPlaylistData(extra);
    state.playlists = Array.isArray(data.playlists) ? data.playlists : [];
    state.analysis = data.analysis || null;
    state.lastSongs = data.songs || [];
    state.activeMood = state.playlists[0]?.mood || state.activeMood;
  } catch (error) {
    console.warn('AI 검색 실패:', error.message);
    if (!API_CONFIG.useMockData) showToast(`AI 추천 실패: ${error.message}`);
    state.analysis = null;
    state.lastSongs = [];
    try {
      const mock = await fetch(API_CONFIG.mockUrl).then((r) => r.json());
      state.playlists = mock.playlists;
    } catch {
      state.playlists = fallbackData.playlists;
    }
  } finally {
    state.loading = false;
    document.body.classList.remove('is-loading');
  }
  cacheTracks(state.playlists);
  applyMood(state.activeMood);
  showAnalysis(state.analysis);
  elements.refinePanel.hidden = state.lastSongs.length === 0;
}

function showAnalysis(text) {
  elements.aiAnalysis.hidden = !text;
  elements.aiAnalysisText.textContent = text || '';
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 3000);
}

function isInDurationRange(track) {
  const seconds = isoToSeconds(track.duration);
  return seconds === null || (seconds >= state.minDuration * 60 && seconds <= state.maxDuration * 60);
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

  state.activeTracks = matchedPlaylist.tracks.filter(isInDurationRange);
  state.hiddenByDuration = matchedPlaylist.tracks.length - state.activeTracks.length;
  state.selectedTrackId = state.activeTracks[0]?.id || null;
  render();
}

function render() {
  elements.playSelectedButton.disabled = state.selectedTrackIds.length === 0;
  if (elements.mainSaveButton) {
    elements.mainSaveButton.disabled = state.selectedTrackIds.length === 0;
  }
  if (elements.youtubeExportButton) {
    elements.youtubeExportButton.disabled = state.selectedTrackIds.length === 0 || state.youtubeExporting;
  }
  elements.playSelectedButton.querySelector('span').textContent = state.selectedTrackIds.length > 0 ? `▶ (${state.selectedTrackIds.length})` : '▶';

  if (state.activeTracks.length === 0) {
    elements.trackList.innerHTML = state.hiddenByDuration
      ? `<div class="empty-state">영상 길이 조건에 맞는 곡이 없어요. (${state.hiddenByDuration}곡 숨겨짐)</div>`
      : '<div class="empty-state">표시할 음악 데이터가 없습니다.</div>';
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
  if (youtubeSession.ready) youtubeSession.player.setVolume(Number(volume));
});

elements.volumeButton.addEventListener('click', () => {
  if (elements.volumeSlider.value > 0) {
    lastVolume = elements.volumeSlider.value;
    elements.volumeSlider.value = 0;
  } else {
    elements.volumeSlider.value = lastVolume;
  }
  updateVolumeIcon(elements.volumeSlider.value);
  if (youtubeSession.ready) youtubeSession.player.setVolume(Number(elements.volumeSlider.value));
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

async function suggestPlaylistName(tracks) {
  if (!tracks.length) return null;
  try {
    const response = await fetch(API_CONFIG.nameUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracks: tracks.map(({ title, artist }) => ({ title, artist })) }),
    });
    return response.ok ? await response.json() : null;
  } catch { return null; }
}

let saveRequestId = 0;
const handleSavePlaylist = () => {
  if (state.selectedTrackIds.length === 0) return;

  const trackIds = [...state.selectedTrackIds];
  const selectedTracks = trackIds.map(id => trackCache.get(id)).filter(Boolean);
  const { saveDialog, saveNameInput, saveDescription } = elements;
  const requestId = ++saveRequestId;
  let edited = false;
  let description = '';

  saveNameInput.value = `내 리스트 ${state.savedPlaylists.length + 1}`;
  saveNameInput.oninput = () => { edited = true; };
  saveDescription.textContent = 'AI가 어울리는 이름을 짓는 중…';
  saveDescription.classList.add('is-pending');
  saveDialog.returnValue = '';
  saveDialog.showModal();

  suggestPlaylistName(selectedTracks).then(ai => {
    if (requestId !== saveRequestId) return;
    if (ai?.title && !edited) saveNameInput.value = ai.title;
    description = ai?.description || '';
    saveDescription.textContent = description;
    saveDescription.classList.remove('is-pending');
  });

  saveDialog.onclose = async () => {
    saveRequestId++;
    const name = saveNameInput.value.trim();
    if (saveDialog.returnValue !== 'save' || !name) return;

    const newPlaylist = {
      id: Date.now().toString(),
      name, description,
      trackIds,
      tracks: selectedTracks,
    };

    try {
      const response = await fetch('/save-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlaylist),
      });
      if (!response.ok) throw new Error('저장 API 호출 실패');
      const data = await response.json();
      state.savedPlaylists = data.playlists || [];
      renderSavedPlaylists();
      renderExpandedPlaylists();
      showToast(`'${name}' 리스트를 저장했어요.`);
    } catch (error) {
      console.error('플레이리스트 저장 오류:', error);
      alert('리스트 저장 중 오류가 발생했습니다.');
    }
  };
};

async function loadSavedPlaylists() {
  try {
    const response = await fetch('/playlists');

    if (!response.ok) {
      throw new Error('저장된 플레이리스트 불러오기 실패');
    }

    const data = await response.json();

    state.savedPlaylists = data.playlists || [];

    // 저장된 플레이리스트의 곡 정보를 trackCache에 복원
state.savedPlaylists.forEach(playlist => {
  if (!playlist.tracks) return;

  playlist.tracks.forEach(track => {
    trackCache.set(track.id, track);
  });
});

    renderSavedPlaylists();
    renderExpandedPlaylists();

    console.log('저장된 플레이리스트 불러오기 완료:', state.savedPlaylists);

  } catch (error) {
    console.error('플레이리스트 불러오기 오류:', error);
  }
}

async function updatePlaylist(playlist) {
  try {
    const response = await fetch(
      `/playlist/${playlist.id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(playlist)
      }
    );

    if (!response.ok) {
      throw new Error('플레이리스트 수정 실패');
    }

    const data = await response.json();

    state.savedPlaylists = data.playlists;

    return true;

  } catch (error) {
    console.error('플레이리스트 수정 오류:', error);
    alert('리스트 수정 중 오류가 발생했습니다.');

    return false;
  }
}

// Export the selected tracks to a private playlist on the connected YouTube account.
// This is deliberately separate from the existing MMP save/edit/playback flow.
function showYoutubeExportResult(data) {
  let panel = document.querySelector('#youtubeExportResult');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'youtubeExportResult';
    panel.setAttribute('role', 'status');
    panel.style.cssText = 'margin:12px 0;padding:14px 16px;border:1px solid var(--line,#444);border-radius:10px;';
    const header = document.querySelector('.section-header');
    if (header) header.insertAdjacentElement('afterend', panel);
    else document.querySelector('.content').prepend(panel);
  }
  panel.replaceChildren();

  const text = document.createElement('span');
  text.textContent = data.failedVideoIds?.length
    ? `YouTube 재생목록을 만들었어요. ${data.addedCount}곡 성공, ${data.failedVideoIds.length}곡 실패. `
    : `YouTube 재생목록에 ${data.addedCount}곡을 추가했어요. `;
  panel.append(text);

  const link = document.createElement('a');
  link.href = `https://www.youtube.com/playlist?list=${encodeURIComponent(data.playlistId)}`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'YouTube에서 결과 보기';
  link.style.marginLeft = '6px';
  panel.append(link);
}

if (elements.youtubeExportButton) {
  elements.youtubeExportButton.addEventListener('click', async () => {
    if (state.youtubeExporting) return;

    const tracks = getUniqueTracks(getTracksByIds(state.selectedTrackIds));
    if (tracks.length === 0) {
      showToast('먼저 내보낼 곡을 선택해 주세요.');
      return;
    }
    // Current backend export route accepts 1..20 YouTube video IDs per request.
    if (tracks.length > 20) {
      showToast('현재 YouTube 내보내기는 한 번에 최대 20곡까지 가능해요.');
      return;
    }
    if (tracks.some(track => !isYoutubeVideoId(track.id))) {
      showToast('선택한 곡 중 YouTube 영상 ID가 없는 곡이 있어요.');
      return;
    }

    state.youtubeExporting = true;
    elements.youtubeExportButton.disabled = true;
    const previousLabel = elements.youtubeExportButton.innerHTML;
    elements.youtubeExportButton.textContent = 'YouTube 연결 확인 중…';

    try {
      const statusResponse = await fetch('/auth/google/status', {
        credentials: 'include',
      });
      if (!statusResponse.ok) throw new Error('Google 연결 상태를 확인할 수 없어요.');
      const { connected } = await statusResponse.json();
      if (!connected) {
        if (window.confirm('YouTube 연결이 필요해요. Google 계정을 연결할까요?')) {
          window.location.assign('/auth/google');
        }
        return;
      }

      const title = (elements.playlistTitle.textContent || 'MMP 추천 플레이리스트').trim().slice(0, 150);
      if (!window.confirm(`선택한 ${tracks.length}곡을 YouTube 비공개 재생목록 "${title}"(으)로 내보낼까요?`)) return;

      elements.youtubeExportButton.textContent = 'YouTube로 내보내는 중…';
      const response = await fetch('/youtube/export', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          videoIds: tracks.map(track => track.id),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || `YouTube Export 오류 (${response.status})`);
      }
      if (!result.playlistId) throw new Error('생성된 재생목록 ID를 받지 못했어요.');

      showYoutubeExportResult(result);
      showToast(result.failedVideoIds?.length ? '일부 영상이 추가되지 않았어요. 결과를 확인해 주세요.' : 'YouTube로 내보내기 완료!');
    } catch (error) {
      console.error('YouTube Export 실패:', error);
      showToast(`YouTube 내보내기 실패: ${error.message}`);
    } finally {
      state.youtubeExporting = false;
      elements.youtubeExportButton.innerHTML = previousLabel;
      elements.youtubeExportButton.disabled = state.selectedTrackIds.length === 0;
    }
  });
}

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
      nameInput.addEventListener('change', async () => {
  const playlist = findPlaylist();
  if (!playlist) return;

  const value = nameInput.value.trim();

  if (!value) {
    nameInput.value = playlist.name;
    return;
  }

  const oldName = playlist.name;

  playlist.name = value;

  const success = await updatePlaylist(playlist);

  if (!success) {
    playlist.name = oldName;
    nameInput.value = oldName;
    return;
  }

  if (state.editingPlaylistId === playlist.id) {
    elements.editorTitle.textContent = value;
  }

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

    row.querySelector('[data-action="delete"]').addEventListener('click', async () => {
  const playlist = findPlaylist();

  if (!playlist) return;

  if (!confirm(`"${playlist.name}" 리스트를 삭제할까요?`)) return;

  try {
    const response = await fetch(
      `/playlist/${playlist.id}`,
      {
        method: 'DELETE'
      }
    );

    if (!response.ok) {
      throw new Error('플레이리스트 삭제 실패');
    }

    const data = await response.json();

    state.savedPlaylists = data.playlists;

    if (state.editingPlaylistId === playlist.id) {
      closePlaylistEditor();
    }

    refreshSavedPlaylistViews();

    alert('리스트가 삭제되었습니다.');

  } catch (error) {
    console.error('플레이리스트 삭제 오류:', error);
    alert('리스트 삭제 중 오류가 발생했습니다.');
  }
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
  button.addEventListener('click', async () => {
    const trackId = button.closest('.editor-track').dataset.trackId;

    const oldTrackIds = [...playlist.trackIds];

    playlist.trackIds = playlist.trackIds.filter(id => id !== trackId);

    const success = await updatePlaylist(playlist);

    if (!success) {
      playlist.trackIds = oldTrackIds;
      return;
    }

    refreshSavedPlaylistViews();
  });
});
}

elements.editorAddButton.addEventListener('click', async () => {
  const playlist = state.savedPlaylists.find(
    p => p.id === state.editingPlaylistId
  );

  if (!playlist) return;

  const newIds = state.selectedTrackIds.filter(
    id => !playlist.trackIds.includes(id)
  );

  if (newIds.length === 0) {
    alert('아래 목록에서 추가할 곡을 먼저 선택하세요.');
    return;
  }

  const oldTrackIds = [...playlist.trackIds];

  playlist.trackIds.push(...newIds);

  const success = await updatePlaylist(playlist);

  if (!success) {
    playlist.trackIds = oldTrackIds;
    return;
  }

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
        <span class="video-time">${escapeHtml(formatIsoDuration(track.duration))}</span>
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
          ${track.reason ? `<p class="video-reason">${escapeHtml(track.reason)}</p>` : ''}
        </div>
      </div>
    </article>
  `;
}

// 단일 YouTube IFrame Player를 미니 창과 확장 화면에서 공유합니다.
// 오디오 전용/숨겨진 플레이어가 되지 않도록 영상이 보이는 동안에만 재생합니다.
const youtubeSession = {
  player: null,
  ready: false,
  loadingApi: false,
  currentVideoId: null,
  pendingTrack: null,
  playbackRequest: 0,
  openAfter: 0,
};

// 한 iframe을 DOM에서 옮기거나 새로 생성하지 않고, 바깥 패널의 CSS만 전환합니다.
const miniCloseButton = document.createElement('button');
miniCloseButton.type = 'button';
miniCloseButton.className = 'player-mini-close';
miniCloseButton.textContent = '×';
miniCloseButton.title = '재생 중지 및 미니 플레이어 닫기';
miniCloseButton.setAttribute('aria-label', '미니 플레이어 닫기');
elements.expandedPlayer.querySelector('.expanded-header').appendChild(miniCloseButton);

function isVideoVisible() {
  return elements.expandedPlayer.classList.contains('active') ||
    elements.expandedPlayer.classList.contains('mini');
}

function canShowMiniPlayer() {
  // 작은 화면에서는 영상의 최소 크기와 YouTube 컨트롤을 확보하기 위해 전체 화면을 유지합니다.
  return window.innerWidth >= 520 && window.innerHeight >= 460;
}

function showExpandedVideo() {
  elements.expandedPlayer.classList.remove('mini');
  elements.expandedPlayer.classList.add('active');
  elements.closeExpandedPlayer.textContent = '▼';
  elements.closeExpandedPlayer.title = '미니 플레이어로 축소';
}

function showMiniVideo() {
  if (!canShowMiniPlayer()) return false;
  elements.expandedPlayer.classList.remove('active');
  elements.expandedPlayer.classList.add('mini');
  elements.closeExpandedPlayer.textContent = '▲';
  elements.closeExpandedPlayer.title = '크게 보기';
  return true;
}

const playbackControls = {
  previous: document.querySelector('.control-buttons button[aria-label="previous"]'),
  playPause: document.querySelector('.control-buttons button[aria-label="play"]'),
  next: document.querySelector('.control-buttons button[aria-label="next"]'),
  progress: document.querySelector('.progress-container .progress-bar'),
  elapsed: document.querySelector('.progress-container span:first-child'),
  duration: document.querySelector('.progress-container span:last-child'),
};

playbackControls.progress.style.cursor = 'pointer';
playbackControls.progress.tabIndex = 0;
playbackControls.progress.setAttribute('role', 'slider');
playbackControls.progress.setAttribute('aria-label', '재생 위치');
playbackControls.progress.setAttribute('aria-valuemin', '0');
playbackControls.progress.setAttribute('aria-valuemax', '100');
playbackControls.progress.setAttribute('aria-valuenow', '0');

function isYoutubeVideoId(id) {
  return /^[A-Za-z0-9_-]{11}$/.test(String(id || ''));
}

function selectedPlaybackTrack() {
  return state.activeTracks.find(t => t.id === state.selectedTrackId) || state.activeTracks[0] || null;
}

function secondsToClock(seconds) {
  const n = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(n / 60);
  const secs = String(n % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function setPlayPauseIcon(playing) {
  playbackControls.playPause.textContent = playing ? 'Ⅱ' : '▶';
  playbackControls.playPause.setAttribute('aria-label', playing ? 'pause' : 'play');
  playbackControls.playPause.title = playing ? '일시정지' : '재생';
}

function updatePlaybackProgress(current = 0, duration = 0) {
  const safeDuration = Math.max(0, Number(duration) || 0);
  const safeCurrent = Math.max(0, Number(current) || 0);
  const percentage = safeDuration > 0 ? Math.min(100, (safeCurrent / safeDuration) * 100) : 0;
  playbackControls.elapsed.textContent = secondsToClock(safeCurrent);
  playbackControls.duration.textContent = secondsToClock(safeDuration);
  playbackControls.progress.querySelector('div').style.width = `${percentage}%`;
  playbackControls.progress.setAttribute('aria-valuenow', String(Math.round(percentage)));
  playbackControls.progress.setAttribute('aria-valuetext', `${secondsToClock(safeCurrent)} / ${secondsToClock(safeDuration)}`);
}

function refreshProgressFromYoutube() {
  if (!youtubeSession.ready) return;
  try {
    updatePlaybackProgress(
      youtubeSession.player.getCurrentTime(),
      youtubeSession.player.getDuration()
    );
  } catch (error) {
    // 영상 전환 직후에는 재생 위치를 읽지 못할 수 있습니다.
  }
}

function ensureYoutubeIframeApi() {
  if (youtubeSession.player) return;
  if (window.YT && window.YT.Player) {
    createYoutubePlayer();
    return;
  }
  if (youtubeSession.loadingApi) return;
  youtubeSession.loadingApi = true;
  window.onYouTubeIframeAPIReady = createYoutubePlayer;
  const script = document.createElement('script');
  script.src = 'https://www.youtube.com/iframe_api';
  script.onerror = () => {
    youtubeSession.loadingApi = false;
    alert('YouTube 플레이어 API를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.');
  };
  document.head.appendChild(script);
}

function createYoutubePlayer() {
  if (youtubeSession.player) return;
  youtubeSession.player = new YT.Player('videoPlayer', {
    width: '100%',
    height: '100%',
    playerVars: { playsinline: 1, controls: 1, origin: window.location.origin },
    events: {
      onReady(event) {
        youtubeSession.ready = true;
        event.target.setVolume(Number(elements.volumeSlider.value));
        flushPendingPlayback();
      },
      onStateChange(event) {
        if (event.data === YT.PlayerState.PLAYING && !isVideoVisible()) {
          event.target.pauseVideo();
          return;
        }
        setPlayPauseIcon(event.data === YT.PlayerState.PLAYING);
        if (event.data === YT.PlayerState.ENDED) {
          moveTrack(1);
        }
        refreshProgressFromYoutube();
      },
      onError(event) {
        youtubeSession.pendingTrack = null;
        setPlayPauseIcon(false);
        console.warn('YouTube 재생 오류 코드:', event.data);
        alert('이 영상은 외부 사이트에서 재생할 수 없을 수 있습니다. 다른 곡을 선택해 주세요.');
      },
    },
  });
}

function flushPendingPlayback() {
  if (!youtubeSession.ready || !youtubeSession.pendingTrack) return;
  const request = youtubeSession.playbackRequest;
  const waitMs = Math.max(0, youtubeSession.openAfter - Date.now());
  window.setTimeout(() => {
    if (request !== youtubeSession.playbackRequest) return;
    if (!isVideoVisible()) return;
    const track = youtubeSession.pendingTrack;
    if (!track || !isYoutubeVideoId(track.id)) return;
    if (youtubeSession.currentVideoId === track.id) {
      youtubeSession.player.playVideo();
    } else {
      youtubeSession.currentVideoId = track.id;
      youtubeSession.player.loadVideoById(track.id);
      updatePlaybackProgress(0, 0);
    }
    youtubeSession.pendingTrack = null;
  }, waitMs);
}

function playYoutubeTrack(track, { expand = false } = {}) {
  if (!track) return;
  if (!isYoutubeVideoId(track.id)) {
    alert('해당 곡에 유효한 YouTube 영상 ID가 없습니다. 다른 곡을 선택해 주세요.');
    return;
  }
  const changed = state.selectedTrackId !== track.id;
  state.selectedTrackId = track.id;
  if (changed) render();
  else updatePlayer(track);

  // 일반 재생 버튼은 미니 창으로 시작하고, 확대 중이면 기존 확대 상태를 유지합니다.
  if (expand || elements.expandedPlayer.classList.contains('active') || !canShowMiniPlayer()) {
    showExpandedVideo();
  } else {
    showMiniVideo();
  }
  updateExpandedPlayerInfo(track);
  youtubeSession.pendingTrack = track;
  youtubeSession.playbackRequest++;
  // 확대 애니메이션 중에는 시청 가능한 플레이어가 표시된 뒤 재생합니다.
  youtubeSession.openAfter = Date.now() + (elements.expandedPlayer.classList.contains('active') ? 550 : 150);
  setPlayPauseIcon(false);
  ensureYoutubeIframeApi();
  flushPendingPlayback();
}

function pauseYoutubePlayback() {
  youtubeSession.pendingTrack = null;
  youtubeSession.playbackRequest++;
  if (youtubeSession.ready) youtubeSession.player.pauseVideo();
  setPlayPauseIcon(false);
}

function moveTrack(direction) {
  const tracks = state.activeTracks;
  if (!tracks.length) return;
  const currentIndex = tracks.findIndex(t => t.id === state.selectedTrackId);
  const index = currentIndex < 0 ? 0 : (currentIndex + direction + tracks.length) % tracks.length;
  playYoutubeTrack(tracks[index]);
}

function seekYoutubeToFraction(fraction) {
  if (!youtubeSession.ready) return;
  const duration = youtubeSession.player.getDuration();
  if (!duration) return;
  const clamped = Math.max(0, Math.min(1, fraction));
  youtubeSession.player.seekTo(clamped * duration, true);
  updatePlaybackProgress(clamped * duration, duration);
}

playbackControls.playPause.addEventListener('click', () => {
  const track = selectedPlaybackTrack();
  if (!track) return;
  if (youtubeSession.ready &&
      youtubeSession.player.getPlayerState() === YT.PlayerState.PLAYING &&
      youtubeSession.currentVideoId === track.id) {
    pauseYoutubePlayback();
  } else {
    playYoutubeTrack(track);
  }
});
playbackControls.previous.addEventListener('click', () => moveTrack(-1));
playbackControls.next.addEventListener('click', () => moveTrack(1));
playbackControls.progress.addEventListener('click', event => {
  const bounds = playbackControls.progress.getBoundingClientRect();
  seekYoutubeToFraction((event.clientX - bounds.left) / bounds.width);
});
playbackControls.progress.addEventListener('keydown', event => {
  if (!youtubeSession.ready) return;
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
  event.preventDefault();
  const duration = youtubeSession.player.getDuration();
  if (duration > 0) {
    const offset = event.key === 'ArrowRight' ? 5 : -5;
    youtubeSession.player.seekTo(Math.max(0, Math.min(duration, youtubeSession.player.getCurrentTime() + offset)), true);
  }
});
setInterval(refreshProgressFromYoutube, 350);
updatePlaybackProgress(0, 0);
setPlayPauseIcon(false);

function updatePlayer(track) {
  if (!track) {
    elements.playerCover.removeAttribute('src');
    elements.playerTitle.textContent = '곡을 선택하세요';
    elements.playerArtist.textContent = '재생할 곡을 선택해 주세요';
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
  if (isVideoVisible() && youtubeSession.currentVideoId === track.id) {
    updateExpandedPlayerInfo(track);
  }
}

function openExpandedPlayer(track) {
  // 이미 열려 있는 영상이면 재생 시간이나 재생 상태를 바꾸지 않고 화면 크기만 변경합니다.
  if (isVideoVisible() && youtubeSession.currentVideoId === track?.id) {
    showExpandedVideo();
    updateExpandedPlayerInfo(track);
    return;
  }
  playYoutubeTrack(track, { expand: true });
}

function updateExpandedPlayerInfo(track) {
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
          playYoutubeTrack(track);
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
  if (elements.expandedPlayer.classList.contains('active')) {
    // 같은 YouTube iframe을 그대로 사용하므로 축소 시 영상이 처음부터 재시작되지 않습니다.
    if (!showMiniVideo()) pauseYoutubePlayback();
  } else if (elements.expandedPlayer.classList.contains('mini')) {
    showExpandedVideo();
  }
}

miniCloseButton.addEventListener('click', () => {
  pauseYoutubePlayback();
  elements.expandedPlayer.classList.remove('active', 'mini');
});

// 숨겨진 탭/최소화 창에서 오디오만 계속 재생하지 않도록 방지합니다.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && isVideoVisible()) pauseYoutubePlayback();
});

window.addEventListener('resize', () => {
  if (elements.expandedPlayer.classList.contains('mini') && !canShowMiniPlayer()) {
    showExpandedVideo();
  }
});

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
      playYoutubeTrack(track);
    });
  });
}

if (elements.closeExpandedPlayer) {
  elements.closeExpandedPlayer.addEventListener('click', closeExpandedPlayer);
}

function setLoadingView() {
  elements.trackList.innerHTML = `
    <div class="loading-state" role="status">
      <span class="loading-dots"><span></span><span></span><span></span></span>
      AI가 어울리는 곡을 고르는 중이에요
    </div>
    ${'<div class="skeleton-card"><div></div><span></span><span></span></div>'.repeat(4)}
  `;
}

function isoToSeconds(duration) {
  if (!duration) return null;
  const iso = String(duration).match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (iso) return Number(iso[1] || 0) * 3600 + Number(iso[2] || 0) * 60 + Number(iso[3] || 0);
  const clock = String(duration).match(/^(\d+):(\d{2})$/);
  return clock ? Number(clock[1]) * 60 + Number(clock[2]) : null;
}

function formatIsoDuration(duration) {
  const total = isoToSeconds(duration);
  if (total === null) return '-';
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
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

// Time + weather recommendations. Location permission can be denied; falls back to time-only.
function describeWeather(code) {
  if (code === 0) return '맑음';
  if (code <= 3) return '구름 조금';
  if (code <= 48) return '안개';
  if (code <= 57) return '이슬비';
  if (code <= 67) return '비';
  if (code <= 77) return '눈';
  if (code <= 82) return '소나기';
  if (code <= 86) return '눈보라';
  return '천둥번개';
}

async function fetchWeather() {
  try {
    if (!navigator.geolocation) return null;
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, maximumAge: 1800000 });
    });
    const { latitude, longitude } = position.coords;
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`);
    if (!response.ok) return null;
    const { current } = await response.json();
    if (!current) return null;
    return `${describeWeather(current.weather_code)}, 기온 ${Math.round(current.temperature_2m)}°C`;
  } catch { return null; }
}

elements.weatherButton.addEventListener('click', async () => {
  if (state.loading) return;
  const now = new Date();
  const day = '일월화수목금토'[now.getDay()];
  const time = `지금은 ${day}요일 ${now.getHours()}시 ${now.getMinutes()}분`;
  elements.weatherButton.disabled = true;
  const weather = await fetchWeather();
  elements.weatherButton.disabled = false;
  if (weather) showToast(`현재 날씨: ${weather}`);
  state.activeMood = weather
    ? `${time}, 날씨는 ${weather}. 이 시간대와 날씨에 어울리는 노래`
    : `${time}. 이 시간대 분위기에 어울리는 노래`;
  await loadData();
});

// Photos are resized to 768px before transmission to the AI backend.
async function readImage(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  } finally { bitmap.close(); }
}

function clearImage() {
  if (elements.imagePreview.src.startsWith('blob:')) URL.revokeObjectURL(elements.imagePreview.src);
  elements.imageInput.value = '';
  elements.imageChip.hidden = true;
  elements.imagePreview.removeAttribute('src');
}

elements.imageInput.addEventListener('change', () => {
  const file = elements.imageInput.files[0];
  if (!file) return clearImage();
  if (elements.imagePreview.src.startsWith('blob:')) URL.revokeObjectURL(elements.imagePreview.src);
  elements.imagePreview.src = URL.createObjectURL(file);
  elements.imageName.textContent = file.name;
  elements.imageChip.hidden = false;
});
elements.imageClear.addEventListener('click', clearImage);

elements.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = elements.imageInput.files[0];
  const input = elements.input.value.trim();
  if (!input && !file) {
    if (!state.lastRequest) return;
    state.activeMood = state.lastRequest.input;
    return loadData(state.lastRequest.extra);
  }

  let image;
  if (file) {
    try { image = await readImage(file); }
    catch { showToast('사진을 읽을 수 없습니다. JPG/PNG로 시도해 주세요.'); return; }
  }
  state.activeMood = input || '사진 분위기';
  await loadData(image ? { image } : {});
  clearImage();
});

async function refinePlaylist(request) {
  if (!request || state.lastSongs.length === 0) return;
  state.activeMood = request;
  await loadData({ current: state.lastSongs });
  elements.refineInput.value = '';
}

elements.refineForm.addEventListener('submit', (event) => {
  event.preventDefault();
  refinePlaylist(elements.refineInput.value.trim());
});
elements.refineChips.forEach(chip => {
  chip.addEventListener('click', () => refinePlaylist(chip.dataset.refine));
});

// Duration slider also filters currently displayed playlist.
[elements.minDurationInput, elements.maxDurationInput].forEach(input => {
  input.addEventListener('change', () => applyMood(state.activeMood));
});

elements.chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    state.activeMood = chip.dataset.mood;
    loadData();
  });
});

elements.reloadButton.addEventListener('click', loadData);
loadData();
loadSavedPlaylists();
