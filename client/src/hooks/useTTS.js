import { useState, useCallback, useRef } from 'react';
import { ttsAPI } from '../services/api';

const LANG_VOICES = {
  fr: 'fr-FR',
  en: 'en-GB',
  es: 'es-ES',
  de: 'de-DE',
};

export function useTTS() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLang, setCurrentLang] = useState('fr');
  const audioRef = useRef(null);
  const utteranceRef = useRef(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
  }, []);

  const speak = useCallback(async (text, lang = 'fr') => {
    stop();
    setCurrentLang(lang);
    setIsPlaying(true);

    // Try Web Speech API first (better for real-time)
    if ('speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = LANG_VOICES[lang] || LANG_VOICES.fr;
        utterance.rate = 0.9;
        utterance.pitch = 1.0;

        // Try to find a voice for this language
        const voices = window.speechSynthesis.getVoices();
        const langVoice = voices.find(v => v.lang.startsWith(lang));
        if (langVoice) utterance.voice = langVoice;

        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = () => setIsPlaying(false);

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        return;
      } catch {
        // Fall through to google-tts
      }
    }

    // Fallback: google-tts via API
    try {
      const res = await ttsAPI.synthesize({ text, lang });
      const urls = res.data.audioUrls || [res.data.audioUrl];

      for (const url of urls) {
        await new Promise((resolve, reject) => {
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = resolve;
          audio.onerror = reject;
          audio.play();
        });
      }
    } catch (err) {
      console.error('TTS error:', err);
    } finally {
      setIsPlaying(false);
    }
  }, [stop]);

  return { speak, stop, isPlaying, currentLang };
}
