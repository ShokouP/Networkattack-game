const bcrypt = require('bcryptjs');
const db = require('./db');

const GAME_TIME_LIMIT = 300;
const CORE_HP = 3600;

const ACHIEVEMENTS = [
  { id: 'first_blood', name: '初出茅庐', desc: '完成第一场对局', category: 'basic', condition: s => s.totalGames >= 1, reward: 0 },
  { id: 'first_win', name: '首胜', desc: '获得第一场胜利', category: 'basic', condition: s => s.wins >= 1, reward: 100 },
  { id: 'tutorial_grad', name: '安全培训结业', desc: '完成教学模式', category: 'basic', condition: s => s.tutorialCompleted, reward: 150 },
  { id: 'win_streak_3', name: '三连胜', desc: '连续获胜3场', category: 'streak', condition: s => s.maxWinStreak >= 3, reward: 200 },
  { id: 'win_streak_5', name: '五连胜', desc: '连续获胜5场', category: 'streak', condition: s => s.maxWinStreak >= 5, reward: 500 },
  { id: 'win_streak_10', name: '十连胜', desc: '连续获胜10场', category: 'streak', condition: s => s.maxWinStreak >= 10, reward: 1000 },
  { id: 'defender_5', name: '铜墙铁壁', desc: '蓝队获胜5场', category: 'role', condition: s => s.blueWins >= 5, reward: 200 },
  { id: 'defender_20', name: '固若金汤', desc: '蓝队获胜20场', category: 'role', condition: s => s.blueWins >= 20, reward: 500 },
  { id: 'attacker_5', name: '锋芒毕露', desc: '红队获胜5场', category: 'role', condition: s => s.redWins >= 5, reward: 200 },
  { id: 'attacker_20', name: '锐不可当', desc: '红队获胜20场', category: 'role', condition: s => s.redWins >= 20, reward: 500 },
  { id: 'perfect_win', name: '清场', desc: '以敌方核心全灭获胜', category: 'performance', condition: s => s.perfectWins >= 1, reward: 300 },
  { id: 'perfect_win_5', name: '横扫千军', desc: '清场获胜5次', category: 'performance', condition: s => s.perfectWins >= 5, reward: 800 },
  { id: 'speed_win', name: '速胜', desc: '120秒内获胜', category: 'performance', condition: s => s.fastestWin <= 120, reward: 400 },
  { id: 'speed_win_60', name: '闪电战', desc: '60秒内获胜', category: 'performance', condition: s => s.fastestWin <= 60, reward: 800 },
  { id: 'veteran', name: '老兵', desc: '完成50场对局', category: 'milestone', condition: s => s.totalGames >= 50, reward: 500 },
  { id: 'master', name: '大师', desc: '完成100场对局', category: 'milestone', condition: s => s.totalGames >= 100, reward: 1000 },
  { id: 'score_1500', name: '进阶', desc: '积分达到1500', category: 'milestone', condition: (s, a) => a.score >= 1500, reward: 300 },
  { id: 'score_2000', name: '精英', desc: '积分达到2000', category: 'milestone', condition: (s, a) => a.score >= 2000, reward: 600 },
  { id: 'score_2500', name: '传说', desc: '积分达到2500', category: 'milestone', condition: (s, a) => a.score >= 2500, reward: 1000 }
];

