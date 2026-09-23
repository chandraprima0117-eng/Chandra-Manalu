import React from 'react';
import { Compass, Settings, LogOut, Database, RefreshCw, PlusCircle, Lock, ShieldCheck, Rocket, Folder, Map, SlidersHorizontal } from 'lucide-react';
import type { UserProfile } from '../types';

interface HeaderProps {
  user: UserProfile;
  currentView?: 'map' | 'cms';
  onToggleView?: (view: 'map' | 'cms') => void;
  onLogout: () => void;
  onOpenCMS: () => void;
  onOpenNewGrid: () => void;
  onResetDB: () => void;
  onOpenDeployGuide: () => void;
  activeFolderName?: string;
  isDbResetting?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  currentView = 'map',
  onToggleView,
  onLogout,
  onOpenCMS,
  onOpenNewGrid,
  onResetDB,
  onOpenDeployGuide,
  activeFolderName,
  isDbResetting
}) => {
  const isSuperAdmin = user.role === 'ADMIN';

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 shadow-md">
      {/* Brand & Main View Switcher */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center text-amber-400 font-bold shadow-inner">
            <Compass className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-white tracking-tight">GRID Promoter</h1>
              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-mono font-bold">
                v2.5 Folder & Live
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Grid Market Intelligence — prioritas akuisisi, POI & BTS per folder dataset
            </p>
          </div>
        </div>

        {/* View Switcher Tabs (Accessible to Super Admin) */}
        {isSuperAdmin && onToggleView && (
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1 shadow-inner ml-0 sm:ml-2">
            <button
              onClick={() => onToggleView('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                currentView === 'map'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>Peta GIS</span>
            </button>
            <button
              onClick={() => onToggleView('cms')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                currentView === 'cms'
                  ? 'bg-amber-500 text-slate-950 shadow font-extrabold'
                  : 'text-amber-400 hover:text-amber-300'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Halaman CMS</span>
              <span className="bg-amber-400/20 text-amber-300 text-[9px] px-1.5 py-0.2 rounded font-bold uppercase">
                Admin
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Actions & User State */}
      <div className="flex items-center flex-wrap gap-2.5">
        {/* Active Folder Badge / Quick Opener */}
        {activeFolderName && (
          <button
            onClick={onOpenCMS}
            className="bg-blue-950/80 hover:bg-blue-900/60 border border-blue-500/40 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-xs text-blue-300 transition cursor-pointer shadow-sm"
            title="Folder dataset yang aktif. Klik untuk kelola folder & upload data."
          >
            <Folder className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px] font-semibold max-w-[140px] truncate">{activeFolderName}</span>
          </button>
        )}

        {/* Database Live Status Indicator */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-xs text-slate-300">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[11px] font-mono text-emerald-400 font-semibold">DB CONNECTED</span>
        </div>

        {/* Add Grid Quick Action - Super Admin Only */}
        {isSuperAdmin && currentView === 'map' && (
          <button
            onClick={onOpenNewGrid}
            className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Tambah Grid Manual ke Database (Super Admin Only)"
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tambah Grid</span>
          </button>
        )}

        {/* User Scope Chip */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
          <span className="font-semibold text-slate-200">{user.name}</span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] uppercase font-extrabold border tracking-wider flex items-center gap-1 ${
              isSuperAdmin
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
            }`}
          >
            {isSuperAdmin && <ShieldCheck className="w-3 h-3 text-amber-400" />}
            {isSuperAdmin ? 'SUPER ADMIN' : user.scope}
          </span>
        </div>

        {/* CMS Data Management Quick Button */}
        {isSuperAdmin && (
          <button
            onClick={() => onToggleView ? onToggleView(currentView === 'cms' ? 'map' : 'cms') : onOpenCMS()}
            className="bg-slate-800 hover:bg-slate-700 text-blue-400 border border-blue-500/30 text-xs font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{currentView === 'cms' ? 'Buka Peta' : 'Kelola CMS'}</span>
          </button>
        )}

        {/* Reset Database to Seed for Super ADMIN */}
        {isSuperAdmin && (
          <button
            onClick={onResetDB}
            disabled={isDbResetting}
            className="bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 text-xs font-medium px-2.5 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
            title="Reset dataset default database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isDbResetting ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Reset Seed</span>
          </button>
        )}

        {/* Logout */}
        <button
          onClick={onLogout}
          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
};
