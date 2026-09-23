import React, { useState } from 'react';
import type { GridItem, UserProfile } from '../types';
import { Search, Download, Edit2, Trash2, Navigation, ChevronLeft, ChevronRight, Compass, Copy, Check, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

interface GridTableProps {
  grids: GridItem[];
  user?: UserProfile | null;
  onLocate: (grid: GridItem) => void;
  onEdit: (grid: GridItem) => void;
  onDelete: (gridId: string) => void;
}

export const GridTable: React.FC<GridTableProps> = ({
  grids,
  user,
  onLocate,
  onEdit,
  onDelete
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const pageSize = 15;

  const filtered = grids.filter((g) => {
    const q = searchTerm.toLowerCase();
    const id = (g.id || '').toLowerCase();
    const sitename = (g.sitename || '').toLowerCase();
    const site_type = (g.site_type || '').toLowerCase();
    const province = (g.Province || g.province || '').toLowerCase();
    const city = (g.City || g.city || '').toLowerCase();
    const kecamatan = (g.Kecamatan || g.kecamatan || '').toLowerCase();
    const region = (g.Region || g.region || '').toLowerCase();
    const metaId = (g.GRID_META_ID || '').toLowerCase();
    const revFlag = (g.Revenue_Flag || '').toLowerCase();
    const category = (g.SF_Grid_Category || g.cat || '').toLowerCase();
    const status = (g.Device_Status || '').toLowerCase();

    return (
      id.includes(q) ||
      sitename.includes(q) ||
      site_type.includes(q) ||
      province.includes(q) ||
      city.includes(q) ||
      kecamatan.includes(q) ||
      region.includes(q) ||
      metaId.includes(q) ||
      revFlag.includes(q) ||
      category.includes(q) ||
      status.includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const pagedGrids = filtered.slice(startIndex, startIndex + pageSize);

  const formatRupiah = (val: number | string | undefined) => {
    if (val === undefined || val === null || val === '') return 'Rp 0';
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
    if (isNaN(num)) return String(val);
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  };

  const copyWktToClipboard = (id: string, wkt: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(wkt);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const getExportRows = () => {
    return filtered.map((g) => {
      const lat = g.latitude !== undefined ? g.latitude : g.center?.[0] ?? 0;
      const lng = g.longitude !== undefined ? g.longitude : g.center?.[1] ?? 0;
      return {
        id: g.id,
        sitename: g.sitename || `${g.Kecamatan || g.kecamatan} Grid ${g.id.slice(-4)}`,
        site_type: g.site_type || (g.SF_Grid_Category === '1st Priority Acquisition' ? 'Macro' : 'Micro'),
        Province: g.Province || g.province || 'JAWA TIMUR (4672)',
        City: g.City || g.city || 'KAB. BANGKALAN',
        Kecamatan: g.Kecamatan || g.kecamatan || '',
        Region: g.Region || g.region || 'EAST JAVA',
        latitude: lat,
        longitude: lng,
        GRID_META_ID: g.GRID_META_ID || `GM-${g.id}`,
        Rev_August_2026: typeof g.Rev_August_2026 === 'number' ? g.Rev_August_2026 : (parseFloat(String(g.Rev_August_2026)) || 0),
        Revenue_Flag: g.Revenue_Flag || 'Rev 20-30 Mn',
        SF_Grid_Category: g.SF_Grid_Category || g.cat || 'Avoid Cannibalism',
        Geometry_WKT: g.Geometry_WKT || '',
        Device_Status: g.Device_Status || 'Active'
      };
    });
  };

  const exportExcel = () => {
    const exportData = getExportRows();
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Grid_Data');
    XLSX.writeFile(wb, `GRID_Data_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportCSV = () => {
    const exportData = getExportRows();
    const ws = XLSX.utils.json_to_sheet(exportData);
    const csvContent = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GRID_Data_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-5 text-slate-900 overflow-hidden">
      {/* Table Header Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Katalog Master GRID Terintegrasi
            </h3>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              15 Header Aktif
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Format: id, sitename, site_type, Province, City, Kecamatan, Region, latitude, longitude, GRID_META_ID, Rev_August_2026, Revenue_Flag, SF_Grid_Category, Geometry_WKT, Device_Status
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari ID, Sitename, Meta ID, Wilayah..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium transition"
            />
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={exportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
              title="Unduh Excel dengan 15 Header"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
            <button
              onClick={exportCSV}
              className="bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
              title="Unduh CSV murni dengan 15 Header"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px] whitespace-nowrap">
              <th className="p-3">ID</th>
              <th className="p-3">SITENAME</th>
              <th className="p-3">SITE TYPE</th>
              <th className="p-3">PROVINCE</th>
              <th className="p-3">CITY</th>
              <th className="p-3">KECAMATAN</th>
              <th className="p-3">REGION</th>
              <th className="p-3">COORDINATES</th>
              <th className="p-3">GRID META ID</th>
              <th className="p-3 text-right">REV AUG 2026</th>
              <th className="p-3">REVENUE FLAG</th>
              <th className="p-3">SF GRID CATEGORY</th>
              <th className="p-3">GEOMETRY WKT</th>
              <th className="p-3">DEVICE STATUS</th>
              <th className="p-3 text-center sticky right-0 bg-slate-100/95 shadow-sm">AKSI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
            {pagedGrids.length === 0 ? (
              <tr>
                <td colSpan={15} className="text-center py-10 text-slate-400 font-medium">
                  Tidak ada data grid yang cocok dengan kriteria pencarian.
                </td>
              </tr>
            ) : (
              pagedGrids.map((item) => {
                const category = item.SF_Grid_Category || item.cat || 'Avoid Cannibalism';
                let catBadge = 'bg-slate-100 text-slate-700 border-slate-300';
                if (category === '1st Priority Acquisition') {
                  catBadge = 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold';
                } else if (category === '2nd Priority Acquisition') {
                  catBadge = 'bg-orange-50 text-orange-700 border-orange-300 font-bold';
                } else if (category === '3rd Priority') {
                  catBadge = 'bg-red-50 text-red-700 border-red-300 font-bold';
                }

                const revFlag = item.Revenue_Flag || 'Rev 20-30 Mn';
                let revBadge = 'bg-slate-100 text-slate-700 border-slate-300';
                if (revFlag === 'Rev >40 Mn') {
                  revBadge = 'bg-blue-50 text-blue-700 border-blue-300 font-bold';
                } else if (revFlag === 'Rev 30-40 Mn') {
                  revBadge = 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold';
                } else if (revFlag === 'Rev 20-30 Mn') {
                  revBadge = 'bg-amber-50 text-amber-700 border-amber-300 font-medium';
                }

                const status = item.Device_Status || 'Active';
                const isNormal = status === 'Active' || status === 'Normal';

                const lat = item.latitude !== undefined ? item.latitude : item.center?.[0] ?? 0;
                const lng = item.longitude !== undefined ? item.longitude : item.center?.[1] ?? 0;

                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition border-b border-slate-100 whitespace-nowrap">
                    {/* id */}
                    <td className="p-3 font-mono font-bold text-slate-900">{item.id}</td>

                    {/* sitename */}
                    <td className="p-3 font-semibold text-slate-800">
                      {item.sitename || `${item.Kecamatan || item.kecamatan} Grid ${item.id.slice(-4)}`}
                    </td>

                    {/* site_type */}
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {item.site_type || (category === '1st Priority Acquisition' ? 'Macro' : 'Micro')}
                      </span>
                    </td>

                    {/* Province */}
                    <td className="p-3 text-slate-600">{item.Province || item.province}</td>

                    {/* City */}
                    <td className="p-3 text-slate-700 font-medium">{item.City || item.city}</td>

                    {/* Kecamatan */}
                    <td className="p-3 text-slate-800 font-semibold">{item.Kecamatan || item.kecamatan}</td>

                    {/* Region */}
                    <td className="p-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {item.Region || item.region}
                      </span>
                    </td>

                    {/* latitude & longitude */}
                    <td className="p-3 font-mono text-[11px] text-slate-600">
                      {lat.toFixed(4)}, {lng.toFixed(4)}
                    </td>

                    {/* GRID_META_ID */}
                    <td className="p-3 font-mono text-[11px] text-slate-500">
                      {item.GRID_META_ID || `GM-${item.id}`}
                    </td>

                    {/* Rev_August_2026 */}
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      {formatRupiah(item.Rev_August_2026)}
                    </td>

                    {/* Revenue_Flag */}
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] border inline-block ${revBadge}`}>
                        {revFlag}
                      </span>
                    </td>

                    {/* SF_Grid_Category */}
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] border inline-block ${catBadge}`}>
                        {category}
                      </span>
                    </td>

                    {/* Geometry_WKT */}
                    <td className="p-3 font-mono text-[10px] text-slate-500 max-w-[140px] truncate" title={item.Geometry_WKT}>
                      <div className="flex items-center gap-1.5">
                        <span className="truncate max-w-[100px]">{item.Geometry_WKT || '-'}</span>
                        {item.Geometry_WKT && (
                          <button
                            onClick={() => copyWktToClipboard(item.id, item.Geometry_WKT)}
                            className="p-1 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                            title="Salin Geometry WKT"
                          >
                            {copiedId === item.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Device_Status */}
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        isNormal
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isNormal ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {status}
                      </span>
                    </td>

                    {/* Aksi */}
                    <td className="p-3 text-center sticky right-0 bg-white/95 backdrop-blur-xs border-l border-slate-100 shadow-xs">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onLocate(item)}
                          className="p-1.5 hover:bg-blue-50 text-blue-600 rounded transition cursor-pointer"
                          title="Fokuskan Peta ke Grid ini"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded transition cursor-pointer"
                          title="Buka Google Maps"
                        >
                          <Compass className="w-3.5 h-3.5" />
                        </a>
                        {user?.role === 'ADMIN' ? (
                          <>
                            <button
                              onClick={() => onEdit(item)}
                              className="p-1.5 hover:bg-amber-50 text-amber-600 rounded transition cursor-pointer"
                              title="Edit Grid di Database (Super Admin)"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Hapus grid ${item.id} dari database?`)) {
                                  onDelete(item.id);
                                }
                              }}
                              className="p-1.5 hover:bg-red-50 text-red-600 rounded transition cursor-pointer"
                              title="Hapus Grid (Super Admin)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic px-1 font-medium select-none" title="Hanya Super Admin yang berhak mengedit data">
                            Read-Only
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination & Status Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>Menampilkan <strong className="text-slate-800 font-bold">{filtered.length}</strong> grid</span>
          <span className="text-slate-300">•</span>
          <span className="flex items-center gap-1 text-emerald-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            15 Atribut WKT & Database Aktif
          </span>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2 py-1 rounded border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-medium text-slate-700">
              Halaman {currentPage} dari {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2 py-1 rounded border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
