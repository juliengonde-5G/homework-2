import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { adminAPI } from '../services/api';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [profileDetail, setProfileDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dashRes, analyticsRes] = await Promise.all([
        adminAPI.getDashboard(),
        adminAPI.getAnalytics()
      ]);
      setDashboard(dashRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadChildDetail = async (childId) => {
    setSelectedChild(childId);
    try {
      const [profileRes, chatRes] = await Promise.all([
        adminAPI.getProfile(childId),
        adminAPI.getChatHistory(childId)
      ]);
      setProfileDetail(profileRes.data);
      setChatHistory(chatRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="mascot text-4xl w-20 h-20 animate-bounce-slow">🦉</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-800">Espace Parent</h1>
            <p className="text-sm text-gray-400">Suivi et gestion des parcours</p>
          </div>
          <button onClick={() => navigate('/select')} className="btn-secondary text-sm">
            ← Profils enfants
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-4">
        <div className="max-w-6xl mx-auto flex gap-1" role="tablist">
          {[
            { id: 'overview', label: 'Vue d\'ensemble' },
            { id: 'profiles', label: 'Profils' },
            { id: 'analytics', label: 'Analyse' },
          ].map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboard.map((child, i) => (
              <motion.div
                key={child.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="card cursor-pointer hover:shadow-md transition-all"
                onClick={() => { setActiveTab('profiles'); loadChildDetail(child.id); }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl">{child.avatar}</span>
                  <div>
                    <h3 className="font-display font-semibold text-lg">{child.name}</h3>
                    <p className="text-sm text-gray-400">{child.age} ans</p>
                  </div>
                </div>

                {child.stats && (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center p-2 bg-primary-50 rounded-xl">
                      <p className="text-lg font-bold text-primary-600">{child.stats.level}</p>
                      <p className="text-xs text-gray-400">Niveau</p>
                    </div>
                    <div className="text-center p-2 bg-orange-50 rounded-xl">
                      <p className="text-lg font-bold text-orange-500">{child.stats.currentStreak}🔥</p>
                      <p className="text-xs text-gray-400">Streak</p>
                    </div>
                    <div className="text-center p-2 bg-green-50 rounded-xl">
                      <p className="text-lg font-bold text-accent-green">{child.stats.totalMinutes}'</p>
                      <p className="text-xs text-gray-400">Total</p>
                    </div>
                  </div>
                )}

                {child.pathway && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="badge-pill bg-gray-100 text-gray-600 text-xs">
                      {child.pathway.type === 'project' ? '🚀 Projet' :
                       child.pathway.type === 'oriented' ? '📈 Orienté' : '📐 Basics'}
                    </span>
                    {child.pathway.projectTheme && (
                      <span className="text-xs text-gray-400 truncate">{child.pathway.projectTheme}</span>
                    )}
                  </div>
                )}

                {child.difficulties?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-red-500 mb-1">Difficultés :</p>
                    <div className="flex flex-wrap gap-1">
                      {child.difficulties.map((d, j) => (
                        <span key={j} className="badge-pill bg-red-50 text-red-600 text-xs">
                          {d.subject} ({d.score}%)
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {child.strengths?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-green-500 mb-1">Forces :</p>
                    <div className="flex flex-wrap gap-1">
                      {child.strengths.slice(0, 3).map((s, j) => (
                        <span key={j} className="badge-pill bg-green-50 text-green-600 text-xs">
                          {s.subject} ({s.score}%)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {activeTab === 'profiles' && profileDetail && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="card">
                <h3 className="font-display font-semibold text-lg mb-4">
                  {profileDetail.user.avatar} {profileDetail.user.name}
                </h3>

                {profileDetail.profile && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-400">Profil PCM</p>
                      <p className="font-medium">{profileDetail.profile.profileType}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Centres d'intérêt</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(Array.isArray(profileDetail.profile.interests) ? profileDetail.profile.interests : []).map((i, j) => (
                          <span key={j} className="badge-pill bg-primary-100 text-primary-700 text-xs">{i}</span>
                        ))}
                      </div>
                    </div>
                    {profileDetail.profile.learningModalities && (
                      <div>
                        <p className="text-sm text-gray-400 mb-2">Modalités</p>
                        {Object.entries(profileDetail.profile.learningModalities).map(([k, v]) => (
                          <div key={k} className="flex items-center gap-2 mb-1">
                            <span className="text-xs w-20 capitalize">{k}</span>
                            <div className="flex-1 h-2 bg-gray-100 rounded">
                              <div className="h-2 bg-primary-400 rounded" style={{ width: `${(v / 5) * 100}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Profile history */}
              {profileDetail.profile?.history?.length > 0 && (
                <div className="card">
                  <h4 className="font-semibold mb-3">Historique des modifications</h4>
                  <div className="space-y-2">
                    {profileDetail.profile.history.map((h, i) => (
                      <div key={i} className="p-3 bg-gray-50 rounded-xl text-sm">
                        <p className="text-gray-500 text-xs">{new Date(h.createdAt).toLocaleDateString('fr')}</p>
                        <p className="text-gray-600">{h.reason || 'Modification du profil'}</p>
                        <pre className="text-xs text-gray-400 mt-1 overflow-x-auto">
                          {JSON.stringify(h.changes, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Chat history */}
            <div className="card max-h-[600px] overflow-y-auto">
              <h4 className="font-semibold mb-3 sticky top-0 bg-white pb-2">
                💬 Historique chat agent ({chatHistory.length} messages)
              </h4>
              <div className="space-y-2">
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`p-3 rounded-xl text-sm ${
                    msg.role === 'user' ? 'bg-primary-50 ml-8' : 'bg-gray-50 mr-8'
                  }`}>
                    <p className="text-xs text-gray-400 mb-1">
                      {msg.role === 'user' ? '👤 Enfant' : '🦉 Agent'} •{' '}
                      {new Date(msg.createdAt).toLocaleString('fr')}
                    </p>
                    <p className="text-gray-700">{msg.content}</p>
                  </div>
                ))}
                {chatHistory.length === 0 && (
                  <p className="text-gray-400 text-center py-4">Aucun message</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profiles' && !profileDetail && (
          <div className="text-center py-12">
            <p className="text-gray-400">Sélectionnez un enfant dans la vue d'ensemble</p>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {analytics.map((child, i) => (
              <motion.div
                key={child.childId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="card"
              >
                <h3 className="font-display font-semibold text-lg mb-4">{child.childName}</h3>

                <div className="grid sm:grid-cols-3 gap-4 mb-4">
                  <div className="p-3 bg-gray-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-primary-600">{child.avgDuration}'</p>
                    <p className="text-xs text-gray-400">Durée moyenne</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-accent-green">{child.totalSessions}</p>
                    <p className="text-xs text-gray-400">Sessions totales</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-orange-500">{child.streak}🔥</p>
                    <p className="text-xs text-gray-400">Streak actuel</p>
                  </div>
                </div>

                {child.subjects?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Performance par matière</h4>
                    <div className="space-y-2">
                      {child.subjects.map((s, j) => (
                        <div key={j} className="flex items-center gap-3">
                          <span className="text-sm w-28 truncate">{s.subject}</span>
                          <div className="flex-1 h-3 bg-gray-100 rounded-full">
                            <div
                              className={`h-3 rounded-full ${
                                s.averageScore >= 70 ? 'bg-accent-green' :
                                s.averageScore >= 40 ? 'bg-accent-orange' : 'bg-accent-red'
                              }`}
                              style={{ width: `${s.averageScore}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">{s.averageScore}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {child.moodTrend?.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Humeur récente</h4>
                    <div className="flex gap-2">
                      {child.moodTrend.map((m, j) => {
                        const emojis = { super: '😄', bien: '🙂', bof: '😐', pas_top: '😔' };
                        return (
                          <div key={j} className="text-center">
                            <div className="text-2xl">{emojis[m.mood] || '🙂'}</div>
                            <div className="text-xs text-gray-400">
                              {new Date(m.date).toLocaleDateString('fr', { weekday: 'short' })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
