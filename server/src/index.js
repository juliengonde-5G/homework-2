require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// ─── Validate required env vars ─────────────────────────────────────
const requiredEnv = ['JWT_SECRET', 'DATABASE_URL'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

if (process.env.JWT_SECRET === 'change-me-in-production') {
  console.error('FATAL: JWT_SECRET must be changed from the default value');
  process.exit(1);
}

const authRoutes = require('./routes/auth');
const familyRoutes = require('./routes/family');
const discoveryRoutes = require('./routes/discovery');
const pathwayRoutes = require('./routes/pathways');
const programRoutes = require('./routes/program');
const contentRoutes = require('./routes/content');
const chatRoutes = require('./routes/chat');
const ttsRoutes = require('./routes/tts');
const adminRoutes = require('./routes/admin');
const homeRoutes = require('./routes/home');
const legalRoutes = require('./routes/legal');

const { authMiddleware } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security middleware ────────────────────────────────────────────
app.use(helmet());

// ─── Global rate limiting: 100 requests per minute ──────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard' }
});
app.use(globalLimiter);

// ─── Auth-specific rate limiters ────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion, réessayez dans 15 minutes' }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives d\'inscription, réessayez dans 1 heure' }
});

// ─── General middleware ─────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// ─── Public routes ──────────────────────────────────────────────────
app.use('/api/auth/parent/login', loginLimiter);
app.use('/api/auth/child/select', loginLimiter);
app.use('/api/auth/parent/register', registerLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/legal', legalRoutes);

// ─── Protected routes ───────────────────────────────────────────────
app.use('/api/family', authMiddleware, familyRoutes);
app.use('/api/discovery', authMiddleware, discoveryRoutes);
app.use('/api/pathways', authMiddleware, pathwayRoutes);
app.use('/api/program', authMiddleware, programRoutes);
app.use('/api/content', authMiddleware, contentRoutes);
app.use('/api/chat', authMiddleware, chatRoutes);
app.use('/api/tts', authMiddleware, ttsRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/api/home', authMiddleware, homeRoutes);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Erreur interne' : err.message
  });
});

app.listen(PORT, () => {
  console.log(`Homework API running on port ${PORT}`);
});

module.exports = app;
