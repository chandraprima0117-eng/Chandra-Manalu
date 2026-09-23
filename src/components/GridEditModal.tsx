import React, { useState, useEffect } from 'react';
import { X, Save, Layers, Sparkles } from 'lucide-react';
import type { GridItem, GridCategory, RevenueFlag } from '../types';

interface GridEditModalProps {
  isOpen: boolean;
  grid: GridItem | null;
  onClose: () => void;
  onSave: (grid: GridItem) => Promise<void>;
}

export const GridEditModal: React.FC<GridEditModalProps> = ({
  isOpen,
  grid,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState<Partial<GridItem>>({
    id: '',
    sitename: '',
    site_type: 'Macro',
    Province: 'JAWA TIMUR (4672)',
    City: 'KAB. BANGKALAN',
    Kecamatan: 'Bangkalan',
    Region: 'EAST JAVA',
    latitude: -7.045,
    longitude: 112.915,
    GRID_META_ID: '',
    Rev_August_2026: 42000000,
    Revenue_Flag: 'Rev >40 Mn',
    SF_Grid_Category: '1st Priority Acquisition',
    Geometry_WKT: '',
    Device_Status: 'Active'
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (grid) {
      const lat = grid.latitude !== undefined ? grid.latitude : grid.center?.[0] ?? -7.045;
      const lng = grid.longitude !== undefined ? grid.longitude : grid.center?.[1] ?? 112.915;
      const step = 0.022;
      const defaultWkt = `POLYGON ((${Number((lng - step / 2).toFixed(6))} ${Number((lat - step / 2).toFixed(6))}, ${Number((lng + step / 2).toFixed(6))} ${Number((lat - step / 2).toFixed(6))}, ${Number((lng + step / 2).toFixed(6))} ${Number((lat + step / 2).toFixed(6))}, ${Number((lng - step / 2).toFixed(6))} ${Number((lat + step / 2).toFixed(6))}, ${Number((lng - step / 2).toFixed(6))} ${Number((lat - step / 2).toFixed(6))}))`;

      setFormData({
        ...grid,
        id: grid.id,
        sitename: grid.sitename || `${grid.Kecamatan || grid.kecamatan} Grid ${grid.id.slice(-4)}`,
        site_type: grid.site_type || 'Macro',
        Province: grid.Province || grid.province || 'JAWA TIMUR (4672)',
        City: grid.City || grid.city || 'KAB. BANGKALAN',
        Kecamatan: grid.Kecamatan || grid.kecamatan || 'Bangkalan',
        Region: grid.Region || grid.region || 'EAST JAVA',
        latitude: lat,
        longitude: lng,
        GRID_META_ID: grid.GRID_META_ID || `GM-${grid.id}`,
        Rev_August_2026: grid.Rev_August_2026 !== undefined ? grid.Rev_August_2026 : 35000000,
        Revenue_Flag: grid.Revenue_Flag || 'Rev 30-40 Mn',
        SF_Grid_Category: grid.SF_Grid_Category || grid.cat || '1st Priority Acquisition',
        Geometry_WKT: grid.Geometry_WKT || defaultWkt,
        Device_Status: grid.Device_Status || 'Active'
      });
    } else {
      const newId = `3526${Math.floor(100000 + Math.random() * 900000)}`;
      const lat = -7.045;
      const lng = 112.915;
      const step = 0.022;
      const defaultWkt = `POLYGON ((${Number((lng - step / 2).toFixed(6))} ${Number((lat - step / 2).toFixed(6))}, ${Number((lng + step / 2).toFixed(6))} ${Number((lat - step / 2).toFixed(6))}, ${Number((lng + step / 2).toFixed(6))} ${Number((lat + step / 2).toFixed(6))}, ${Number((lng - step / 2).toFixed(6))} ${Number((lat + step / 2).toFixed(6))}, ${Number((lng - step / 2).toFixed(6))} ${Number((lat - step / 2).toFixed(6))}))`;

      setFormData({
        id: newId,
        sitename: `Bangkalan Sentral Baru`,
        site_type: 'Macro',
        Province: 'JAWA TIMUR (4672)',
        City: 'KAB. BANGKALAN',
        Kecamatan: 'Bangkalan',
        Region: 'EAST JAVA',
        latitude: lat,
        longitude: lng,
        GRID_META_ID: `GM-${newId}`,
        Rev_August_2026: 45000000,
        Revenue_Flag: 'Rev >40 Mn',
        SF_Grid_Category: '1st Priority Acquisition',
        Geometry_WKT: defaultWkt,
        Device_Status: 'Active'
      });
    }
  }, [grid, isOpen]);

  if (!isOpen) return null;

  // Auto calculate Revenue_Flag when Rev_August_2026 is updated
  const handleRevenueChange = (val: string) => {
    const num = parseFloat(val.replace(/[^0-9.-]+/g, '')) || 0;
    let flag: RevenueFlag = 'Rev <20 Mn';
    if (num >= 40000000) flag = 'Rev >40 Mn';
    else if (num >= 30000000) flag = 'Rev 30-40 Mn';
    else if (num >= 20000000) flag = 'Rev 20-30 Mn';
    else if (num > 0) flag = 'Rev <20 Mn';
    else flag = 'Rev 0';

    setFormData((prev) => ({
      ...prev,
      Rev_August_2026: num,
      Revenue_Flag: flag
    }));
  };

  const handleCoordsChange = (newLat: number, newLng: number) => {
    const step = 0.022;
    const wkt = `POLYGON ((${Number((newLng - step / 2).toFixed(6))} ${Number((newLat - step / 2).toFixed(6))}, ${Number((newLng + step / 2).toFixed(6))} ${Number((newLat - step / 2).toFixed(6))}, ${Number((newLng + step / 2).toFixed(6))} ${Number((newLat + step / 2).toFixed(6))}, ${Number((newLng - step / 2).toFixed(6))} ${Number((newLat + step / 2).toFixed(6))}, ${Number((newLng - step / 2).toFixed(6))} ${Number((newLat - step / 2).toFixed(6))}))`;

    setFormData((prev) => ({
      ...prev,
      latitude: newLat,
      longitude: newLng,
      Geometry_WKT: wkt
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id || !formData.City) return;

    setSaving(true);
    try {
      const lat = Number(formData.latitude) || -7.05;
      const lng = Number(formData.longitude) || 112.92;
      const step = 0.022;
      const bounds: [[number, number], [number, number]] = [
        [lat - step / 2, lng - step / 2],
        [lat + step / 2, lng + step / 2]
      ];

      const cat = (formData.SF_Grid_Category || formData.cat || '1st Priority Acquisition') as GridCategory;

      const fullGrid: GridItem = {
        id: formData.id,
        sitename: formData.sitename || `${formData.Kecamatan} Grid ${formData.id.slice(-4)}`,
        site_type: formData.site_type || 'Macro',
        Province: formData.Province || 'JAWA TIMUR (4672)',
        City: formData.City || 'KAB. BANGKALAN',
        Kecamatan: formData.Kecamatan || 'Bangkalan',
        Region: formData.Region || 'EAST JAVA',
        latitude: lat,
        longitude: lng,
        GRID_META_ID: formData.GRID_META_ID || `GM-${formData.id}`,
        Rev_August_2026: formData.Rev_August_2026 ?? 35000000,
        Revenue_Flag: formData.Revenue_Flag || 'Rev 30-40 Mn',
        SF_Grid_Category: cat,
        Geometry_WKT: formData.Geometry_WKT || `POLYGON ((${lng - step / 2} ${lat - step / 2}, ${lng + step / 2} ${lat - step / 2}, ${lng + step / 2} ${lat + step / 2}, ${lng - step / 2} ${lat + step / 2}, ${lng - step / 2} ${lat - step / 2}))`,
        Device_Status: formData.Device_Status || 'Active',

        // Aliases
        region: formData.Region || 'EAST JAVA',
        province: formData.Province || 'JAWA TIMUR (4672)',
        city: formData.City || 'KAB. BANGKALAN',
        kecamatan: formData.Kecamatan || 'Bangkalan',
        cat,
        bounds,
        center: [lat, lng],
        pop: Number(formData.pop) || 8500,
        tsel: formData.tsel || '42.0%',
        xlco: formData.xlco || '30.0%',
        xl: formData.xlco || '30.0%',
        ioh: formData.ioh || '18.0%',
        sf: formData.sf || '10.0%',
        bts: Number(formData.bts) || 1,
        poi: Number(formData.poi) || 8,
        prom: formData.prom || 'MULTIBRAND'
      };

      await onSave(fullGrid);
      onClose();
    } catch (err: any) {
      alert('Gagal menyimpan grid: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[99999] isolate bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
      style={{ zIndex: 99999 }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl text-slate-100 my-8">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              <span>{grid ? `Edit Grid #${grid.id}` : 'Tambah Master Grid Baru'}</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              15 Header: id, sitename, site_type, Province, City, Kecamatan, Region, latitude, longitude, GRID_META_ID, Rev_August_2026, Revenue_Flag, SF_Grid_Category, Geometry_WKT, Device_Status
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Row 1: id, sitename, site_type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 font-bold mb-1 uppercase text-[10px]">id (Grid ID)</label>
              <input
                type="text"
                required
                value={formData.id || ''}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                placeholder="3526001001"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-bold mb-1 uppercase text-[10px]">sitename</label>
              <input
                type="text"
                required
                value={formData.sitename || ''}
                onChange={(e) => setFormData({ ...formData, sitename: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-medium"
                placeholder="Bangkalan Sentral 1"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-bold mb-1 uppercase text-[10px]">site_type</label>
              <select
                value={formData.site_type || 'Macro'}
                onChange={(e) => setFormData({ ...formData, site_type: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-semibold"
              >
                <option value="Macro">Macro</option>
                <option value="Micro">Micro</option>
                <option value="Pole">Pole</option>
                <option value="Small Cell">Small Cell</option>
                <option value="In-Building">In-Building</option>
              </select>
            </div>
          </div>

          {/* Row 2: Province, City, Kecamatan, Region */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-400 font-bold mb-1 uppercase text-[10px]">Province</label>
              <input
                type="text"
                required
                value={formData.Province || ''}
                onChange={(e) => setFormData({ ...formData, Province: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-bold mb-1 uppercase text-[10px]">City</label>
              <input
                type="text"
                required
                value={formData.City || ''}
                onChange={(e) => setFormData({ ...formData, City: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-bold mb-1 uppercase text-[10px]">Kecamatan</label>
              <input
                type="text"
                required
                value={formData.Kecamatan || ''}
                onChange={(e) => setFormData({ ...formData, Kecamatan: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-bold mb-1 uppercase text-[10px]">Region</label>
              <input
                type="text"
                required
                value={formData.Region || ''}
                onChange={(e) => setFormData({ ...formData, Region: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-medium"
              />
            </div>
          </div>

          {/* Row 3: latitude, longitude, GRID_META_ID */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 font-bold mb-1 uppercase text-[10px]">latitude</label>
              <input
                type="number"
                step="any"
                required
                value={formData.latitude !== undefined ? formData.latitude : -7.045}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  handleCoordsChange(val, formData.longitude !== undefined ? formData.longitude : 112.915);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-bold mb-1 uppercase text-[10px]">longitude</label>
              <input
                type="number"
                step="any"
                required
                value={formData.longitude !== undefined ? formData.longitude : 112.915}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  handleCoordsChange(formData.latitude !== undefined ? formData.latitude : -7.045, val);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-bold mb-1 uppercase text-[10px]">GRID_META_ID</label>
              <input
                type="text"
                value={formData.GRID_META_ID || ''}
                onChange={(e) => setFormData({ ...formData, GRID_META_ID: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                placeholder="GM-3526001001"
              />
            </div>
          </div>

          {/* Row 4: Rev_August_2026, Revenue_Flag, SF_Grid_Category, Device_Status */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div>
              <label className="block text-emerald-400 font-bold mb-1 uppercase text-[10px]">Rev_August_2026 (IDR)</label>
              <input
                type="number"
                value={formData.Rev_August_2026 || 0}
                onChange={(e) => handleRevenueChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-white text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-blue-400 font-bold mb-1 uppercase text-[10px]">Revenue_Flag</label>
              <select
                value={formData.Revenue_Flag || 'Rev >40 Mn'}
                onChange={(e) => setFormData({ ...formData, Revenue_Flag: e.target.value as any })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-white text-xs font-semibold"
              >
                <option value="Rev >40 Mn">Rev &gt;40 Mn</option>
                <option value="Rev 30-40 Mn">Rev 30-40 Mn</option>
                <option value="Rev 20-30 Mn">Rev 20-30 Mn</option>
                <option value="Rev <20 Mn">Rev &lt;20 Mn</option>
                <option value="Rev 0">Rev 0</option>
              </select>
            </div>
            <div>
              <label className="block text-amber-400 font-bold mb-1 uppercase text-[10px]">SF_Grid_Category</label>
              <select
                value={formData.SF_Grid_Category || '1st Priority Acquisition'}
                onChange={(e) => setFormData({ ...formData, SF_Grid_Category: e.target.value as any })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-white text-xs font-semibold"
              >
                <option value="1st Priority Acquisition">1st Priority Acquisition</option>
                <option value="2nd Priority Acquisition">2nd Priority Acquisition</option>
                <option value="3rd Priority">3rd Priority</option>
                <option value="Avoid Cannibalism">Avoid Cannibalism</option>
              </select>
            </div>
            <div>
              <label className="block text-purple-400 font-bold mb-1 uppercase text-[10px]">Device_Status</label>
              <select
                value={formData.Device_Status || 'Active'}
                onChange={(e) => setFormData({ ...formData, Device_Status: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-white text-xs font-semibold"
              >
                <option value="Active">Active</option>
                <option value="Normal">Normal</option>
                <option value="High Load">High Load</option>
                <option value="Under Maintenance">Under Maintenance</option>
                <option value="Degraded">Degraded</option>
                <option value="Offline">Offline</option>
              </select>
            </div>
          </div>

          {/* Row 5: Geometry_WKT */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-slate-400 font-bold uppercase text-[10px]">Geometry_WKT (GIS Polygon)</label>
              <button
                type="button"
                onClick={() => {
                  const lat = Number(formData.latitude) || -7.045;
                  const lng = Number(formData.longitude) || 112.915;
                  handleCoordsChange(lat, lng);
                }}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>Hitung Ulang WKT dari Koordinat</span>
              </button>
            </div>
            <textarea
              rows={2}
              value={formData.Geometry_WKT || ''}
              onChange={(e) => setFormData({ ...formData, Geometry_WKT: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono text-[11px]"
              placeholder="POLYGON ((112.66 -7.22, 112.68 -7.22, ...))"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Menyimpan ke Database...' : 'Simpan ke Database'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2.5 rounded-lg transition cursor-pointer"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
