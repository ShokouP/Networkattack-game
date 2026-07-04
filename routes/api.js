const express = require('express');
const { signToken, authMiddleware } = require('../auth');
const { hashPassword, verifyPassword, processGameEnd, getFullAccount, setTitle } = require('../account');
const db = require('../db');

const router = express.Router();

router.post('/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    if (username.length < 3 || username.length > 12) {
      return res.status(400).json({ error: 'Username must be 3-12 characters' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await db.getAccountByUsername(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const { hash, salt } = hashPassword(password);
    const accountId = await db.createAccount(username, hash, salt);
    const token = signToken({ accountId, username });

    return res.json({ token, account: await getFullAccount(accountId) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const account = await db.getAccountByUsername(username);
    if (!account) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = verifyPassword(password, account.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await db.updateAccountStats(account.id, { last_login: Date.now() });
    const token = signToken({ accountId: account.id, username: account.username });

    return res.json({ token, account: await getFullAccount(account.id) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/account', authMiddleware, async (req, res) => {
  try {
    const account = await getFullAccount(req.accountId);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    return res.json(account);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load account' });
  }
});

router.post('/account/title', authMiddleware, async (req, res) => {
  try {
    const { titleId } = req.body || {};
    const result = await setTitle(req.accountId, titleId);
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
});

router.post('/game/end', authMiddleware, async (req, res) => {
  try {
    const data = req.body || {};
    if (!data.playerTeam || !['blue', 'red'].includes(data.playerTeam)) {
      return res.status(400).json({ error: 'Invalid playerTeam' });
    }
    if (!data.winner || !['blue', 'red', 'draw'].includes(data.winner)) {
      return res.status(400).json({ error: 'Invalid winner' });
    }
    if (typeof data.duration !== 'number' || data.duration < 0 || data.duration > 3600) {
      return res.status(400).json({ error: 'Invalid duration' });
    }
    if (typeof data.playerCoreTotal !== 'number' || typeof data.aiCoreTotal !== 'number') {
      return res.status(400).json({ error: 'Invalid core totals' });
    }

    const result = await processGameEnd(req.accountId, data);
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to process game end' });
  }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const rows = await db.getLeaderboard(50);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

module.exports = router;
