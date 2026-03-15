const express = require('express');
const googleTTS = require('google-tts-api');

const router = express.Router();

// POST /api/tts/synthesize
router.post('/synthesize', async (req, res) => {
  try {
    const { text, lang = 'fr' } = req.body;

    if (!text) return res.status(400).json({ error: 'Texte requis' });

    // google-tts-api returns base64 audio or URL
    // For long texts, split into chunks
    const maxLength = 200;
    if (text.length <= maxLength) {
      const url = googleTTS.getAudioUrl(text, {
        lang,
        slow: false,
        host: 'https://translate.google.com'
      });
      return res.json({ audioUrl: url, lang });
    }

    // Split long text into multiple audio URLs
    const allAudioUrls = googleTTS.getAllAudioUrls(text, {
      lang,
      slow: false,
      host: 'https://translate.google.com',
      splitPunct: ',.?!;:'
    });

    res.json({
      audioUrls: allAudioUrls.map(a => a.url),
      lang
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur TTS' });
  }
});

module.exports = router;
