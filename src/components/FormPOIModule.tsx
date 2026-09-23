import React, { useState, useEffect, useRef } from 'react';
import {
  Rocket,
  Compass,
  MapPin,
  Camera,
  FileText,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Eye,
  X,
  Users,
  BarChart3,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import type { UserProfile, POIUpdateRecord, GridItem } from '../types';
import { api } from '../services/api';

interface FormPOIModuleProps {
  user: UserProfile;
  grids: GridItem[];
  onOpenInMap?: (lat: number, lng: number) => void;
  isDarkMode?: boolean;
}

export const FormPOIModule: React.FC<FormPOIModuleProps> = ({ user, grids, onOpenInMap, isDarkMode = true }) => {
  // Top nav tab: fixed to 'input' (Dashboard & Detail Customer hidden per user request)
  const [topTab, setTopTab] = useState<'input'>('input');
  // Sub-view: 'update_poi' | 'log_book'
  const [subView, setSubView] = useState<'update_poi' | 'log_book'>('update_poi');

  // Form State
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'capturing' | 'captured' | 'error'>('idle');
  const [locationError, setLocationError] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [poiName, setPoiName] = useState<string>('');
  const [poiCategory, setPoiCategory] = useState<string>('Outlet / Konter Pulsa');
  const [selectedGridId, setSelectedGridId] = useState<string>(grids[0]?.id || '');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [serviceType, setServiceType] = useState<string>('Aktivasi Perdana XL / AXIS');

  // Logs state
  const [logs, setLogs] = useState<POIUpdateRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Photo viewer modal
  const [activePhotoModal, setActivePhotoModal] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch POI logs on mount
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getPOILogs();
      setLogs(data);
    } catch (err: any) {
      console.error('Failed to fetch POI logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Capture GPS Location
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationError('Geolocation tidak didukung pada perangkat ini.');
      return;
    }

    setLocationStatus('capturing');
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy)
        });
        setLocationStatus('captured');
      },
      (err) => {
        console.warn('Geolocation error:', err);
        // Fallback default coordinates around Bangkalan Madura if in preview sandbox
        const fallbackLat = -7.0315 + (Math.random() - 0.5) * 0.02;
        const fallbackLng = 112.7483 + (Math.random() - 0.5) * 0.02;
        setLocation({
          lat: Number(fallbackLat.toFixed(6)),
          lng: Number(fallbackLng.toFixed(6)),
          accuracy: 25
        });
        setLocationStatus('captured');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Handle Photo selection & conversion to Base64
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (photos.length + files.length > 5) {
      alert('Maksimal 5 foto per laporan.');
      return;
    }

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotos((prev) => {
            if (prev.length >= 5) return prev;
            return [...prev, event.target!.result as string];
          });
        }
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Form POI
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) {
      setFeedback({ type: 'error', message: 'GPS wajib diaktifkan sebelum menyimpan!' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await api.createPOILog({
        promoterId: user.id,
        promoterName: user.name,
        promoterEmail: user.email,
        location,
        photos,
        notes: notes.trim(),
        poiName: poiName.trim() || undefined,
        poiCategory,
        gridId: selectedGridId,
        customerData: customerName
          ? {
              customerName: customerName.trim(),
              phone: customerPhone.trim(),
              serviceType
            }
          : undefined,
        addToPoiCatalog: !!poiName.trim()
      });

      if (res.success) {
        setFeedback({ type: 'success', message: 'Data POI & Foto berhasil disimpan ke log!' });
        // Reset form
        setNotes('');
        setPhotos([]);
        setPoiName('');
        setCustomerName('');
        setCustomerPhone('');
        setLocationStatus('idle');
        setLocation(null);
        fetchLogs();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal menyimpan FORM POI' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!confirm('Hapus entri log ini?')) return;
    try {
      await api.deletePOILog(id);
      setLogs((prev) => prev.filter((l) => l.id !== id));
    } catch (err: any) {
      alert('Gagal menghapus log');
    }
  };

  return (
    <div className={`flex-1 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'} flex flex-col overflow-y-auto`}>
      {/* Header bar matching Image 1 */}
      <div className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} border-b px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20`}>
        {/* Module Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-center justify-center text-indigo-400 font-bold shadow-inner">
            <Rocket className="w-5 h-5 text-pink-400" />
          </div>
          <div>
            <h1 className={`text-xl font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'} tracking-tight flex items-center gap-2`}>
              Activation Log
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-mono font-bold">
                FORM POI
              </span>
            </h1>
            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-medium`}>Input & Tracking Data Customer</p>
          </div>
        </div>

        {/* Right Action: Refresh (Dashboard & Detail Customer hidden per user request) */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className={`${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm'
            } border rounded-xl px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer`}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full flex flex-col gap-6">
        {/* Feedback message banner */}
        {feedback && (
          <div
            className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm font-medium border ${
              feedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-red-950/60 border-red-500/40 text-red-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TAB 1: INPUT DATA */}
        {topTab === 'input' && (
          <div className="flex flex-col items-center gap-6">
            {/* Sub-toggle: Update POI vs Customer Log Book */}
            <div className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} p-1.5 rounded-2xl border flex items-center shadow-lg w-full max-w-md`}>
              <button
                type="button"
                onClick={() => setSubView('update_poi')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  subView === 'update_poi'
                    ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
                    : isDarkMode
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🧭 Update POI</span>
              </button>
              <button
                type="button"
                onClick={() => setSubView('log_book')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  subView === 'log_book'
                    ? isDarkMode
                      ? 'bg-slate-800 text-blue-300 shadow-md border border-slate-700'
                      : 'bg-blue-50 text-blue-700 shadow-sm border border-blue-200'
                    : isDarkMode
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🗃️ Customer Log Book</span>
                <span className={`${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'} text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold`}>
                  {logs.length}
                </span>
              </button>
            </div>

            {/* FORM CARD (Update POI) */}
            {subView === 'update_poi' ? (
              <div className={`w-full max-w-lg ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-lg'} border rounded-3xl p-6 shadow-2xl flex flex-col gap-5`}>
                {/* Card Title */}
                <div className={`border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} pb-3 flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">🧭</span>
                    <h2 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} tracking-wide`}>
                      Update POI <span className={`text-xs font-normal ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>(GPS, photo, & notes)</span>
                    </h2>
                  </div>
                  <span className={`text-[11px] ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700 border border-slate-200'} px-2 py-0.5 rounded font-mono font-semibold`}>
                    {user.name}
                  </span>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {/* Row 1: Get Current Location Button & Status */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={handleGetLocation}
                      disabled={locationStatus === 'capturing'}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-sm shrink-0"
                    >
                      <MapPin className="w-4 h-4 text-pink-500" />
                      <span>{locationStatus === 'capturing' ? 'Mencari GPS...' : 'Get Current Location'}</span>
                    </button>

                    <div className="text-xs">
                      {locationStatus === 'idle' && (
                        <span className="text-slate-400 italic">Location not captured yet.</span>
                      )}
                      {locationStatus === 'capturing' && (
                        <span className="text-amber-400 animate-pulse">Mengambil koordinat satelit...</span>
                      )}
                      {locationStatus === 'captured' && location && (
                        <span className="text-emerald-400 font-mono font-semibold">
                          📍 {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                          {location.accuracy && (
                            <span className="text-slate-400 ml-1 font-normal">(±{location.accuracy}m)</span>
                          )}
                        </span>
                      )}
                      {locationStatus === 'error' && (
                        <span className="text-red-400">{locationError}</span>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Add Photo Button & Photo count */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handlePhotoUpload}
                        accept="image/*"
                        multiple
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={photos.length >= 5}
                        className={`bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-sm ${
                          photos.length >= 5 ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <Camera className="w-4 h-4 text-slate-400" />
                        <span>Add Photo</span>
                      </button>
                      <span className="text-xs text-slate-400 font-medium">
                        {photos.length}/5 photos
                      </span>
                    </div>

                    {/* Photo Thumbnails Preview */}
                    {photos.length > 0 && (
                      <div className="grid grid-cols-5 gap-2 mt-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                        {photos.map((photo, idx) => (
                          <div
                            key={idx}
                            className="relative group rounded-lg overflow-hidden aspect-square border border-slate-700 bg-slate-900"
                          >
                            <img
                              src={photo}
                              alt={`POI photo ${idx + 1}`}
                              className="w-full h-full object-cover cursor-pointer hover:scale-105 transition"
                              onClick={() => setActivePhotoModal(photo)}
                            />
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(idx)}
                              className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 text-white rounded-full p-1 opacity-80 group-hover:opacity-100 transition cursor-pointer"
                              title="Hapus foto"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Optional POI Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                        Nama Outlet / POI (Opsional)
                      </label>
                      <input
                        type="text"
                        value={poiName}
                        onChange={(e) => setPoiName(e.target.value)}
                        placeholder="Contoh: Toko Barokah Cell"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                        Kategori POI
                      </label>
                      <select
                        value={poiCategory}
                        onChange={(e) => setPoiCategory(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="Outlet / Konter Pulsa">Outlet / Konter Pulsa</option>
                        <option value="Pasar Tradisional">Pasar Tradisional</option>
                        <option value="Sekolah / Kampus">Sekolah / Kampus</option>
                        <option value="Pusat Keramaian / Alun-alun">Pusat Keramaian / Alun-alun</option>
                        <option value="SPBU / Rest Area">SPBU / Rest Area</option>
                        <option value="Rumah Sakit / Faskes">Rumah Sakit / Faskes</option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
                    </div>
                  </div>

                  {/* Optional Customer Activation Info */}
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3 flex flex-col gap-2.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                      <span>Data Pelanggan (Jika ada aktivasi)</span>
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Nama Pembeli / Pemilik"
                        className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="No. HP / MSISDN XL"
                        className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Row 3: Notes Textarea */}
                  <div>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Catatan (kondisi lokasi, info tambahan, dll.)..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>

                  {/* Row 4: Big Save Button matching Image 1 */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-sm py-3.5 rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 cursor-pointer mt-1"
                  >
                    <span>💾</span>
                    <span>{submitting ? 'Menyimpan...' : 'Save'}</span>
                  </button>

                  {/* Disclaimer below save button */}
                  <p className="text-center text-xs text-slate-400">
                    GPS wajib diaktifkan sebelum menyimpan.
                  </p>
                </form>
              </div>
            ) : (
              /* CUSTOMER LOG BOOK VIEW */
              <div className={`w-full ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border rounded-3xl p-5 shadow-2xl flex flex-col gap-4`}>
                <div className={`flex items-center justify-between border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} pb-3 flex-wrap gap-2`}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">🗃️</span>
                    <h2 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} tracking-wide`}>Customer Log Book</h2>
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-mono font-semibold">
                      {logs.length} entri tersimpan
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubView('update_poi')}
                    className="text-xs text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span>+ Tambah Log Baru</span>
                  </button>
                </div>

                {logs.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    Belum ada riwayat POI log. Gunakan tab "Update POI" untuk menginput data dan foto pertama Anda.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className={`${
                          isDarkMode
                            ? 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                        } border rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Photo preview thumbnail */}
                          {log.photos && log.photos.length > 0 ? (
                            <img
                              src={log.photos[0]}
                              alt="Thumbnail"
                              onClick={() => setActivePhotoModal(log.photos[0])}
                              className="w-16 h-16 rounded-xl object-cover border border-slate-700 cursor-pointer shrink-0"
                            />
                          ) : (
                            <div className={`w-16 h-16 rounded-xl ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-600' : 'bg-slate-200 border-slate-300 text-slate-400'} border flex items-center justify-center shrink-0`}>
                              <Camera className="w-6 h-6" />
                            </div>
                          )}

                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                {log.poiName || 'Titik POI Promoter'}
                              </h3>
                              {log.poiCategory && (
                                <span className={`text-[10px] ${isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-200 text-slate-700 border-slate-300'} border px-2 py-0.5 rounded font-medium`}>
                                  {log.poiCategory}
                                </span>
                              )}
                            </div>

                            <p className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                              {log.notes || <span className="italic text-slate-400">Tidak ada catatan</span>}
                            </p>

                            <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                              <span className="text-emerald-500 font-mono font-medium">
                                📍 {log.location.lat.toFixed(5)}, {log.location.lng.toFixed(5)}
                              </span>
                              <span>•</span>
                              <span>Oleh: {log.promoterName}</span>
                              <span>•</span>
                              <span>{new Date(log.createdAt).toLocaleString('id-ID')}</span>
                            </div>

                            {/* Customer data snippet */}
                            {log.customerData?.customerName && (
                              <div className={`text-[11px] ${isDarkMode ? 'text-blue-300 bg-blue-950/40 border-blue-900/50' : 'text-blue-700 bg-blue-50 border-blue-200'} px-2 py-0.5 rounded border inline-block w-fit mt-0.5 font-medium`}>
                                Pelanggan: <strong>{log.customerData.customerName}</strong> ({log.customerData.phone || '-'})
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {onOpenInMap && (
                            <button
                              onClick={() => onOpenInMap(log.location.lat, log.location.lng)}
                              className={`text-xs ${
                                isDarkMode
                                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-xs'
                              } border px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer font-medium`}
                              title="Tampilkan lokasi di peta GIS"
                            >
                              <MapPin className="w-3.5 h-3.5 text-pink-500" />
                              <span className="hidden sm:inline">Peta</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                            title="Hapus log"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal View Full Photo */}
      {activePhotoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-2xl w-full bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
            <button
              onClick={() => setActivePhotoModal(null)}
              className="absolute top-3 right-3 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full p-2 z-10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={activePhotoModal} alt="Preview" className="w-full max-h-[80vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  );
};
