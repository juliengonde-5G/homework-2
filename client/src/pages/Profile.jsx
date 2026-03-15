import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { familyAPI, discoveryAPI } from '../services/api';

const pcmLabels = {
  promoteur: { label: 'Promoteur', emoji: '🚀', color: 'bg-red-100 text-red-700', desc: 'Action, compétition, résultats' },
  rebelle: { label: 'Rebelle', emoji: '🎸', color: 'bg-purple-100 text-purple-700', desc: 'Liberté, créativité, expression' },
  imagineur: { label: 'Imagineur', emoji: '🎨', color: 'bg-pink-100 text-pink-700', desc: 'Imaginaire, créativité, monde intérieur' },
  analyseur: { label: 'Analyseur', emoji: '🔬', color: 'bg-blue-100 text-blue-700', desc: 'Logique, précision, structure' },
  empathique: { label: 'Empathique', emoji: '💚', color: 'bg-green-100 text-green-700', desc: 'Relations, bienveillance, harmonie' },
  reveur: { label: 'Rêveur', emoji: '☁️', color: 'bg-cyan-100 text-cyan-700', desc: 'Calme, introspection, imagination' },
};

export default function Profile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      const [userRes, resultRes] = await Promise.all([
        familyAPI.getUser(userId),
        discoveryAPI.getResult(userId).catch(() => null)
      ]);
      setUser(userRes.data);
      if (resultRes) setResult(resultRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="mascot text-4xl w-20 h-20 animate-bounce-slow">🦉</div>
    </div>
  );

  if (!user) return null;

  const profile = result?.profile || user.profile;
  const pathway = result?.pathway || user.pathway;
  const pcm = pcmLabels[profile?.profileType] || pcmLabels.empathique;
  const tips = profile?.adviceTips || {};

  const pathwayLabels = {
    back_to_basics: { label: 'Back to Basics', icon: '📐' },
    oriented: { label: 'Objectif Moyenne', icon: '📈' },
    project: { label: 'Parcours Projet', icon: '🚀' },
  };

  const pw = pathwayLabels[pathway?.type] || pathwayLabels.back_to_basics;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white" data-theme={profile?.profileType}>
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10 px-4 py-3">
        <div className="max-w-lg mx-auto flex justify-between items-center">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
            ← Retour
          </button>
          <h1 className="font-display font-semibold">Mon profil</h1>
          <div />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* User card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card text-center">
          <div className="text-6xl mb-2">{user.avatar}</div>
          <h2 className="font-display text-2xl font-bold">{user.name}</h2>
          {user.age && <p className="text-gray-400">{user.age} ans</p>}

          <div className="flex justify-center gap-3 mt-4">
            <span className={`badge-pill ${pcm.color}`}>{pcm.emoji} {pcm.label}</span>
            <span className="badge-pill bg-gray-100 text-gray-600">{pw.icon} {pw.label}</span>
          </div>

          {user.userStats && (
            <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t">
              <div>
                <p className="text-2xl font-bold text-primary-600">{user.userStats.level}</p>
                <p className="text-xs text-gray-400">Niveau</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-500">{user.userStats.currentStreak}</p>
                <p className="text-xs text-gray-400">Streak 🔥</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-accent-green">{user.userStats.totalMinutes}</p>
                <p className="text-xs text-gray-400">Minutes</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* PCM Profile */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card">
          <h3 className="font-display font-semibold mb-2">Personnalité d'apprentissage</h3>
          <p className="text-gray-600 text-sm">{pcm.desc}</p>
        </motion.div>

        {/* Learning modalities */}
        {profile?.learningModalities && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card">
            <h3 className="font-display font-semibold mb-3">Modalités d'apprentissage</h3>
            <div className="space-y-3">
              {Object.entries(profile.learningModalities).map(([key, value]) => {
                const labels = { lecture: '📖 Lecture', oral: '🎧 Oral', image: '🖼️ Visuel', kinesthesique: '🤲 Pratique' };
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-sm w-24">{labels[key] || key}</span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full">
                      <div className="h-3 bg-primary-400 rounded-full" style={{ width: `${(value / 5) * 100}%` }} />
                    </div>
                    <span className="text-sm text-gray-400 w-8">{value}/5</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Interests */}
        {profile?.interests && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card">
            <h3 className="font-display font-semibold mb-3">Centres d'intérêt</h3>
            <div className="flex flex-wrap gap-2">
              {(Array.isArray(profile.interests) ? profile.interests : []).map((interest, i) => (
                <span key={i} className="badge-pill bg-primary-100 text-primary-700">{interest}</span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Pathway */}
        {pathway && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card">
            <h3 className="font-display font-semibold mb-2">Mon parcours</h3>
            <p className="text-gray-600">{pw.icon} {pw.label}</p>
            {pathway.projectTheme && (
              <p className="text-sm text-gray-500 mt-1">Projet : {pathway.projectTheme}</p>
            )}
            {pathway.targetSubjects && (
              <div className="flex flex-wrap gap-2 mt-2">
                {(Array.isArray(pathway.targetSubjects) ? pathway.targetSubjects : []).map((s, i) => (
                  <span key={i} className="badge-pill bg-accent-green/10 text-accent-green text-xs">{s}</span>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Tips */}
        {tips.tips && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="card bg-accent-green/5 border-accent-green/20">
            <h3 className="font-display font-semibold mb-3">💡 Mes conseils</h3>
            {tips.strengths && (
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-500">Tes forces :</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {tips.strengths.map((s, i) => (
                    <span key={i} className="badge-pill bg-green-100 text-green-700 text-xs">{s}</span>
                  ))}
                </div>
              </div>
            )}
            <ul className="space-y-2">
              {tips.tips.map((tip, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-accent-green mt-0.5">✓</span> {tip}
                </li>
              ))}
            </ul>
            {tips.bestTimeToStudy && (
              <p className="mt-3 text-xs text-gray-400">⏰ Meilleur moment : {tips.bestTimeToStudy}</p>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
