import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { homeAPI, programAPI } from '../services/api';

const moodOptions = [
  { value: 'super', label: 'Super !', emoji: '😄' },
  { value: 'bien', label: 'Bien', emoji: '🙂' },
  { value: 'bof', label: 'Bof', emoji: '😐' },
  { value: 'pas_top', label: 'Pas top', emoji: '😔' },
];

export default function Home() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [feed, setFeed] = useState(null);
  const [program, setProgram] = useState(null);
  const [mood, setMood] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    setError(null);
    try {
      const [feedRes, programRes] = await Promise.all([
        homeAPI.getFeed(userId),
        programAPI.getToday(userId).catch(() => null)
      ]);
      setFeed(feedRes.data);
      if (programRes) setProgram(programRes.data);
    } catch (err) {
      console.error(err);
      setError('Impossible de charger les données. Vérifie ta connexion.');
    } finally {
      setLoading(false);
    }
  };

  const handleMood = async (selectedMood) => {
    setMood(selectedMood);
    try {
      await programAPI.submitMood({ userId: parseInt(userId), mood: selectedMood });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="mascot text-4xl w-20 h-20 animate-bounce-slow">🦉</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card text-center max-w-md">
        <div className="text-5xl mb-4">😕</div>
        <h2 className="font-display text-xl font-bold text-gray-800 mb-2">Oups !</h2>
        <p className="text-gray-500 mb-4">{error}</p>
        <button type="button" onClick={() => { setLoading(true); loadData(); }} className="btn-primary">
          Réessayer
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10 px-4 py-3">
        <div className="max-w-lg mx-auto flex justify-between items-center">
          <button onClick={() => navigate('/select')} className="text-gray-400 hover:text-gray-600">
            ← Profils
          </button>
          <div className="flex items-center gap-2">
            {feed?.streak > 0 && (
              <span className="badge-pill bg-orange-100 text-orange-600 text-sm">
                🔥 {feed.streak} jours
              </span>
            )}
          </div>
          <button onClick={() => navigate(`/profile/${userId}`)} className="text-primary-600 text-sm font-medium">
            Mon profil
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Welcome */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="font-display text-2xl font-bold text-primary-800">
            Salut {feed?.userName} ! 👋
          </h1>
        </motion.div>

        {/* Encouragement */}
        {feed?.encouragement && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="card bg-gradient-to-r from-primary-500 to-primary-600 text-white"
          >
            <div className="flex items-start gap-3">
              <span className="text-3xl">🦉</span>
              <p className="font-medium">{feed.encouragement}</p>
            </div>
          </motion.div>
        )}

        {/* Joke of the day */}
        {feed?.joke && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="card bg-yellow-50 border-yellow-200"
          >
            <p className="text-sm font-medium text-yellow-800">😂 Blague du jour</p>
            <p className="text-yellow-700 mt-1">{feed.joke}</p>
          </motion.div>
        )}

        {/* Birthdays & Events */}
        {(feed?.birthdays?.length > 0 || feed?.events?.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="card"
          >
            <p className="text-sm font-medium text-gray-500 mb-2">📅 Aujourd'hui</p>
            {feed.birthdays?.map((b, i) => (
              <p key={i} className="text-sm">🎂 C'est l'anniversaire de {b.name} !</p>
            ))}
            {feed.events?.map((e, i) => (
              <p key={i} className="text-sm text-gray-600">📌 {e.title}</p>
            ))}
          </motion.div>
        )}

        {/* Mood check */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="card"
        >
          <p className="font-display font-semibold mb-3">Comment tu te sens aujourd'hui ?</p>
          <div className="flex gap-3 justify-center">
            {moodOptions.map(m => (
              <button
                key={m.value}
                onClick={() => handleMood(m.value)}
                className={`text-center p-3 rounded-xl transition-all ${
                  mood === m.value
                    ? 'bg-primary-100 ring-2 ring-primary-400 scale-110'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="text-3xl">{m.emoji}</div>
                <div className="text-xs text-gray-500 mt-1">{m.label}</div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Daily program preview */}
        {program && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="card"
          >
            <p className="font-display font-semibold mb-3">📋 Ton programme du jour</p>
            {program.encouragement && (
              <p className="text-sm text-gray-500 mb-3 italic">{program.encouragement}</p>
            )}
            <div className="space-y-2">
              {(Array.isArray(program.blocks) ? program.blocks : []).slice(0, 4).map((block, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                  <span className="text-xl">
                    {block.type === 'lesson' ? '📖' : '✏️'}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{block.title || block.subject}</p>
                    <p className="text-xs text-gray-400">{block.durationMinutes || 15} min</p>
                  </div>
                  {block.completed && <span className="text-accent-green">✓</span>}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Start session button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="text-center pb-8"
        >
          <button
            onClick={() => navigate(`/session/${userId}`)}
            className="btn-primary text-lg px-10 py-4 shadow-lg shadow-primary-200"
          >
            🚀 Commencer ma session
          </button>
        </motion.div>
      </div>
    </div>
  );
}
