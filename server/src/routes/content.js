const express = require('express');
const prisma = require('../utils/prisma');
const { generateLesson, generateExercises } = require('../services/ai');

const router = express.Router();

// POST /api/content/generate-lesson
router.post('/generate-lesson', async (req, res) => {
  try {
    const { userId, subject, competencyLabel, context } = req.body;

    const user = await prisma.user.findFirst({
      where: { id: userId, familyId: req.familyId },
      include: { profile: true }
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const lesson = await generateLesson(
      user.profile || {},
      subject,
      competencyLabel,
      { age: user.age, context }
    );

    // Cache the generated content
    const saved = await prisma.generatedContent.create({
      data: {
        userId,
        subject,
        contentType: 'lesson',
        content: lesson,
        language: detectLanguage(subject)
      }
    });

    res.json({ id: saved.id, ...lesson, language: saved.language });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur de génération' });
  }
});

// POST /api/content/generate-exercises
router.post('/generate-exercises', async (req, res) => {
  try {
    const { userId, subject, competencyLabel } = req.body;

    const user = await prisma.user.findFirst({
      where: { id: userId, familyId: req.familyId },
      include: { profile: true }
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const exercises = await generateExercises(
      user.profile || {},
      subject,
      competencyLabel,
      { age: user.age }
    );

    const saved = await prisma.generatedContent.create({
      data: {
        userId,
        subject,
        contentType: 'exercise',
        content: exercises,
        language: detectLanguage(subject)
      }
    });

    res.json({ id: saved.id, ...exercises });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur de génération' });
  }
});

// GET /api/content/lesson/:id
router.get('/lesson/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const content = await prisma.generatedContent.findFirst({
      where: { id, user: { familyId: req.familyId } }
    });

    if (!content) return res.status(404).json({ error: 'Contenu non trouvé' });
    res.json({ id: content.id, ...content.content, language: content.language });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

function detectLanguage(subject) {
  const s = subject.toLowerCase();
  if (s.includes('anglais') || s.includes('english')) return 'en';
  if (s.includes('espagnol') || s.includes('spanish')) return 'es';
  if (s.includes('allemand') || s.includes('german')) return 'de';
  return 'fr';
}

module.exports = router;
