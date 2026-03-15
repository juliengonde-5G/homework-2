const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, familyId, role }
    req.familyId = decoded.familyId; // Multi-tenant shortcut
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide' });
  }
}

function parentOnly(req, res, next) {
  if (req.user.role !== 'parent' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux parents' });
  }
  next();
}

function familyScope(req, res, next) {
  // Ensures all queries are scoped to the family
  req.familyWhere = { familyId: req.user.familyId };
  next();
}

module.exports = { authMiddleware, parentOnly, familyScope };
