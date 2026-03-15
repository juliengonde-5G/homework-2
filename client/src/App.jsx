import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import SelectChild from './pages/SelectChild';
import Home from './pages/Home';
import Discovery from './pages/Discovery';
import Session from './pages/Session';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" />;
  return children;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="text-center">
        <div className="mascot text-4xl w-20 h-20 mx-auto mb-4 animate-bounce-slow">
          🦉
        </div>
        <p className="text-primary-600 font-display text-xl">Chargement...</p>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/select" element={
        <ProtectedRoute><SelectChild /></ProtectedRoute>
      } />
      <Route path="/home/:userId" element={
        <ProtectedRoute><Home /></ProtectedRoute>
      } />
      <Route path="/discovery/:userId" element={
        <ProtectedRoute><Discovery /></ProtectedRoute>
      } />
      <Route path="/session/:userId" element={
        <ProtectedRoute><Session /></ProtectedRoute>
      } />
      <Route path="/profile/:userId" element={
        <ProtectedRoute><Profile /></ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute><AdminDashboard /></ProtectedRoute>
      } />
      <Route path="/" element={<Navigate to="/select" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
