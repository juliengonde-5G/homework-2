const express = require('express');
const prisma = require('../utils/prisma');
const { parentOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/family/users - Liste des jeunes de la famille
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { familyId: req.familyId, role: 'child' },
      include: { profile: true, pathway: true, userStats: true },
      orderBy: { createdAt: 'asc' }
    });

    res.json(users.map(u => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar,
      age: u.age,
      birthday: u.birthday,
      discoveryCompleted: u.profile?.discoveryCompleted || false,
      pathwayType: u.pathway?.type || null,
      stats: u.userStats ? {
        level: u.userStats.level,
        xp: u.userStats.xp,
        currentStreak: u.userStats.currentStreak
      } : null
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur de récupération' });
  }
});

// POST /api/family/users - Créer un jeune
router.post('/users', parentOnly, async (req, res) => {
  try {
    const { name, age, avatar, birthday } = req.body;

    if (!name || !age) {
      return res.status(400).json({ error: 'Nom et âge requis' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          familyId: req.familyId,
          name,
          age,
          avatar: avatar || '🧑‍🎓',
          birthday: birthday ? new Date(birthday) : null,
          role: 'child'
        }
      });

      const profile = await tx.profile.create({
        data: { userId: user.id }
      });

      const stats = await tx.userStats.create({
        data: { userId: user.id }
      });

      return { user, profile, stats };
    });

    res.status(201).json({
      id: result.user.id,
      name: result.user.name,
      avatar: result.user.avatar,
      age: result.user.age,
      discoveryCompleted: false
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur de création' });
  }
});

// GET /api/family/users/:id
router.get('/users/:id', async (req, res) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: parseInt(req.params.id), familyId: req.familyId },
      include: { profile: true, pathway: true, userStats: true }
    });

    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

module.exports = router;
