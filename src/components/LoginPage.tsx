import React, { useState } from 'react';
import { Compass, Lock, ShieldAlert } from 'lucide-react';
import type { UserProfile } from '../types';
import { api } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Masukkan User Name atau Email');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.login(username, password || '123456');
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Gagal login, periksa akun Anda');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 px-4 select-none">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Compass className="w-8 h-8 text-amber-400 animate-spin-slow" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">GRID Promoter</h1>
          <p className="text-slate-400 text-xs mt-1 font-medium">
            Telecom GIS Analytics & Market Intelligence
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-950/50 border border-red-500/50 text-red-300 p-2.5 rounded-lg text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              User Name / Email / Sales Code
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Contoh: admin@xlsmart.co.id atau Kode Sales"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition font-medium"
            />
          </div>

          {/* User Name Info Banner */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 text-[11px] text-slate-400 leading-relaxed">
            <p className="font-bold text-slate-300 mb-0.5">Petunjuk Akses:</p>
            <p>
              Gunakan email terdaftar atau kode sales resmi untuk masuk sesuai hak akses role masing-masing wilayah.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-slate-950 font-extrabold py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20 cursor-pointer text-sm"
          >
            <Lock className="w-4 h-4 text-slate-950" />
            <span>{loading ? 'Mengautentikasi...' : 'Masuk Aplikasi'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
