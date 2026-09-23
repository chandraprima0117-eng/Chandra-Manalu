import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
// Ensure window.L is defined before leaflet.heat evaluates
if (typeof window !== 'undefined') {
  (window as any).L = L;
}
import 'leaflet.heat';

import type { GridItem, BTSItem, POIItem, UserProfile } from '../types';
import { MapPin, Radio, ZoomIn, ZoomOut, ChevronDown, Search, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface MapViewProps {
  grids: GridItem[];
  btsList: BTSItem[];
  pois: POIItem[];
  user?: UserProfile | null;
  onSelectGrid?: (grid: GridItem) => void;
  onEditGrid?: (grid: GridItem) => void;
  onEditBTS?: (bts: BTSItem) => void;
  focusedLocation?: { lat: number; lng: number } | null;
  isDarkMode?: boolean;
}

export const MapView: React.FC<MapViewProps> = ({
  grids,
  btsList,
  pois,
  user,
  onSelectGrid,
  onEditGrid,
  onEditBTS,
  focusedLocation,
  isDarkMode = true
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const gridLayersRef = useRef<L.LayerGroup | null>(null);
  const btsLayersRef = useRef<L.LayerGroup | null>(null);
  const poiLayersRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<any>(null);

  const [showHeatmap, setShowHeatmap] = useState(false);
  const [heatmapMode, setHeatmapMode] = useState<'all' | 'priority_only' | 'population_weighted'>('priority_only');
  const [heatmapRadius, setHeatmapRadius] = useState<number>(36);
  const [heatmapBlur, setHeatmapBlur] = useState<number>(22);
  const [showHeatmapSettings, setShowHeatmapSettings] = useState(false);
  const [mapTheme, setMapTheme] = useState<'osm' | 'dark' | 'satellite'>(isDarkMode ? 'dark' : 'osm');

  // Sync map theme when isDarkMode changes
  useEffect(() => {
    setMapTheme(isDarkMode ? 'dark' : 'osm');
  }, [isDarkMode]);

  // Completely Free Basemap Tile URLs (No API Key Required, No Watermark)
  const tileUrls = {
    osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    dark: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
  };

  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // BTS Revenue Categories Config & State
  const BTS_REV_CONFIG = [
    { key: 'Rev >40 Mn', label: 'Rev >40 Mn', color: '#3b82f6' },
    { key: 'Rev 30-40 Mn', label: 'Rev 30-40 Mn', color: '#10b981' },
    { key: 'Rev 20-30 Mn', label: 'Rev 20-30 Mn', color: '#f59e0b' },
    { key: 'Rev <20 Mn', label: 'Rev <20 Mn', color: '#ef4444' },
    { key: 'Rev 0', label: 'Rev 0', color: '#78350f' },
    { key: 'Unknown', label: 'Unknown', color: '#64748b' }
  ];

  const [selectedBtsRevs, setSelectedBtsRevs] = useState<string[]>([
    'Rev >40 Mn',
    'Rev 30-40 Mn',
    'Rev 20-30 Mn',
    'Rev <20 Mn',
    'Rev 0',
    'Unknown'
  ]);
  const [showBtsDropdown, setShowBtsDropdown] = useState(false);

  // POI Categories Config & State
  const [selectedPoiTypes, setSelectedPoiTypes] = useState<string[]>([]);
  const [showPoiDropdown, setShowPoiDropdown] = useState(false);
  const [poiFilterSearch, setPoiFilterSearch] = useState('');

  // Extract all unique POI types from the data
  const allPoiTypes = Array.from(new Set(pois.map((p) => p.type))).filter(Boolean);

  const getPoiCategoryIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('tourist') || t.includes('wisata')) return '🏞️';
    if (t.includes('govern') || t.includes('pemerintah')) return '🏛️';
    if (t.includes('department') || t.includes('mall')) return '🏬';
    if (t.includes('hospital') || t.includes('rumah sakit') || t.includes('klinik')) return '🏥';
    if (t.includes('community') || t.includes('balai')) return '🏘️';
    if (t.includes('supermarket') || t.includes('swalayan')) return '🛒';
    if (t.includes('market') || t.includes('pasar')) return '🏪';
    if (t.includes('school') || t.includes('kampus') || t.includes('sekolah')) return '🏫';
    if (t.includes('transport') || t.includes('terminal') || t.includes('stasiun')) return '🚉';
    if (t.includes('outlet') || t.includes('store') || t.includes('toko')) return '📱';
    return '📍';
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center default on Bangkalan / Madura (-7.05, 112.9)
    const map = L.map(mapContainerRef.current, {
      center: [-7.05, 112.95],
      zoom: 11,
      zoomControl: false,
      attributionControl: false
    });

    const tile = L.tileLayer(tileUrls[mapTheme], {
      maxZoom: 19
    }).addTo(map);

    tileLayerRef.current = tile;

    // Add layers
    gridLayersRef.current = L.layerGroup().addTo(map);
    btsLayersRef.current = L.layerGroup().addTo(map);
    poiLayersRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update base tile when mapTheme changes
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    tileLayerRef.current.setUrl(tileUrls[mapTheme]);
  }, [mapTheme]);

  // Handle external focus / flyTo
  useEffect(() => {
    if (focusedLocation && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([focusedLocation.lat, focusedLocation.lng], 15, {
        duration: 1.5
      });
    }
  }, [focusedLocation]);

  // Render Density Heatmap Layer
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove existing heatmap layer if any
    if (heatLayerRef.current) {
      mapInstanceRef.current.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (!showHeatmap || grids.length === 0) return;

    // Calculate intensity for each grid center
    const heatPoints: [number, number, number][] = [];

    grids.forEach((grid) => {
      let intensity = 0.1;

      if (grid.cat === '1st Priority Acquisition') {
        intensity = 1.0;
      } else if (grid.cat === '2nd Priority Acquisition') {
        intensity = 0.65;
      } else if (grid.cat === '3rd Priority') {
        intensity = 0.35;
      } else {
        // Avoid Cannibalism
        intensity = heatmapMode === 'priority_only' ? 0.0 : 0.08;
      }

      // Skip non-priority if in priority-only mode
      if (heatmapMode === 'priority_only' && grid.cat === 'Avoid Cannibalism') {
        return;
      }

      // Weight by population if requested
      if (heatmapMode === 'population_weighted') {
        const popNorm = Math.min(2.0, Math.max(0.4, (grid.pop || 5000) / 10000));
        intensity = Math.min(1.2, intensity * popNorm);
      }

      heatPoints.push([grid.center[0], grid.center[1], intensity]);
    });

    if (heatPoints.length === 0) return;

    try {
      const heatLayer = (L as any).heatLayer(heatPoints, {
        radius: heatmapRadius,
        blur: heatmapBlur,
        maxZoom: 17,
        max: 1.0,
        minOpacity: 0.28,
        gradient: {
          0.15: '#3b82f6', // Low density: Blue
          0.38: '#06b6d4', // Moderate: Cyan
          0.58: '#10b981', // 2nd Priority: Emerald Green
          0.78: '#f59e0b', // High Priority: Amber
          0.96: '#ef4444'  // 1st Priority Hotspot: Intense Red
        }
      });

      heatLayer.addTo(mapInstanceRef.current);
      heatLayerRef.current = heatLayer;
    } catch (err) {
      console.error('Error rendering heatLayer:', err);
    }
  }, [grids, showHeatmap, heatmapMode, heatmapRadius, heatmapBlur]);

  // Render Grids
  useEffect(() => {
    if (!gridLayersRef.current || !mapInstanceRef.current) return;
    gridLayersRef.current.clearLayers();

    if (grids.length === 0) return;

    const boundsGroup = L.featureGroup();

    grids.forEach((grid) => {
      let fillColor = '#64748b';
      let strokeColor = '#475569';
      // When heatmap is active, make polygon fill more transparent so the heat glow shines through
      let fillOpacity = showHeatmap ? 0.12 : 0.18;

      const category = grid.SF_Grid_Category || grid.cat;
      if (category === '1st Priority Acquisition') {
        fillColor = '#10b981';
        strokeColor = '#059669';
        fillOpacity = showHeatmap ? 0.20 : 0.38;
      } else if (category === '2nd Priority Acquisition') {
        fillColor = '#f97316';
        strokeColor = '#ea580c';
        fillOpacity = showHeatmap ? 0.20 : 0.38;
      } else if (category === '3rd Priority') {
        fillColor = '#ef4444';
        strokeColor = '#dc2626';
        fillOpacity = showHeatmap ? 0.22 : 0.40;
      }

      // Parse WKT polygon if available
      let wktPoints: [number, number][] | null = null;
      if (grid.Geometry_WKT && typeof grid.Geometry_WKT === 'string') {
        const match = grid.Geometry_WKT.match(/POLYGON\s*\(\(\s*(.*?)\s*\)\)/i);
        if (match && match[1]) {
          const parsed = match[1].split(',').map((pair) => {
            const parts = pair.trim().split(/\s+/);
            const lng = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            return [lat, lng] as [number, number];
          }).filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));
          if (parsed.length >= 3) wktPoints = parsed;
        }
      }

      const rect: L.Polygon = wktPoints
        ? L.polygon(wktPoints, {
            color: strokeColor,
            weight: showHeatmap ? 0.9 : 1.1,
            fillColor,
            fillOpacity,
            className: 'transition-all duration-150'
          })
        : L.rectangle(grid.bounds, {
            color: strokeColor,
            weight: showHeatmap ? 0.9 : 1.1,
            fillColor,
            fillOpacity,
            className: 'transition-all duration-150'
          });

      // Hover feedback
      rect.on('mouseover', function (this: L.Polygon) {
        this.setStyle({
          weight: 2.5,
          color: '#ffffff',
          fillOpacity: showHeatmap ? 0.45 : 0.6
        });
      });

      rect.on('mouseout', function (this: L.Polygon) {
        this.setStyle({
          weight: showHeatmap ? 0.9 : 1.1,
          color: strokeColor,
          fillOpacity
        });
      });

      const formattedRev = typeof grid.Rev_August_2026 === 'number'
        ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(grid.Rev_August_2026)
        : String(grid.Rev_August_2026 || 'Rp 0');

      const centerLat = grid.latitude !== undefined ? grid.latitude : grid.center[0];
      const centerLng = grid.longitude !== undefined ? grid.longitude : grid.center[1];

      // Popup content
      const popupHtml = `
        <div class="p-2 space-y-2 text-slate-100 font-sans min-w-[260px]">
          <div class="border-b border-slate-700 pb-1.5 flex items-center justify-between gap-2">
            <div>
              <span class="font-mono font-bold text-xs text-amber-400">#${grid.id}</span>
              <div class="text-xs font-bold text-white">${grid.sitename || `${grid.Kecamatan || grid.kecamatan} Grid`}</div>
            </div>
            <span class="text-[10px] px-2 py-0.5 rounded font-bold whitespace-nowrap ${
              category === '1st Priority Acquisition'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : category === '2nd Priority Acquisition'
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                : category === '3rd Priority'
                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                : 'bg-slate-700 text-slate-300'
            }">${category}</span>
          </div>

          <div class="text-xs space-y-1">
            <div class="text-slate-300">Tipe & Status: <strong class="text-white">${grid.site_type || 'Macro'}</strong> &bull; <span class="text-emerald-400 font-bold">${grid.Device_Status || 'Active'}</span></div>
            <div class="text-slate-300">Wilayah: <strong class="text-white">${grid.City || grid.city}, ${grid.Kecamatan || grid.kecamatan}</strong> (${grid.Region || grid.region})</div>
            <div class="text-slate-300">Meta ID: <strong class="text-white font-mono text-[11px]">${grid.GRID_META_ID || `GM-${grid.id}`}</strong></div>
            <div class="text-slate-300">Rev Aug 2026: <strong class="text-emerald-400 font-bold">${formattedRev}</strong> <span class="text-[10px] text-blue-300">(${grid.Revenue_Flag || 'Rev >40 Mn'})</span></div>
            ${grid.pop ? `<div class="text-slate-400 text-[11px]">Populasi: ${grid.pop.toLocaleString('id-ID')} jiwa &bull; ${grid.bts || 0} BTS</div>` : ''}
          </div>

          <div class="pt-1.5 flex flex-col gap-1.5">
            <a
              href="https://www.google.com/maps/search/?api=1&query=${centerLat},${centerLng}"
              target="_blank"
              rel="noopener noreferrer"
              class="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md text-center no-underline"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
              <span>Go to Location (Google Maps)</span>
            </a>
            ${user?.role === 'ADMIN' ? `
              <button id="btn-edit-${grid.id}" class="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white font-medium py-1 px-2 rounded text-[11px] transition cursor-pointer">
                ⚙️ Edit Grid (Super Admin)
              </button>
            ` : ''}
          </div>
        </div>
      `;

      rect.bindPopup(popupHtml, {
        className: 'dark-leaflet-popup'
      });

      rect.on('popupopen', () => {
        const btn = document.getElementById(`btn-edit-${grid.id}`);
        if (btn && onEditGrid) {
          btn.onclick = () => onEditGrid(grid);
        }
      });

      rect.on('click', () => {
        if (onSelectGrid) onSelectGrid(grid);
      });

      gridLayersRef.current?.addLayer(rect);
      boundsGroup.addLayer(rect);
    });

    // Auto fit bounds if reasonable size
    if (grids.length > 0 && grids.length < 2000) {
      const b = boundsGroup.getBounds();
      if (b.isValid()) {
        mapInstanceRef.current.fitBounds(b, { padding: [20, 20], maxZoom: 13 });
      }
    }
  }, [grids, showHeatmap]);

  // Render BTS
  useEffect(() => {
    if (!btsLayersRef.current) return;
    btsLayersRef.current.clearLayers();

    if (selectedBtsRevs.length === 0) return;

    const visibleBts = btsList.filter((bts) => {
      const flag = bts['Revenue Flag'] || bts.rev || 'Unknown';
      return selectedBtsRevs.includes(flag);
    });

    const renderLimit = 2500;
    const btsToRender = visibleBts.length > renderLimit ? visibleBts.slice(0, renderLimit) : visibleBts;

    btsToRender.forEach((bts) => {
      const lat = bts.latitude ?? bts.lat ?? -7.054;
      const lng = bts.ongitude ?? bts.longitude ?? bts.lng ?? 112.742;
      const sitename = bts.sitename || bts.name || `Tower ${bts.id}`;
      const revFlag = bts['Revenue Flag'] || bts.rev || 'Rev >40 Mn';
      const siteType = bts.site_type || bts.type || 'Macro';
      const siteFunc = bts['Site Function'] || bts.func || 'Residential';
      const aging = bts['Aging (Month)'] ?? bts.aging_month ?? 24;
      const metaId = bts.GRID_META_ID || bts.grid || `GM-${bts.id}`;
      const bsp = bts['BSP Data'] || bts.bsp_data || 'Smartfren Fiber Core';
      const rawRev = bts['Rev.2026'] ?? bts.Rev_2026 ?? 45000000;
      const revFormatted = `Rp ${(Number(rawRev) / 1000000).toFixed(1)} Mn`;

      let markerColor = '#64748b';
      const found = BTS_REV_CONFIG.find((c) => c.key === revFlag);
      if (found) markerColor = found.color;

      const circle = L.circleMarker([lat, lng], {
        radius: 7,
        fillColor: markerColor,
        color: '#ffffff',
        weight: 1.5,
        opacity: 1,
        fillOpacity: 0.95
      });

      const popupHtml = `
        <div class="p-2 space-y-1.5 text-slate-100 font-sans min-w-[240px]">
          <div class="flex items-center justify-between border-b border-slate-700 pb-1">
            <span class="font-bold text-xs text-white">${sitename}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded font-bold text-white shadow-sm" style="background-color: ${markerColor}">${revFlag}</span>
          </div>
          <div class="text-[11px] text-slate-300 space-y-0.5">
            <div>ID: <strong class="text-cyan-400 font-mono">${bts.id}</strong></div>
            <div>Wilayah: <strong class="text-white">${bts.City || bts.city || ''}, ${bts.Kecamatan || bts.kec || ''}</strong></div>
            <div>Tipe & Fungsi: <strong class="text-white">${siteType} &bull; ${siteFunc}</strong></div>
            <div>Aging: <strong class="text-amber-300 font-mono">${aging} Bulan</strong></div>
            <div>GRID_META_ID: <span class="font-mono text-amber-300">${metaId}</span></div>
            <div>Rev.2026: <strong class="text-emerald-400 font-mono">${revFormatted}</strong></div>
            <div>BSP Data: <span class="text-slate-300">${bsp}</span></div>
          </div>
          <div class="pt-1 flex flex-col gap-1">
            <a
              href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}"
              target="_blank"
              rel="noopener noreferrer"
              class="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-400 hover:text-cyan-300 text-xs py-1.5 rounded transition flex items-center justify-center gap-1 text-center no-underline font-medium"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
              <span>Go to Location (Google Maps)</span>
            </a>
            ${user?.role === 'ADMIN' ? `
              <button id="btn-edit-bts-${bts.id}" class="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[11px] py-1 rounded transition cursor-pointer">
                ⚙️ Edit Data BTS (16 Fields Master)
              </button>
            ` : ''}
          </div>
        </div>
      `;

      circle.bindPopup(popupHtml);

      circle.on('popupopen', () => {
        const btn = document.getElementById(`btn-edit-bts-${bts.id}`);
        if (btn && onEditBTS) {
          btn.onclick = () => onEditBTS(bts);
        }
      });

      btsLayersRef.current?.addLayer(circle);
    });
  }, [btsList, selectedBtsRevs]);

  // Render POIs
  useEffect(() => {
    if (!poiLayersRef.current) return;
    poiLayersRef.current.clearLayers();

    if (selectedPoiTypes.length === 0) return;

    const visiblePois = pois.filter((poi) => selectedPoiTypes.includes(poi.type));

    visiblePois.forEach((poi) => {
      const poiMarker = L.circleMarker([poi.lat, poi.lng], {
        radius: 4.5,
        fillColor: '#06b6d4',
        color: '#ffffff',
        weight: 1,
        fillOpacity: 0.85
      });

      poiMarker.bindPopup(`
        <div class="p-1.5 text-slate-100 font-sans text-xs">
          <div class="font-bold text-cyan-300 flex items-center gap-1">
            <span>${getPoiCategoryIcon(poi.type)}</span>
            <span>${poi.name}</span>
          </div>
          <div class="text-[11px] text-slate-300 mt-0.5">${poi.type}</div>
          <div class="text-[10px] text-slate-400 mt-1">${poi.city}, ${poi.kec}</div>
        </div>
      `);

      poiLayersRef.current?.addLayer(poiMarker);
    });
  }, [pois, selectedPoiTypes]);

  // Counts for display in buttons
  const visiblePoiCount = pois.filter((p) => selectedPoiTypes.includes(p.type)).length;
  const visibleBtsCount = btsList.filter((b) => selectedBtsRevs.includes(b.rev || 'Unknown')).length;

  return (
    <div
      className={`relative w-full h-[540px] sm:h-[600px] lg:h-[640px] ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      } rounded-2xl border shadow-2xl flex flex-col`}
    >
      {/* Stacked Top Header Controls */}
      <div
        className={`${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
        } rounded-t-2xl border-b px-3 sm:px-4 py-2.5 z-[1001] flex flex-wrap items-center justify-between gap-2 shrink-0 select-none shadow-sm relative`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {/* POI Dropdown Filter Button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowPoiDropdown(!showPoiDropdown);
                setShowBtsDropdown(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border cursor-pointer ${
                visiblePoiCount > 0
                  ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                  : isDarkMode
                  ? 'bg-slate-950 text-slate-300 border-slate-700 hover:bg-slate-800'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span>POI ({visiblePoiCount})</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPoiDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* POI Dropdown Modal Panel */}
            {showPoiDropdown && (
              <>
                <div
                  className="fixed inset-0 z-[1002] bg-black/20"
                  onClick={() => setShowPoiDropdown(false)}
                />
                <div
                  className={`absolute top-full left-0 mt-2 w-72 max-h-[380px] ${
                    isDarkMode ? 'bg-slate-900/98 border-slate-700/80 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-2xl'
                  } backdrop-blur-md border rounded-2xl p-3 shadow-2xl z-[1003] flex flex-col gap-2.5`}
                >
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Cari kategori POI..."
                      value={poiFilterSearch}
                      onChange={(e) => setPoiFilterSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* List of categories */}
                  <div className="overflow-y-auto max-h-52 space-y-1 pr-1 custom-scrollbar">
                    {allPoiTypes
                      .filter((type) => type.toLowerCase().includes(poiFilterSearch.toLowerCase()))
                      .map((type) => {
                        const count = pois.filter((p) => p.type === type).length;
                        const percent = pois.length > 0 ? ((count / pois.length) * 100).toFixed(1) : '0.0';
                        const isChecked = selectedPoiTypes.includes(type);

                        return (
                          <label
                            key={type}
                            className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer transition select-none"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedPoiTypes(selectedPoiTypes.filter((t) => t !== type));
                                  } else {
                                    setSelectedPoiTypes([...selectedPoiTypes, type]);
                                  }
                                }}
                                className="rounded border-slate-700 text-blue-500 focus:ring-0 cursor-pointer"
                              />
                              <span className="text-sm shrink-0">{getPoiCategoryIcon(type)}</span>
                              <span className="text-xs text-slate-200 truncate">{type}</span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono shrink-0 ml-2">
                              {count} ({percent}%)
                            </span>
                          </label>
                        );
                      })}
                  </div>

                  {/* Bottom Actions: Semua & Tidak Ada */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSelectedPoiTypes(allPoiTypes)}
                      className="flex-1 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold transition cursor-pointer"
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPoiTypes([])}
                      className="flex-1 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold transition cursor-pointer"
                    >
                      Tidak Ada
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* BTS/Tower Dropdown Filter Button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowBtsDropdown(!showBtsDropdown);
                setShowPoiDropdown(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border cursor-pointer ${
                visibleBtsCount > 0
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm'
                  : isDarkMode
                  ? 'bg-slate-950 text-slate-300 border-slate-700 hover:bg-slate-800'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span>BTS/Tower ({visibleBtsCount})</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showBtsDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* BTS Dropdown Modal Panel */}
            {showBtsDropdown && (
              <>
                <div
                  className="fixed inset-0 z-[1002] bg-black/20"
                  onClick={() => setShowBtsDropdown(false)}
                />
                <div
                  className={`absolute top-full left-0 mt-2 w-64 ${
                    isDarkMode ? 'bg-slate-900/98 border-slate-700/80 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-2xl'
                  } backdrop-blur-md border rounded-2xl p-3 shadow-2xl z-[1003] flex flex-col gap-2.5`}
                >
                  <div className="space-y-1 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {BTS_REV_CONFIG.map((cfg) => {
                      const count = btsList.filter((b) => (b.rev || 'Unknown') === cfg.key).length;
                      const percent = btsList.length > 0 ? ((count / btsList.length) * 100).toFixed(1) : '0.0';
                      const isChecked = selectedBtsRevs.includes(cfg.key);

                      return (
                        <label
                          key={cfg.key}
                          className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer transition select-none"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedBtsRevs(selectedBtsRevs.filter((k) => k !== cfg.key));
                                } else {
                                  setSelectedBtsRevs([...selectedBtsRevs, cfg.key]);
                                }
                              }}
                              className="rounded border-slate-700 text-blue-500 focus:ring-0 cursor-pointer"
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-xs shrink-0 shadow-xs"
                              style={{ backgroundColor: cfg.color }}
                            />
                            <span className="text-xs text-slate-200">{cfg.label}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono shrink-0 ml-2">
                            {count} ({percent}%)
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Bottom Actions: Semua & Tidak Ada */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSelectedBtsRevs(BTS_REV_CONFIG.map((c) => c.key))}
                      className="flex-1 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold transition cursor-pointer"
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedBtsRevs([])}
                      className="flex-1 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold transition cursor-pointer"
                    >
                      Tidak Ada
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Base Map Switcher: Light / Dark / Satelit */}
          <div
            className={`${
              isDarkMode ? 'bg-slate-950 border-slate-700' : 'bg-slate-200 border-slate-300'
            } border rounded-lg p-0.5 flex items-center gap-0.5 shadow-sm`}
          >
            <button
              onClick={() => setMapTheme('osm')}
              className={`px-2.5 py-1 text-[11px] rounded-md font-semibold transition cursor-pointer ${
                mapTheme === 'osm'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDarkMode
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Light
            </button>
            <button
              onClick={() => setMapTheme('dark')}
              className={`px-2.5 py-1 text-[11px] rounded-md font-semibold transition cursor-pointer ${
                mapTheme === 'dark'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDarkMode
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dark
            </button>
            <button
              onClick={() => setMapTheme('satellite')}
              className={`px-2.5 py-1 text-[11px] rounded-md font-semibold transition cursor-pointer ${
                mapTheme === 'satellite'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDarkMode
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Satelit
            </button>
          </div>
        </div>

        {/* Stacked Map Zoom Controls in Toolbar */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className={`w-7 h-7 ${
              isDarkMode
                ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-white'
                : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
            } border rounded-lg flex items-center justify-center text-xs font-bold transition shadow-xs cursor-pointer`}
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className={`w-7 h-7 ${
              isDarkMode
                ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-white'
                : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
            } border rounded-lg flex items-center justify-center text-xs font-bold transition shadow-xs cursor-pointer`}
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Map DOM Element Canvas */}
      <div className="relative flex-1 w-full h-full min-h-0 overflow-hidden rounded-b-2xl z-0">
        <div ref={mapContainerRef} className="w-full h-full" id="map-canvas" />

        {/* Footer Caption Overlay */}
        <div
          className={`absolute bottom-2 left-3 right-3 sm:right-auto z-[900] ${
            isDarkMode ? 'bg-slate-950/90 border-slate-800 text-slate-400' : 'bg-white/90 border-slate-200 text-slate-600'
          } border rounded-lg px-3 py-1.5 text-[11px] shadow-xl backdrop-blur-sm pointer-events-none flex items-center gap-2`}
        >
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          <span>Klik poligon Grid atau marker BTS / POI untuk analisis akuisisi & penetrasi pasar.</span>
        </div>
      </div>
    </div>
  );
};