const TITLES = [
  { id: 'rookie', name: '见习工程师', color: '#7eb896', unlock: 'default' },
  { id: 'first_win', name: '安全卫士', color: '#3cf58b', unlock: 'achievement:first_win' },
  { id: 'defender_5', name: '防火墙管理员', color: '#3c8cf5', unlock: 'achievement:defender_5' },
  { id: 'defender_20', name: 'SOC指挥官', color: '#2050d0', unlock: 'achievement:defender_20' },
  { id: 'attacker_5', name: '渗透测试员', color: '#e04040', unlock: 'achievement:attacker_5' },
  { id: 'attacker_20', name: '红队领袖', color: '#d02020', unlock: 'achievement:attacker_20' },
  { id: 'win_streak_3', name: '连胜高手', color: '#f0c030', unlock: 'achievement:win_streak_3' },
  { id: 'win_streak_5', name: '不败神话', color: '#e0b040', unlock: 'achievement:win_streak_5' },
  { id: 'win_streak_10', name: '光速传奇', color: '#ff6b35', unlock: 'achievement:win_streak_10' },
  { id: 'perfect_win', name: '清道夫', color: '#c030c0', unlock: 'achievement:perfect_win' },
  { id: 'speed_win', name: '闪电侠', color: '#70c0f0', unlock: 'achievement:speed_win' },
  { id: 'veteran', name: '资深分析师', color: '#a0c0aa', unlock: 'achievement:veteran' },
  { id: 'master', name: '光速城守护者', color: '#3cf58b', unlock: 'achievement:master' },
  { id: 'score_2000', name: '精英黑客', color: '#ff6b6b', unlock: 'achievement:score_2000' },
  { id: 'score_2500', name: '光速之神', color: '#ffd700', unlock: 'achievement:score_2500' }
];

function hashPassword(password) {
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);
  return { hash, salt };
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function calculateScoreChange(playerWon, duration, playerTeam, aiCoreTotal, playerScore, playerCoreTotal) {
  const K = 32;
  let change = playerWon ? K : -K;
  let multiplier = 1.0;

  if (playerWon) {
    const timeRatio = Math.max(0, 1 - duration / GAME_TIME_LIMIT);
    multiplier += timeRatio * 0.5;
    if (aiCoreTotal <= 0) multiplier += 0.3;
    if (playerTeam === 'blue') multiplier += 0.1;
  } else {
    if (duration >= GAME_TIME_LIMIT && Math.abs(playerCoreTotal - aiCoreTotal) < CORE_HP * 0.5) {
      multiplier = 0.5;
    }
  }

  if (!playerWon && playerScore < 800) multiplier *= 0.5;
  if (playerWon && playerScore > 2000) multiplier *= 0.8;

  return Math.round(change * multiplier);
}

function buildStats(account) {
  return {
    totalGames: account.total_games,
    wins: account.wins,
    losses: account.losses,
    draws: account.draws,
    winStreak: account.win_streak,
    maxWinStreak: account.max_win_streak,
    blueWins: account.blue_wins,
    redWins: account.red_wins,
    perfectWins: account.perfect_wins,
    fastestWin: account.fastest_win,
    totalKills: account.total_kills,
    totalTowersDestroyed: account.total_towers_destroyed,
    tutorialCompleted: Boolean(account.tutorial_completed)
  };
}

