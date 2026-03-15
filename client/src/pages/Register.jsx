import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', familyName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(form);
      navigate('/select');
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur d\'inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mascot text-5xl w-24 h-24 mx-auto mb-4">🦉</div>
          <h1 className="font-display text-3xl font-bold text-primary-800">Bienvenue !</h1>
          <p className="text-gray-500 mt-2">Créez votre espace famille</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">{error}</div>
          )}

          <div>
            <label htmlFor="register-name" className="block text-sm font-medium text-gray-600 mb-1">Votre prénom</label>
            <input id="register-name" type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
              className="input-field" required />
          </div>

          <div>
            <label htmlFor="register-family" className="block text-sm font-medium text-gray-600 mb-1">Nom de famille</label>
            <input id="register-family" type="text" value={form.familyName} onChange={e => setForm({...form, familyName: e.target.value})}
              className="input-field" placeholder="Ex: Famille Dupont" required />
          </div>

          <div>
            <label htmlFor="register-email" className="block text-sm font-medium text-gray-600 mb-1">Email</label>
            <input id="register-email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
              className="input-field" required />
          </div>

          <div>
            <label htmlFor="register-password" className="block text-sm font-medium text-gray-600 mb-1">Mot de passe</label>
            <input id="register-password" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
              className="input-field" minLength={6} required />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full" aria-label="Créer mon espace">
            {loading ? 'Création...' : 'Créer mon espace'}
          </button>

          <p className="text-center text-sm text-gray-500">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">Se connecter</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
