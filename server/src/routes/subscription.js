const express = require('express');
const prisma = require('../utils/prisma');
const router = express.Router();

// GET /api/subscription/status - Get current family subscription
router.get('/status', async (req, res) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { familyId: req.familyId }
    });

    if (!subscription) {
      return res.json({ plan: 'none', status: 'none', canUse: false });
    }

    const now = new Date();
    const isTrialActive = subscription.status === 'trial' && subscription.trialEndsAt && subscription.trialEndsAt > now;
    const isSubActive = subscription.status === 'active' && (!subscription.expiresAt || subscription.expiresAt > now);
    const canUse = isTrialActive || isSubActive;

    res.json({
      plan: subscription.plan,
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt,
      expiresAt: subscription.expiresAt,
      canUse,
      daysRemaining: subscription.trialEndsAt
        ? Math.max(0, Math.ceil((subscription.trialEndsAt - now) / (1000 * 60 * 60 * 24)))
        : null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// POST /api/subscription/start-trial - Start 14-day free trial
router.post('/start-trial', async (req, res) => {
  try {
    const existing = await prisma.subscription.findUnique({
      where: { familyId: req.familyId }
    });

    if (existing) {
      return res.status(400).json({ error: 'Un abonnement existe déjà pour cette famille' });
    }

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const subscription = await prisma.subscription.create({
      data: {
        familyId: req.familyId,
        plan: 'free_trial',
        status: 'trial',
        trialEndsAt
      }
    });

    res.status(201).json({
      message: 'Essai gratuit de 14 jours activé !',
      subscription
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// POST /api/subscription/apply-promo - Apply teacher promo code
router.post('/apply-promo', async (req, res) => {
  try {
    const { promoCode } = req.body;
    if (!promoCode) {
      return res.status(400).json({ error: 'Code promo requis' });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { promoCode }
    });

    if (!teacher) {
      return res.status(404).json({ error: 'Code promo invalide' });
    }

    // Record referral
    await prisma.teacherReferral.create({
      data: {
        teacherId: teacher.id,
        familyId: req.familyId
      }
    });

    // Update teacher stats
    await prisma.teacher.update({
      where: { id: teacher.id },
      data: {
        totalReferrals: { increment: 1 }
      }
    });

    // Apply promo to subscription
    await prisma.subscription.update({
      where: { familyId: req.familyId },
      data: { promoCode }
    });

    res.json({
      message: `Code promo appliqué ! Recommandé par ${teacher.name}.`,
      teacherName: teacher.name
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

module.exports = router;
