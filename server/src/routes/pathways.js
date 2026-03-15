const express = require('express');
const prisma = require('../utils/prisma');

const router = express.Router();

// POST /api/pathways - Create pathway
router.post('/', async (req, res) => {
  try {
    const { userId, type, targetSubjects, projectTheme, careerFocus } = req.body;

    const user = await prisma.user.findFirst({
      where: { id: userId, familyId: req.familyId }
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const pathway = await prisma.pathway.upsert({
      where: { userId },
      create: {
        userId,
        type,
        targetSubjects: targetSubjects || null,
        projectTheme: projectTheme || null,
        careerFocus: careerFocus || null,
        status: 'active'
      },
      update: {
        type,
        targetSubjects: targetSubjects || null,
        projectTheme: projectTheme || null,
        careerFocus: careerFocus || null,
        status: 'active'
      }
    });

    res.json(pathway);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// GET /api/pathways/:userId
router.get('/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const pathway = await prisma.pathway.findFirst({
      where: { userId, user: { familyId: req.familyId } }
    });

    if (!pathway) return res.status(404).json({ error: 'Parcours non trouvé' });
    res.json(pathway);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// PUT /api/pathways/:id
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { type, targetSubjects, projectTheme, careerFocus, status } = req.body;

    const pathway = await prisma.pathway.findFirst({
      where: { id, user: { familyId: req.familyId } }
    });
    if (!pathway) return res.status(404).json({ error: 'Parcours non trouvé' });

    const updated = await prisma.pathway.update({
      where: { id },
      data: {
        ...(type && { type }),
        ...(targetSubjects !== undefined && { targetSubjects }),
        ...(projectTheme !== undefined && { projectTheme }),
        ...(careerFocus !== undefined && { careerFocus }),
        ...(status && { status })
      }
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

module.exports = router;
