const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

const router = express.Router();

// ─── Validation helpers ─────────────────────────────────────────────
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function validateEmail(email) {
  return EMAIL_REGEX.test(email);
}

function validatePassword(password) {
  if (password.length < 8) return false;
  return true;
}

// POST /api/auth/parent/register - Inscription parent + famille
router.post('/parent/register', async (req, res) => {
  try {
    const { email, password, name, familyName } = req.body;

    if (!email || !password || !name || !familyName) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Format d\'email invalide' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email déjà utilisé' });
    }

    const passwordHash = await bcrypt.hash(password, 14);

    const result = await prisma.$transaction(async (tx) => {
      const family = await tx.family.create({
        data: { name: familyName }
      });

      const user = await tx.user.create({
        data: {
          familyId: family.id,
          name,
          email,
          passwordHash,
          role: 'parent'
        }
      });

      return { family, user };
    });

    const token = jwt.sign(
      { userId: result.user.id, familyId: result.family.id, role: 'parent' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: { id: result.user.id, name: result.user.name, role: 'parent' },
      family: { id: result.family.id, name: result.family.name }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'inscription' });
  }
});

// POST /api/auth/parent/login
router.post('/parent/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Format d\'email invalide' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { family: true }
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const token = jwt.sign(
      { userId: user.id, familyId: user.familyId, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, role: user.role },
      family: { id: user.family.id, name: user.family.name }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur de connexion' });
  }
});

// POST /api/auth/child/select - Sélection d'un enfant (par le parent)
router.post('/child/select', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Token manquant' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { childId } = req.body;

    const child = await prisma.user.findFirst({
      where: { id: childId, familyId: decoded.familyId, role: 'child' },
      include: { profile: true }
    });

    if (!child) {
      return res.status(404).json({ error: 'Enfant non trouvé' });
    }

    // Issue a child-scoped token
    const childToken = jwt.sign(
      { userId: child.id, familyId: decoded.familyId, role: 'child', parentId: decoded.userId },
      process.env.JWT_SECRET,
      { expiresIn: '4h' }
    );

    res.json({
      token: childToken,
      user: {
        id: child.id,
        name: child.name,
        avatar: child.avatar,
        age: child.age,
        role: 'child',
        discoveryCompleted: child.profile?.discoveryCompleted || false
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur de sélection' });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Token manquant' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { family: true, profile: true }
    });

    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    res.json({
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      age: user.age,
      role: user.role,
      family: { id: user.family.id, name: user.family.name },
      profile: user.profile,
      discoveryCompleted: user.profile?.discoveryCompleted || false
    });
  } catch (err) {
    res.status(401).json({ error: 'Token invalide' });
  }
});

module.exports = router;
