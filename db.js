const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new sqlite3.Database(path.join(DATA_DIR, 'lightspeed.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_login INTEGER,
    title TEXT DEFAULT 'rookie',
    score INTEGER DEFAULT 1000,
    total_games INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    win_streak INTEGER DEFAULT 0,
    max_win_streak INTEGER DEFAULT 0,
    blue_wins INTEGER DEFAULT 0,
    red_wins INTEGER DEFAULT 0,
    perfect_wins INTEGER DEFAULT 0,
    fastest_win REAL DEFAULT 99999,
    total_kills INTEGER DEFAULT 0,
    total_towers_destroyed INTEGER DEFAULT 0,
    tutorial_completed INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    achievement_id TEXT NOT NULL,
    unlocked_at INTEGER NOT NULL,
    UNIQUE(account_id, achievement_id),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS unlocked_titles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    title_id TEXT NOT NULL,
    unlocked_at INTEGER NOT NULL,
    UNIQUE(account_id, title_id),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS match_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    player_team TEXT NOT NULL,
    winner TEXT NOT NULL,
    duration REAL NOT NULL,
    score_change INTEGER NOT NULL,
    player_core_total INTEGER NOT NULL,
    ai_core_total INTEGER NOT NULL,
    played_at INTEGER NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  )`);
});

function getAccountByUsername(username) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM accounts WHERE username = ?', [username], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getAccountById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM accounts WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function createAccount(username, passwordHash, salt) {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    db.run(
      'INSERT INTO accounts (username, password_hash, salt, created_at, last_login) VALUES (?, ?, ?, ?, ?)',
      [username, passwordHash, salt, now, now],
      function (err) {
        if (err) reject(err);
        else {
          db.run('INSERT INTO unlocked_titles (account_id, title_id, unlocked_at) VALUES (?, ?, ?)', [this.lastID, 'rookie', now]);
          resolve(this.lastID);
        }
      }
    );
  });
}

function updateAccountStats(id, updates) {
  return new Promise((resolve, reject) => {
    const keys = Object.keys(updates);
    const values = keys.map(k => updates[k]);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    db.run(`UPDATE accounts SET ${setClause} WHERE id = ?`, [...values, id], function (err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getUnlockedAchievements(accountId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT achievement_id, unlocked_at FROM achievements WHERE account_id = ?', [accountId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function unlockAchievement(accountId, achievementId) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR IGNORE INTO achievements (account_id, achievement_id, unlocked_at) VALUES (?, ?, ?)',
      [accountId, achievementId, Date.now()],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      }
    );
  });
}

function getUnlockedTitles(accountId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT title_id, unlocked_at FROM unlocked_titles WHERE account_id = ?', [accountId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function unlockTitle(accountId, titleId) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR IGNORE INTO unlocked_titles (account_id, title_id, unlocked_at) VALUES (?, ?, ?)',
      [accountId, titleId, Date.now()],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      }
    );
  });
}

function recordMatch(accountId, data) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO match_history (account_id, player_team, winner, duration, score_change, player_core_total, ai_core_total, played_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [accountId, data.playerTeam, data.winner, data.duration, data.scoreChange, data.playerCoreTotal, data.aiCoreTotal, Date.now()],
      function (err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function getMatchHistory(accountId, limit = 20) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM match_history WHERE account_id = ? ORDER BY played_at DESC LIMIT ?', [accountId, limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function getLeaderboard(limit = 50) {
  return new Promise((resolve, reject) => {
    db.all('SELECT username, title, score, total_games, wins FROM accounts ORDER BY score DESC LIMIT ?', [limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

module.exports = {
  db,
  getAccountByUsername,
  getAccountById,
  createAccount,
  updateAccountStats,
  getUnlockedAchievements,
  unlockAchievement,
  getUnlockedTitles,
  unlockTitle,
  recordMatch,
  getMatchHistory,
  getLeaderboard
};
