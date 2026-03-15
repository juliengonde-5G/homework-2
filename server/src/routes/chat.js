const express = require('express');
const prisma = require('../utils/prisma');
const { chatWithAgent } = require('../services/ai');

const router = express.Router();

// POST /api/chat/message
router.post('/message', async (req, res) => {
  try {
    const { userId, message, context } = req.body;

    const user = await prisma.user.findFirst({
      where: { id: userId, familyId: req.familyId },
      include: { profile: true }
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    // Save user message
    await prisma.chatMessage.create({
      data: { userId, role: 'user', content: message, context: context?.currentSubject }
    });

    // Get recent history
    const history = await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    history.reverse();

    // Generate response
    const response = await chatWithAgent(
      user.profile || {},
      history,
      message,
      { age: user.age, ...context }
    );

    // Save assistant response
    const saved = await prisma.chatMessage.create({
      data: { userId, role: 'assistant', content: response, context: context?.currentSubject }
    });

    res.json({ id: saved.id, content: response, createdAt: saved.createdAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur du chat' });
  }
});

// GET /api/chat/history/:userId
router.get('/history/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const limit = parseInt(req.query.limit) || 50;

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

module.exports = router;
