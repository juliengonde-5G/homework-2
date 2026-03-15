require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

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

const { authMiddleware } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
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
  console.log(`🚀 Homework API running on port ${PORT}`);
});

module.exports = app;
