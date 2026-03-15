const express = require('express');
const prisma = require('../utils/prisma');
const { generateDailyProgram } = require('../services/ai');

const router = express.Router();

// GET /api/program/today/:userId
router.get('/today/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const user = await prisma.user.findFirst({
      where: { id: userId, familyId: req.familyId },
      include: { profile: true, pathway: true }
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    if (!user.pathway) return res.status(400).json({ error: 'Aucun parcours actif' });

    // Check if program already exists for today
    let program = await prisma.dailyProgram.findUnique({
      where: { userId_date: { userId, date: today } }
    });

    if (!program) {
      // Get progress to inform generation
      const progress = await prisma.userProgress.findMany({
        where: { userId },
        orderBy: { lastAt: 'desc' },
        take: 20
      });

      const generated = await generateDailyProgram(
        user.profile || {},
        user.pathway,
        progress.map(p => ({ subject: p.subject, score: p.score, attempts: p.attempts })),
        { age: user.age }
      );

      program = await prisma.dailyProgram.create({
        data: {
          userId,
          date: today,
          blocks: generated.blocks || [],
          status: 'pending'
        }
      });

      program._encouragement = generated.encouragement;
    }

    res.json({
      id: program.id,
      date: program.date,
      blocks: program.blocks,
      moodCheck: program.moodCheck,
      status: program.status,
      encouragement: program._encouragement || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur de génération du programme' });
  }
});

// POST /api/program/complete-block
router.post('/complete-block', async (req, res) => {
  try {
    const { programId, blockId, answers, score } = req.body;

    const program = await prisma.dailyProgram.findFirst({
      where: { id: programId, user: { familyId: req.familyId } }
    });
    if (!program) return res.status(404).json({ error: 'Programme non trouvé' });

    // Update block completion
    const blocks = Array.isArray(program.blocks) ? program.blocks : [];
    const updatedBlocks = blocks.map(b =>
      b.id === blockId ? { ...b, completed: true, score, answeredAt: new Date() } : b
    );

    const allCompleted = updatedBlocks.every(b => b.completed);

    await prisma.dailyProgram.update({
      where: { id: programId },
      data: {
        blocks: updatedBlocks,
        status: allCompleted ? 'completed' : 'in_progress'
      }
    });

    // Update user progress if exercise
    const block = blocks.find(b => b.id === blockId);
    if (block && block.type === 'exercise' && score !== undefined) {
      await prisma.userProgress.upsert({
        where: {
          userId_subject_competencyId: {
            userId: program.userId,
            subject: block.subject,
            competencyId: block.competencyId || 0
          }
        },
        create: {
          userId: program.userId,
          subject: block.subject,
          competencyId: block.competencyId || null,
          score,
          attempts: 1
        },
        update: {
          score: { set: score },
          attempts: { increment: 1 },
          lastAt: new Date()
        }
      });
    }

    // Update user stats
    await prisma.userStats.update({
      where: { userId: program.userId },
      data: {
        xp: { increment: score ? Math.round(score / 10) : 5 }
      }
    });

    res.json({ success: true, allCompleted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// POST /api/program/mood
router.post('/mood', async (req, res) => {
  try {
    const { userId, mood, note } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.dailyMood.upsert({
      where: { userId_date: { userId, date: today } },
      create: { userId, date: today, mood, note },
      update: { mood, note }
    });

    // Also update today's program
    await prisma.dailyProgram.updateMany({
      where: { userId, date: today },
      data: { moodCheck: { mood, note, answeredAt: new Date() } }
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

module.exports = router;
