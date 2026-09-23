import React from 'react';
import type { KPIData } from '../types';

interface KPICardsProps {
  kpi: KPIData;
  loading?: boolean;
}

export const KPICards: React.FC<KPICardsProps> = ({ kpi, loading }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* 1. #TOWER */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-center shadow-lg transition hover:border-slate-700">
        <div className="text-xl sm:text-2xl font-black text-white tracking-tight font-mono">
          {loading ? '...' : kpi.towerCount}
        </div>
        <div className="text-[10px] sm:text-[11px] text-slate-400 uppercase font-bold tracking-wider mt-0.5">
          #TOWER
        </div>
      </div>

      {/* 2. #GRID */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-center shadow-lg transition hover:border-slate-700">
        <div className="text-xl sm:text-2xl font-black text-white tracking-tight font-mono">
          {loading ? '...' : kpi.gridCount}
        </div>
        <div className="text-[10px] sm:text-[11px] text-slate-400 uppercase font-bold tracking-wider mt-0.5">
          #GRID
        </div>
      </div>

      {/* 3. 1ST PRIORITY ACQUISITION */}
      <div className="bg-emerald-950/20 border border-emerald-500/40 rounded-xl p-3 text-center shadow-lg transition hover:border-emerald-500/60">
        <div className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight font-mono">
          {loading ? '...' : kpi.p1Count}
        </div>
        <div className="text-[10px] sm:text-[11px] text-emerald-400/90 uppercase font-bold tracking-wider mt-0.5 flex items-center justify-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span>1ST PRIORITY ACQUISITION</span>
        </div>
      </div>

      {/* 4. 2ND PRIORITY ACQUISITION */}
      <div className="bg-orange-950/20 border border-orange-500/40 rounded-xl p-3 text-center shadow-lg transition hover:border-orange-500/60">
        <div className="text-xl sm:text-2xl font-black text-orange-400 tracking-tight font-mono">
          {loading ? '...' : kpi.p2Count}
        </div>
        <div className="text-[10px] sm:text-[11px] text-orange-400/90 uppercase font-bold tracking-wider mt-0.5">
          2ND PRIORITY ACQUISITION
        </div>
      </div>

      {/* 5. 3RD PRIORITY */}
      <div className="bg-red-950/20 border border-red-500/40 rounded-xl p-3 text-center shadow-lg transition hover:border-red-500/60">
        <div className="text-xl sm:text-2xl font-black text-red-400 tracking-tight font-mono">
          {loading ? '...' : kpi.p3Count}
        </div>
        <div className="text-[10px] sm:text-[11px] text-red-400/90 uppercase font-bold tracking-wider mt-0.5">
          3RD PRIORITY
        </div>
      </div>

      {/* 6. AVOID CANNIBALISM */}
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 text-center shadow-lg transition hover:border-slate-600">
        <div className="text-xl sm:text-2xl font-black text-slate-300 tracking-tight font-mono">
          {loading ? '...' : kpi.cannibalCount}
        </div>
        <div className="text-[10px] sm:text-[11px] text-slate-400 uppercase font-bold tracking-wider mt-0.5">
          AVOID CANNIBALISM
        </div>
      </div>
    </div>
  );
};
