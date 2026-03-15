const express = require('express');
const prisma = require('../utils/prisma');
const router = express.Router();

// POST /api/metacognitive/assess - Submit self-assessment after exercise
router.post('/assess', async (req, res) => {
  try {
    const { userId, sessionLogId, subject, competencyLabel, selfRating, confidence, comment } = req.body;

    if (!userId || !subject || !competencyLabel || !selfRating) {
      return res.status(400).json({ error: 'Champs requis : userId, subject, competencyLabel, selfRating' });
    }

    if (selfRating < 1 || selfRating > 4) {
      return res.status(400).json({ error: 'selfRating doit être entre 1 et 4' });
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, familyId: req.familyId }
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const assessment = await prisma.metacognitiveAssessment.create({
      data: {
        userId,
        sessionLogId: sessionLogId || null,
        subject,
        competencyLabel,
        selfRating,
        confidence: confidence || null,
        comment: comment || null
      }
    });

    // Return encouraging feedback based on self-rating
    const feedback = {
      1: 'Pas de souci ! On va revoir ça ensemble. Demander de l\'aide, c\'est déjà progresser !',
      2: 'Tu commences à comprendre ! Encore un peu de pratique et ce sera acquis.',
      3: 'Bravo, tu maîtrises bien cette compétence ! Continue comme ça.',
      4: 'Excellent ! Tu es vraiment à l\'aise. Tu pourrais même aider les autres !'
    };

    res.status(201).json({
      assessment,
      feedback: feedback[selfRating]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// GET /api/metacognitive/history/:userId - Get assessment history
router.get('/history/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const user = await prisma.user.findFirst({
      where: { id: userId, familyId: req.familyId }
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const assessments = await prisma.metacognitiveAssessment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    // Aggregate by subject
    const bySubject = {};
    for (const a of assessments) {
      if (!bySubject[a.subject]) bySubject[a.subject] = [];
      bySubject[a.subject].push(a);
    }

    res.json({ assessments, bySubject });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

module.exports = router;
