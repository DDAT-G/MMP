
const Database = require('better-sqlite3');
const path = require('path');

// SQLite 데이터베이스 연결
const db = new Database(path.join(__dirname, 'mmp.db'));

// 데이터베이스 설정
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 테이블 생성
db.exec(`
  CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS playlist_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT,
    position INTEGER NOT NULL,
    track_data TEXT,
    FOREIGN KEY (playlist_id)
      REFERENCES playlists(id)
      ON DELETE CASCADE
  );
`);

module.exports = db;
