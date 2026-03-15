const express = require('express');
const prisma = require('../utils/prisma');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/legal/privacy - Privacy policy (public)
router.get('/privacy', (req, res) => {
  res.json({
    title: 'Politique de confidentialité - Homework',
    version: '1.0',
    lastUpdated: '2026-03-15',
    content: {
      introduction: 'Homework collecte et traite des données personnelles dans le respect du RGPD (Règlement Général sur la Protection des Données).',
      dataCollected: [
        'Données d\'identification : nom, email, date de naissance',
        'Données d\'apprentissage : profil pédagogique, progression, scores',
        'Données d\'utilisation : logs de session, historique de chat',
        'Données de préférences : humeur, centres d\'intérêt'
      ],
      purpose: [
        'Personnalisation du parcours d\'apprentissage',
        'Suivi de progression et gamification',
        'Communication parent-enfant sur les résultats',
        'Amélioration continue du service'
      ],
      retention: 'Les données sont conservées pendant la durée d\'utilisation du service et supprimées dans un délai de 30 jours après une demande d\'effacement.',
      rights: [
        'Droit d\'accès (Article 15 RGPD)',
        'Droit de rectification (Article 16 RGPD)',
        'Droit à l\'effacement (Article 17 RGPD)',
        'Droit à la portabilité (Article 20 RGPD)',
        'Droit d\'opposition (Article 21 RGPD)'
      ],
      contact: 'Pour exercer vos droits, utilisez les endpoints /api/legal/erasure-request et /api/legal/export/:userId ou contactez le DPO.',
      minorProtection: 'Conformément à l\'article 8 du RGPD, le consentement pour les mineurs de moins de 16 ans doit être donné par le titulaire de l\'autorité parentale.'
    }
  });
});

// POST /api/legal/consent - Record user consent (protected)
router.post('/consent', authMiddleware, async (req, res) => {
  try {
    const { consentType, version } = req.body;

    if (!consentType || !version) {
      return res.status(400).json({ error: 'consentType et version sont requis' });
    }

    // Find or create the consent definition
    let consent = await prisma.consent.findFirst({
      where: { consentType, version }
    });

    if (!consent) {
      consent = await prisma.consent.create({
        data: {
          consentType,
          version,
          givenBy: 'user'
        }
      });
    }

    // Record user consent
    const userConsent = await prisma.userConsent.upsert({
      where: {
        userId_consentId: {
          userId: req.user.userId,
          consentId: consent.id
        }
      },
      update: {
        givenAt: new Date(),
        withdrawn: false,
        withdrawnAt: null
      },
      create: {
        userId: req.user.userId,
        consentId: consent.id
      }
    });

    // Update user consentGivenAt
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { consentGivenAt: new Date() }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'CONSENT_GIVEN',
        entity: 'UserConsent',
        entityId: userConsent.id,
        details: { consentType, version }
      }
    });

    res.status(201).json({
      message: 'Consentement enregistré',
      consent: { id: userConsent.id, consentType, version, givenAt: userConsent.givenAt }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du consentement' });
  }
});

// POST /api/legal/erasure-request - Request data deletion (RGPD Article 17)
router.post('/erasure-request', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Only parents can request erasure for their family
    if (req.user.role !== 'parent' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Seul un parent peut demander l\'effacement des données' });
    }

    // Audit log before soft-delete
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'ERASURE_REQUESTED',
        entity: 'User',
        entityId: userId,
        details: { requestedAt: new Date().toISOString() }
      }
    });

    // Soft-delete: mark user and family members
    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() }
    });

    res.json({
      message: 'Demande d\'effacement enregistrée. Vos données seront supprimées sous 30 jours conformément au RGPD.',
      requestedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la demande d\'effacement' });
  }
});

// GET /api/legal/export/:userId - Data export / portability (RGPD Article 20)
router.get('/export/:userId', authMiddleware, async (req, res) => {
  try {
    const requestedUserId = parseInt(req.params.userId);

    // Only allow exporting own data or parent exporting child data
    if (req.user.userId !== requestedUserId && req.user.role !== 'parent' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const user = await prisma.user.findUnique({
      where: { id: requestedUserId },
      include: {
        family: true,
        profile: true,
        discoverySessions: true,
        dailyPrograms: true,
        chatHistory: true,
        userBadges: { include: { badge: true } },
        userStats: true,
        userProgress: true,
        skillAssessments: true,
        dailyMoods: true,
        userConsents: { include: { consent: true } }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Verify family scope
    if (user.familyId !== req.user.familyId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'DATA_EXPORT',
        entity: 'User',
        entityId: requestedUserId,
        details: { exportedAt: new Date().toISOString() }
      }
    });

    // Remove sensitive fields
    const { passwordHash, ...exportData } = user;

    res.json({
      exportDate: new Date().toISOString(),
      format: 'JSON',
      rgpdArticle: 'Article 20 - Droit à la portabilité',
      data: exportData
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'export des données' });
  }
});

module.exports = router;
