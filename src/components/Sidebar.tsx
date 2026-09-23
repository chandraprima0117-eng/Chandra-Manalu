import React, { useState, useMemo } from 'react';
import {
  Compass,
  FileEdit,
  Activity,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  RotateCcw,
  Layers,
  Moon,
  Sun
} from 'lucide-react';
import type { FilterState, GridCategory, AppModule, UserProfile, GeoHierarchy } from '../types';

interface SidebarProps {
  user: UserProfile;
  activeModule: AppModule;
  onSelectModule: (module: AppModule) => void;
  filters: FilterState;
  onFilterChange: (updates: Partial<FilterState>) => void;
  onReset: () => void;
  geoHierarchy?: GeoHierarchy;
  availableKecamatans?: string[];
  onLogout: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: (val: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeModule,
  onSelectModule,
  filters,
  onFilterChange,
  onReset,
  geoHierarchy,
  availableKecamatans = [],
  onLogout,
  isDarkMode,
  onToggleDarkMode
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(true);

  // 1. Available Regions from real dataset
  const availableRegions = useMemo(() => {
    if (!geoHierarchy || Object.keys(geoHierarchy).length === 0) {
      return ['EAST JAVA', 'BALI NUSRA'];
    }
    return Object.keys(geoHierarchy).sort();
  }, [geoHierarchy]);

  // 2. Available Provinces (filtered by selected Region if not ALL)
  const availableProvinces = useMemo(() => {
    if (!geoHierarchy || Object.keys(geoHierarchy).length === 0) {
      return ['JAWA TIMUR (4672)', 'BALI (602)'];
    }
    if (filters.region && filters.region !== 'ALL' && geoHierarchy[filters.region]) {
      return Object.keys(geoHierarchy[filters.region]).sort();
    }
    const set = new Set<string>();
    Object.values(geoHierarchy).forEach((provObj) => {
      Object.keys(provObj).forEach((p) => set.add(p));
    });
    return Array.from(set).sort();
  }, [geoHierarchy, filters.region]);

  // 3. Available Cities (filtered by selected Province or Region)
  const availableCities = useMemo(() => {
    if (!geoHierarchy || Object.keys(geoHierarchy).length === 0) {
      return ['KAB. BANGKALAN', 'KOTA DENPASAR', 'KAB. BADUNG', 'KAB. BANGLI', 'KAB. GIANYAR'];
    }
    const set = new Set<string>();

    if (filters.province && filters.province !== 'ALL') {
      Object.values(geoHierarchy).forEach((provObj) => {
        if (provObj[filters.province]) {
          Object.keys(provObj[filters.province]).forEach((c) => set.add(c));
        }
      });
    } else if (filters.region && filters.region !== 'ALL' && geoHierarchy[filters.region]) {
      const provObj = geoHierarchy[filters.region];
      Object.values(provObj).forEach((citiesObj) => {
        Object.keys(citiesObj).forEach((c) => set.add(c));
      });
    } else {
      Object.values(geoHierarchy).forEach((provObj) => {
        Object.values(provObj).forEach((citiesObj) => {
          Object.keys(citiesObj).forEach((c) => set.add(c));
        });
      });
    }

    return Array.from(set).sort();
  }, [geoHierarchy, filters.region, filters.province]);

  // 4. Available Kecamatans (filtered by selected City, Province, or Region)
  const dynamicKecamatans = useMemo(() => {
    if (!geoHierarchy || Object.keys(geoHierarchy).length === 0) {
      return availableKecamatans;
    }
    const set = new Set<string>();

    if (filters.city && filters.city !== 'ALL') {
      Object.values(geoHierarchy).forEach((provObj) => {
        Object.values(provObj).forEach((citiesObj) => {
          if (citiesObj[filters.city]) {
            citiesObj[filters.city].forEach((k) => set.add(k));
          }
        });
      });
    } else if (filters.province && filters.province !== 'ALL') {
      Object.values(geoHierarchy).forEach((provObj) => {
        if (provObj[filters.province]) {
          Object.values(provObj[filters.province]).forEach((kList) => {
            kList.forEach((k) => set.add(k));
          });
        }
      });
    } else if (filters.region && filters.region !== 'ALL' && geoHierarchy[filters.region]) {
      const provObj = geoHierarchy[filters.region];
      Object.values(provObj).forEach((citiesObj) => {
        Object.values(citiesObj).forEach((kList) => {
          kList.forEach((k) => set.add(k));
        });
      });
    } else {
      Object.values(geoHierarchy).forEach((provObj) => {
        Object.values(provObj).forEach((citiesObj) => {
          Object.values(citiesObj).forEach((kList) => {
            kList.forEach((k) => set.add(k));
          });
        });
      });
    }

    const res = Array.from(set).sort();
    return res.length > 0 ? res : availableKecamatans;
  }, [geoHierarchy, filters.region, filters.province, filters.city, availableKecamatans]);

  const handleCategoryToggle = (cat: GridCategory) => {
    onFilterChange({
      categories: {
        ...filters.categories,
        [cat]: !filters.categories[cat]
      }
    });
  };

  // Region change handler
  const handleRegionChange = (newReg: string) => {
    if (newReg === 'ALL') {
      onFilterChange({ region: 'ALL', province: 'ALL', city: 'ALL', kecamatan: 'ALL' });
      return;
    }

    // Check if current province belongs to new region
    const provsInRegion = geoHierarchy && geoHierarchy[newReg] ? Object.keys(geoHierarchy[newReg]) : [];
    const keepProv = provsInRegion.includes(filters.province);
    const targetProv = keepProv ? filters.province : 'ALL';

    // Check city
    let targetCity = 'ALL';
    if (targetProv !== 'ALL' && geoHierarchy && geoHierarchy[newReg]?.[targetProv]) {
      const citiesInProv = Object.keys(geoHierarchy[newReg][targetProv]);
      if (citiesInProv.includes(filters.city)) {
        targetCity = filters.city;
      }
    }

    onFilterChange({
      region: newReg,
      province: targetProv,
      city: targetCity,
      kecamatan: 'ALL'
    });
  };

  // Province change handler
  const handleProvinceChange = (newProv: string) => {
    if (newProv === 'ALL') {
      onFilterChange({ province: 'ALL', city: 'ALL', kecamatan: 'ALL' });
      return;
    }

    // Auto find parent region
    let parentReg = filters.region;
    if (geoHierarchy) {
      for (const reg in geoHierarchy) {
        if (geoHierarchy[reg][newProv]) {
          parentReg = reg;
          break;
        }
      }
    }

    // Check city
    let targetCity = 'ALL';
    if (geoHierarchy && geoHierarchy[parentReg]?.[newProv]) {
      const citiesInProv = Object.keys(geoHierarchy[parentReg][newProv]);
      if (citiesInProv.includes(filters.city)) {
        targetCity = filters.city;
      }
    }

    onFilterChange({
      region: parentReg,
      province: newProv,
      city: targetCity,
      kecamatan: 'ALL'
    });
  };

  // City change handler
  const handleCityChange = (newCity: string) => {
    if (newCity === 'ALL') {
      onFilterChange({ city: 'ALL', kecamatan: 'ALL' });
      return;
    }

    // Auto detect parent province & region
    let parentProv = filters.province;
    let parentReg = filters.region;
    if (geoHierarchy) {
      for (const reg in geoHierarchy) {
        for (const prov in geoHierarchy[reg]) {
          if (geoHierarchy[reg][prov][newCity]) {
            parentReg = reg;
            parentProv = prov;
            break;
          }
        }
      }
    }

    onFilterChange({
      region: parentReg,
      province: parentProv,
      city: newCity,
      kecamatan: 'ALL'
    });
  };

  return (
    <aside
      className={`${
        isCollapsed ? 'w-20' : 'w-72 sm:w-80'
      } bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 select-none text-slate-100 transition-all duration-300 z-20 h-full`}
    >
      {/* Brand Header matching Image 3: XLSmart & Collapse */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold shrink-0">
            <span className="text-base">🗂️</span>
          </div>
          {!isCollapsed && (
            <span className="text-lg font-extrabold text-blue-400 tracking-tight">
              XLSmart
            </span>
          )}
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          title={isCollapsed ? 'Buka Sidebar' : 'Ciutkan Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* User Connection & Profile matching Image 3 */}
      {!isCollapsed ? (
        <div className="p-4 border-b border-slate-800 flex flex-col gap-1.5 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
            <span className="text-xs font-bold text-emerald-400">Connected</span>
          </div>
          <div className="flex items-center justify-between gap-1 mt-1">
            <h3 className="text-sm font-extrabold text-white truncate">{user.name}</h3>
            <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded font-mono font-bold shrink-0 uppercase">
              {user.scope || 'DE-GM'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono truncate">{user.email}</p>
        </div>
      ) : (
        <div className="p-3 border-b border-slate-800 flex flex-col items-center">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 mb-1"></span>
          <span className="text-[9px] font-mono text-slate-400">{user.scope?.substring(0, 3)}</span>
        </div>
      )}

      {/* Main 3 Modules Navigation List matching Image 3 */}
      <div className="p-3 flex flex-col gap-1.5 border-b border-slate-800">
        {!isCollapsed && (
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">
            Modul Utama
          </span>
        )}

        {/* 1. GRID Promoter */}
        <button
          onClick={() => onSelectModule('grid')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeModule === 'grid'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
          title="1. GRID Promoter (Peta GIS, Analisis Grid & BTS)"
        >
          <Compass
            className={`w-4 h-4 shrink-0 ${
              activeModule === 'grid' ? 'text-amber-400 animate-pulse' : 'text-slate-400'
            }`}
          />
          {!isCollapsed && (
            <span className="flex-1 text-left font-extrabold">GRID Promoter</span>
          )}
        </button>

        {/* 2. FORM POI */}
        <button
          onClick={() => onSelectModule('form_poi')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeModule === 'form_poi'
              ? 'bg-orange-600/20 text-orange-400 border border-orange-500/40 shadow-sm'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
          title="2. FORM POI (Input Data POI, GPS & Foto)"
        >
          <FileEdit
            className={`w-4 h-4 shrink-0 ${
              activeModule === 'form_poi' ? 'text-orange-400' : 'text-slate-400'
            }`}
          />
          {!isCollapsed && (
            <div className="flex-1 text-left flex items-center justify-between">
              <span className="font-extrabold">FORM POI</span>
              <span className="text-[9px] bg-orange-500/20 text-orange-300 px-1.5 py-0.2 rounded font-mono">
                Foto & GPS
              </span>
            </div>
          )}
        </button>

        {/* 3. Network Check */}
        <button
          onClick={() => onSelectModule('network_check')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeModule === 'network_check'
              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
          title="3. Network Check (Live Speed Test & Latency)"
        >
          <Activity
            className={`w-4 h-4 shrink-0 ${
              activeModule === 'network_check' ? 'text-emerald-400' : 'text-slate-400'
            }`}
          />
          {!isCollapsed && (
            <div className="flex-1 text-left flex items-center justify-between">
              <span className="font-extrabold">Network Check</span>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono">
                Speed Test
              </span>
            </div>
          )}
        </button>
      </div>

      {/* Middle Scrollable Section: Filters (When in GRID Promoter module) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {activeModule === 'grid' && !isCollapsed && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-blue-400" />
                <span>Filter Wilayah</span>
              </span>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="text-[10px] text-blue-400 hover:underline"
              >
                {showFilters ? 'Tutup' : 'Buka'}
              </button>
            </div>

            {showFilters && (
              <>
                {/* REGION */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    REGION
                  </label>
                  <select
                    value={filters.region}
                    onChange={(e) => handleRegionChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
                  >
                    <option value="ALL">Semua Region</option>
                    {availableRegions.map((reg) => (
                      <option key={reg} value={reg}>
                        {reg}
                      </option>
                    ))}
                  </select>
                </div>

                {/* PROVINSI */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    PROVINSI
                  </label>
                  <select
                    value={filters.province}
                    onChange={(e) => handleProvinceChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
                  >
                    <option value="ALL">Semua Provinsi</option>
                    {availableProvinces.map((prov) => (
                      <option key={prov} value={prov}>
                        {prov}
                      </option>
                    ))}
                  </select>
                </div>

                {/* KOTA / KABUPATEN */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    KOTA / KABUPATEN
                  </label>
                  <select
                    value={filters.city}
                    onChange={(e) => handleCityChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
                  >
                    <option value="ALL">Semua Kota/Kabupaten</option>
                    {availableCities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </div>

                {/* KECAMATAN */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    KECAMATAN
                  </label>
                  <select
                    value={filters.kecamatan}
                    onChange={(e) => onFilterChange({ kecamatan: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
                  >
                    <option value="ALL">Semua Kecamatan</option>
                    {dynamicKecamatans.map((kec) => (
                      <option key={kec} value={kec}>
                        {kec}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search Bar */}
                <div className="space-y-1.5 pt-1 border-t border-slate-800">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Cari Grid / BTS
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Cari ID / Nama..."
                      value={filters.searchQuery}
                      onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  </div>
                </div>

                {/* Kategori Grid Checkboxes */}
                <div className="space-y-1.5 pt-1 border-t border-slate-800">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Kategori Prioritas Grid
                  </label>
                  {(
                    [
                      '1st Priority Acquisition',
                      '2nd Priority Acquisition',
                      '3rd Priority',
                      'Avoid Cannibalism'
                    ] as GridCategory[]
                  ).map((cat) => (
                    <label
                      key={cat}
                      className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer py-0.5"
                    >
                      <input
                        type="checkbox"
                        checked={filters.categories[cat]}
                        onChange={() => handleCategoryToggle(cat)}
                        className="rounded border-slate-700 bg-slate-950 text-blue-500 focus:ring-0 cursor-pointer"
                      />
                      <span className="truncate">{cat}</span>
                    </label>
                  ))}
                </div>

                {/* Reset Button */}
                <button
                  onClick={onReset}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Filter</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer matching Image 3: Logout */}
      <div className="p-3 border-t border-slate-800 flex flex-col gap-2 bg-slate-950/60">
        {/* Logout Button matching Image 3 */}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-amber-500/90 hover:text-amber-400 hover:bg-slate-800/80 transition cursor-pointer"
          title="Logout"
        >
          <span className="text-base">🚪</span>
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};
