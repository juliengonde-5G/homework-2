const express = require('express');
const prisma = require('../utils/prisma');
const crypto = require('crypto');
const router = express.Router();

// POST /api/teachers/register - Teacher self-registration
router.post('/register', async (req, res) => {
  try {
    const { name, email, school, academie } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Nom et email requis' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Email invalide' });
    }

    const existing = await prisma.teacher.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Un compte enseignant existe déjà avec cet email' });
    }

    // Generate unique promo code: LUMOS-XXXX
    const code = 'LUMOS-' + crypto.randomBytes(3).toString('hex').toUpperCase();

    const teacher = await prisma.teacher.create({
      data: { name, email, school, academie, promoCode: code }
    });

    res.status(201).json({
      message: 'Compte enseignant créé avec succès',
      teacher: {
        id: teacher.id,
        name: teacher.name,
        promoCode: teacher.promoCode,
        commissionRate: teacher.commissionRate
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création du compte enseignant' });
  }
});

// GET /api/teachers/dashboard/:email - Teacher dashboard (simple auth by email for now)
router.get('/dashboard/:email', async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { email: req.params.email },
      include: { referrals: true }
    });

    if (!teacher) {
      return res.status(404).json({ error: 'Enseignant non trouvé' });
    }

    res.json({
      name: teacher.name,
      promoCode: teacher.promoCode,
      totalReferrals: teacher.totalReferrals,
      totalEarnings: teacher.totalEarnings,
      commissionRate: teacher.commissionRate,
      referrals: teacher.referrals
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

module.exports = router;
