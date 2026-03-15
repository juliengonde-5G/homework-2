import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { familyAPI } from '../services/api';
import { motion } from 'framer-motion';

export default function SelectChild() {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChild, setNewChild] = useState({ name: '', age: '', avatar: '🧑‍🎓', birthday: '' });
  const { user, selectChild, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadChildren();
  }, []);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showAddChild) setShowAddChild(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showAddChild]);

  const loadChildren = async () => {
    try {
      setError(null);
      const res = await familyAPI.getUsers();
      setChildren(res.data);
    } catch (err) {
      console.error(err);
      setError('Impossible de charger les profils. Vérifie ta connexion.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (child) => {
    try {
      await selectChild(child.id);
      if (!child.discoveryCompleted) {
        navigate(`/discovery/${child.id}`);
      } else {
        navigate(`/home/${child.id}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddChild = async (e) => {
    e.preventDefault();
    try {
      const res = await familyAPI.createUser({
        ...newChild,
        age: parseInt(newChild.age)
      });
      setChildren([...children, res.data]);
      setShowAddChild(false);
      setNewChild({ name: '', age: '', avatar: '🧑‍🎓', birthday: '' });
    } catch (err) {
      console.error(err);
    }
  };

  const avatars = ['🧑‍🎓', '👧', '👦', '🧒', '👩‍🎓', '🦸', '🧑‍🚀', '🧑‍🎨', '🧑‍🔬', '🧑‍💻'];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="mascot text-4xl w-20 h-20 animate-bounce-slow">🦉</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center py-8">
        <p className="text-red-500 mb-2">{error}</p>
        <button type="button" onClick={() => { setError(null); loadChildren(); }} className="btn-secondary text-sm">
          Réessayer
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="font-display text-2xl font-bold text-primary-800">
              🦉 Qui apprend aujourd'hui ?
            </h1>
            <p className="text-gray-500 text-sm mt-1">Choisis ton profil pour commencer</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => navigate('/admin')} className="btn-secondary text-sm">
              Espace parent
            </button>
            <button type="button" onClick={logout} className="text-gray-400 hover:text-gray-600 text-sm">
              Déconnexion
            </button>
          </div>
        </div>

        {/* Children grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          {children.map((child, i) => (
            <motion.div
              key={child.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <button
                onClick={() => handleSelect(child)}
                className="card-hover w-full text-center"
              >
                <div className="text-5xl mb-3">{child.avatar}</div>
                <h3 className="font-display font-semibold text-lg">{child.name}</h3>
                {child.age && <p className="text-sm text-gray-400">{child.age} ans</p>}
                {child.stats && (
                  <div className="mt-2 flex items-center justify-center gap-2 text-xs">
                    <span className="badge-pill bg-primary-100 text-primary-700">
                      Niv. {child.stats.level}
                    </span>
                    {child.stats.currentStreak > 0 && (
                      <span className="badge-pill bg-orange-100 text-orange-700">
                        🔥 {child.stats.currentStreak}
                      </span>
                    )}
                  </div>
                )}
                {!child.discoveryCompleted && (
                  <span className="badge-pill bg-accent-green/10 text-accent-green text-xs mt-2">
                    Nouveau !
                  </span>
                )}
              </button>
            </motion.div>
          ))}

          {/* Add child button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: children.length * 0.1 }}
          >
            <button
              type="button"
              onClick={() => setShowAddChild(true)}
              className="card-hover w-full text-center border-2 border-dashed border-gray-300 hover:border-primary-400"
            >
              <div className="text-4xl mb-2 text-gray-300">+</div>
              <p className="text-sm text-gray-400 font-medium">Ajouter un enfant</p>
            </button>
          </motion.div>
        </div>

        {/* Add child modal */}
        {showAddChild && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="card w-full max-w-md"
            >
              <h2 className="font-display text-xl font-semibold mb-4">Nouveau jeune</h2>
              <form onSubmit={handleAddChild} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Prénom</label>
                  <input type="text" value={newChild.name}
                    onChange={e => setNewChild({...newChild, name: e.target.value})}
                    className="input-field" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Âge</label>
                  <input type="number" min="6" max="99" value={newChild.age}
                    onChange={e => setNewChild({...newChild, age: e.target.value})}
                    className="input-field" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Date de naissance</label>
                  <input type="date" value={newChild.birthday}
                    onChange={e => setNewChild({...newChild, birthday: e.target.value})}
                    className="input-field" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Avatar</label>
                  <div className="flex flex-wrap gap-2">
                    {avatars.map(a => (
                      <button key={a} type="button"
                        onClick={() => setNewChild({...newChild, avatar: a})}
                        className={`text-3xl p-3 rounded-xl transition-all ${
                          newChild.avatar === a ? 'bg-primary-100 ring-2 ring-primary-400 scale-110' : 'hover:bg-gray-100'
                        }`}
                      >{a}</button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowAddChild(false)} className="btn-secondary flex-1">
                    Annuler
                  </button>
                  <button type="submit" className="btn-primary flex-1">
                    Créer
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
