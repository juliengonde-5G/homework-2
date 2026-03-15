const express = require('express');
const prisma = require('../utils/prisma');
const { parentOnly } = require('../middleware/auth');

const router = express.Router();

router.use(parentOnly);

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const children = await prisma.user.findMany({
      where: { familyId: req.familyId, role: 'child' },
      include: {
        userStats: true,
        profile: true,
        pathway: true,
        sessionsLog: { orderBy: { startedAt: 'desc' }, take: 7 },
        userProgress: { orderBy: { lastAt: 'desc' }, take: 20 }
      }
    });

    const dashboard = children.map(child => {
      const recentSessions = child.sessionsLog || [];
      const totalMinutes = recentSessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

      // Find subjects with low scores (difficulties)
      const difficulties = (child.userProgress || [])
        .filter(p => p.score < 50)
        .map(p => ({ subject: p.subject, score: p.score }));

      // Find subjects with high scores (strengths)
      const strengths = (child.userProgress || [])
        .filter(p => p.score >= 70)
        .map(p => ({ subject: p.subject, score: p.score }));

      return {
        id: child.id,
        name: child.name,
        avatar: child.avatar,
        age: child.age,
        profile: child.profile ? {
          profileType: child.profile.profileType,
          discoveryCompleted: child.profile.discoveryCompleted
        } : null,
        pathway: child.pathway ? {
          type: child.pathway.type,
          status: child.pathway.status,
          projectTheme: child.pathway.projectTheme
        } : null,
        stats: child.userStats ? {
          level: child.userStats.level,
          xp: child.userStats.xp,
          currentStreak: child.userStats.currentStreak,
          longestStreak: child.userStats.longestStreak,
          totalMinutes: child.userStats.totalMinutes,
          totalSessions: child.userStats.totalSessions
        } : null,
        recentMinutes: totalMinutes,
        difficulties,
        strengths,
        sessionsThisWeek: recentSessions.length
      };
    });

    res.json(dashboard);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur dashboard' });
  }
});

// GET /api/admin/profiles/:userId
router.get('/profiles/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const user = await prisma.user.findFirst({
      where: { id: userId, familyId: req.familyId },
      include: {
        profile: { include: { history: { orderBy: { createdAt: 'desc' } } } },
        pathway: true
      }
    });

    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    res.json({ user, profile: user.profile, pathway: user.pathway });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// PUT /api/admin/profiles/:userId
router.put('/profiles/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { changes, reason } = req.body;

    const profile = await prisma.profile.findFirst({
      where: { userId, user: { familyId: req.familyId } }
    });
    if (!profile) return res.status(404).json({ error: 'Profil non trouvé' });

    // Historize the change
    await prisma.profileHistory.create({
      data: {
        profileId: profile.id,
        changedBy: req.user.userId,
        changes,
        reason: reason || null
      }
    });

    // Apply the changes
    const updated = await prisma.profile.update({
      where: { id: profile.id },
      data: changes
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur de modification' });
  }
});

// GET /api/admin/chat-history/:userId
router.get('/chat-history/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const limit = parseInt(req.query.limit) || 100;

    const messages = await prisma.chatMessage.findMany({
      where: { userId, user: { familyId: req.familyId } },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    res.json(messages.reverse());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// GET /api/admin/analytics
router.get('/analytics', async (req, res) => {
  try {
    const children = await prisma.user.findMany({
      where: { familyId: req.familyId, role: 'child' },
      include: {
        sessionsLog: true,
        userProgress: true,
        dailyMoods: { orderBy: { date: 'desc' }, take: 30 },
        userStats: true
      }
    });

    const analytics = children.map(child => {
      const sessions = child.sessionsLog || [];
      const moods = child.dailyMoods || [];
      const progress = child.userProgress || [];

      // Average session duration
      const avgDuration = sessions.length
        ? sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0) / sessions.length
        : 0;

      // Subject performance
      const subjectPerf = {};
      for (const p of progress) {
        if (!subjectPerf[p.subject]) {
          subjectPerf[p.subject] = { totalScore: 0, count: 0 };
        }
        subjectPerf[p.subject].totalScore += p.score;
        subjectPerf[p.subject].count += 1;
      }

      const subjects = Object.entries(subjectPerf).map(([subject, data]) => ({
        subject,
        averageScore: Math.round(data.totalScore / data.count),
        attempts: data.count
      }));

      // Mood trend
      const moodTrend = moods.slice(0, 7).map(m => ({
        date: m.date,
        mood: m.mood
      }));

      return {
        childId: child.id,
        childName: child.name,
        avgDuration: Math.round(avgDuration),
        totalSessions: sessions.length,
        subjects,
        moodTrend,
        streak: child.userStats?.currentStreak || 0
      };
    });

    res.json(analytics);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur analytics' });
  }
});

module.exports = router;