async function processGameEnd(accountId, data) {
  const account = await db.getAccountById(accountId);
  if (!account) throw new Error('Account not found');

  const stats = buildStats(account);
  const playerWon = data.winner === data.playerTeam;
  const isDraw = data.winner === 'draw';

  let scoreChange = 0;
  let updates = {};

  if (!data.tutorial) {
    stats.totalGames += 1;
    if (isDraw) {
      stats.draws += 1;
      stats.winStreak = 0;
    } else if (playerWon) {
      stats.wins += 1;
      stats.winStreak += 1;
      stats.maxWinStreak = Math.max(stats.maxWinStreak, stats.winStreak);
      if (data.playerTeam === 'blue') stats.blueWins += 1;
      else stats.redWins += 1;
      if (data.aiCoreTotal <= 0) stats.perfectWins += 1;
      if (data.duration < stats.fastestWin) stats.fastestWin = data.duration;
    } else {
      stats.losses += 1;
      stats.winStreak = 0;
    }

    scoreChange = calculateScoreChange(
      playerWon && !isDraw,
      data.duration,
      data.playerTeam,
      data.aiCoreTotal,
      account.score,
      data.playerCoreTotal
    );

    const newScore = Math.max(0, account.score + scoreChange);

    updates = {
      score: newScore,
      total_games: stats.totalGames,
      wins: stats.wins,
      losses: stats.losses,
      draws: stats.draws,
      win_streak: stats.winStreak,
      max_win_streak: stats.maxWinStreak,
      blue_wins: stats.blueWins,
      red_wins: stats.redWins,
      perfect_wins: stats.perfectWins,
      fastest_win: stats.fastestWin,
      total_kills: stats.totalKills + (data.totalKills || 0),
      total_towers_destroyed: stats.totalTowersDestroyed + (data.towersDestroyed || 0),
      last_login: Date.now()
    };
  } else {
    updates = {
      tutorial_completed: 1,
      last_login: Date.now()
    };
    stats.tutorialCompleted = true;
  }

  await db.updateAccountStats(accountId, updates);

  const unlockedAchievements = await checkAchievements(accountId, stats, { score: updates.score || account.score });
  const newTitles = [];
  for (const ach of unlockedAchievements) {
    const title = TITLES.find(t => t.unlock === `achievement:${ach.id}`);
    if (title) {
      const wasNew = await db.unlockTitle(accountId, title.id);
      if (wasNew) newTitles.push(title);
    }
  }

  if (!data.tutorial) {
    await db.recordMatch(accountId, {
      playerTeam: data.playerTeam,
      winner: data.winner,
      duration: data.duration,
      scoreChange,
      playerCoreTotal: data.playerCoreTotal,
      aiCoreTotal: data.aiCoreTotal
    });
  }

  const updatedAccount = await db.getAccountById(accountId);
  return {
    scoreChange,
    newScore: updatedAccount.score,
    newAchievements: unlockedAchievements,
    newTitles,
    stats: buildStats(updatedAccount)
  };
}

async function checkAchievements(accountId, stats, account) {
  const already = await db.getUnlockedAchievements(accountId);
  const unlockedIds = new Set(already.map(a => a.achievement_id));
  const newly = [];

  for (const ach of ACHIEVEMENTS) {
    if (unlockedIds.has(ach.id)) continue;
    const ok = ach.condition(stats, account);
    if (ok) {
      const wasNew = await db.unlockAchievement(accountId, ach.id);
      if (wasNew) newly.push(ach);
    }
  }
  return newly;
}

async function getFullAccount(accountId) {
  const account = await db.getAccountById(accountId);
  if (!account) return null;
  const achievements = await db.getUnlockedAchievements(accountId);
  const titles = await db.getUnlockedTitles(accountId);
  const history = await db.getMatchHistory(accountId, 10);
  return {
    id: account.id,
    username: account.username,
    title: account.title,
    score: account.score,
    stats: buildStats(account),
    achievements: achievements.map(a => a.achievement_id),
    titles: titles.map(t => t.title_id),
    history: history.map(h => ({
      playerTeam: h.player_team,
      winner: h.winner,
      duration: h.duration,
      scoreChange: h.score_change,
      playerCoreTotal: h.player_core_total,
      aiCoreTotal: h.ai_core_total,
      playedAt: h.played_at
    }))
  };
}

async function setTitle(accountId, titleId) {
  const account = await db.getAccountById(accountId);
  if (!account) throw new Error('Account not found');
  const unlocked = await db.getUnlockedTitles(accountId);
  if (!unlocked.some(t => t.title_id === titleId)) {
    throw new Error('Title not unlocked');
  }
  if (!TITLES.some(t => t.id === titleId)) {
    throw new Error('Invalid title');
  }
  await db.updateAccountStats(accountId, { title: titleId });
  return { title: titleId };
}

module.exports = {
  ACHIEVEMENTS,
  TITLES,
  hashPassword,
  verifyPassword,
  calculateScoreChange,
  processGameEnd,
  getFullAccount,
  setTitle
};
