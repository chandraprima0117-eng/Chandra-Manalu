import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  FolderPlus,
  FolderCheck,
  FolderOpen,
  CloudUpload,
  X,
  Info,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Trash2,
  Radio,
  Layers,
  FileText,
  RefreshCw,
  Plus,
  Rocket
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';
import type { GridItem, GridCategory, BTSItem, POIItem, DatasetFolder, FolderFileItem } from '../types';
import { DeployGuideContent } from './DeployGuideContent';

interface CMSModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CMSModal: React.FC<CMSModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'folders' | 'upload' | 'files' | 'deploy'>('folders');
  const [folders, setFolders] = useState<DatasetFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Folder Form State
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDesc, setNewFolderDesc] = useState('');
  const [newFolderRegion, setNewFolderRegion] = useState('EAST JAVA');
  const [newFolderCity, setNewFolderCity] = useState('KAB. BANGKALAN');

  // Upload Form State
  const [uploadMode, setUploadMode] = useState<'files' | 'folder'>('files');
  const [dataType, setDataType] = useState<'auto' | 'bts' | 'grid' | 'poi'>('auto');
  const [updateMode, setUpdateMode] = useState<'merge' | 'replace'>('merge');
  const [autoActivate, setAutoActivate] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<{ file: File; type: 'bts' | 'grid' | 'poi'; records: any[] }[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Load Folders
  const loadFolders = async () => {
    try {
      const list = await api.getFolders();
      const cleanList = list.filter(
        (f) => f.id !== 'folder-all' && !f.name.toLowerCase().includes('master gabungan')
      );
      setFolders(cleanList);
      const active = cleanList.find((f) => f.isActive) || cleanList[0];
      if (active && !selectedFolderId) {
        setSelectedFolderId(active.id);
      }
    } catch (err: any) {
      console.error('Failed to load folders:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      loadFolders();
      setFeedback(null);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredFolders = folders.filter(
    (f) => f.id !== 'folder-all' && !f.name.toLowerCase().includes('master gabungan')
  );
  const activeFolder = filteredFolders.find((f) => f.id === selectedFolderId) || filteredFolders[0];

  // Handle Creating New Folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setLoading(true);
    setFeedback(null);
    try {
      const created = await api.createFolder({
        name: newFolderName.trim(),
        description: newFolderDesc.trim(),
        region: newFolderRegion,
        city: newFolderCity
      });
      await loadFolders();
      setSelectedFolderId(created.id);
      setIsCreatingFolder(false);
      setNewFolderName('');
      setNewFolderDesc('');
      setFeedback({ type: 'success', message: `Folder dataset '${created.name}' berhasil dibuat!` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal membuat folder' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Activating Folder
  const handleActivateFolder = async (folderId: string) => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await api.activateFolder(folderId);
      await loadFolders();
      onSuccess();
      setFeedback({ type: 'success', message: res.message || 'Folder dataset berhasil diaktifkan!' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal mengaktifkan folder' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Deleting Folder
  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    if (!window.confirm(`Yakin ingin menghapus folder dataset '${folderName}'?`)) return;
    setLoading(true);
    setFeedback(null);
    try {
      await api.deleteFolder(folderId);
      await loadFolders();
      onSuccess();
      setFeedback({ type: 'success', message: `Folder '${folderName}' berhasil dihapus` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal menghapus folder' });
    } finally {
      setLoading(false);
    }
  };

  // Helper to parse file into records
  const parseFile = async (file: File): Promise<{ file: File; type: 'bts' | 'grid' | 'poi'; records: any[] } | null> => {
    const buffer = await file.arrayBuffer();
    const fileName = file.name.toLowerCase();

    // Determine type
    let detectedType: 'bts' | 'grid' | 'poi' = 'grid';
    if (dataType !== 'auto') {
      detectedType = dataType;
    } else {
      if (fileName.includes('bts') || fileName.includes('tower') || fileName.includes('site')) {
        detectedType = 'bts';
      } else if (fileName.includes('poi') || fileName.includes('point') || fileName.includes('outlet')) {
        detectedType = 'poi';
      } else {
        detectedType = 'grid';
      }
    }

    if (fileName.endsWith('.json') || fileName.endsWith('.geojson')) {
      const text = new TextDecoder().decode(buffer);
      const json = JSON.parse(text);
      if (Array.isArray(json)) {
        return { file, type: detectedType, records: json };
      } else if (json.features && Array.isArray(json.features)) {
        // GeoJSON feature collection
        const gridItems: GridItem[] = json.features.map((f: any, idx: number) => {
          const props = f.properties || {};
          const coords = f.geometry?.coordinates?.[0] || [];
          let south = -7.2, west = 112.7, north = -7.18, east = 112.72;
          if (coords.length >= 3) {
            const lngs = coords.map((c: any) => typeof c[0] === 'number' ? c[0] : parseFloat(c[0])).filter((n: number) => !isNaN(n));
            const lats = coords.map((c: any) => typeof c[1] === 'number' ? c[1] : parseFloat(c[1])).filter((n: number) => !isNaN(n));
            if (lngs.length > 0 && lats.length > 0) {
              west = Math.min(...lngs);
              east = Math.max(...lngs);
              south = Math.min(...lats);
              north = Math.max(...lats);
            }
          }

          const rawId = props.GRID_ID ?? props.grid_id ?? props.id ?? props['Grid ID'] ?? props['GRID ID'] ?? props.gridId ?? (1000 + idx);
          const id = String(rawId);

          const region = String(
            props.REGION ?? props.Region ?? props.region ?? props['Wilayah'] ?? props.wilayah ?? activeFolder?.region ?? 'NORTHERN SUMATRA'
          ).trim();
          const province = String(
            props.PROVINCE ?? props.Province ?? props.province ?? props['Provinsi'] ?? props.provinsi ?? activeFolder?.province ?? 'ACEH'
          ).trim();
          const city = String(
            props.CITY ?? props['City MSA'] ?? props['CITY MSA'] ?? props.City ?? props.city ?? props['Kota'] ?? props['Kota/Kab'] ?? activeFolder?.city ?? 'KOTA SABANG'
          ).trim();
          const kecamatan = String(
            props.KECAMATAN ?? props.Kecamatan ?? props.kecamatan ?? props.kec ?? 'SUKAKARYA'
          ).trim();

          const rawLat = props['Center Lat'] ?? props.center_lat ?? props.latitude ?? props.lat;
          const rawLng = props['Center Long'] ?? props.center_long ?? props.longitude ?? props.lng ?? props.ongitude;
          const centerLat = rawLat !== undefined && !isNaN(parseFloat(rawLat)) ? parseFloat(rawLat) : (south + north) / 2;
          const centerLng = rawLng !== undefined && !isNaN(parseFloat(rawLng)) ? parseFloat(rawLng) : (west + east) / 2;

          const rawPop = props.POPULATION ?? props.Population ?? props.population ?? props.pop ?? props['Populasi'];
          const pop = typeof rawPop === 'number'
            ? rawPop
            : (parseInt(String(rawPop || '').replace(/[^0-9]/g, '')) || 5000);

          const bts = typeof props.TOTAL_BTS === 'number'
            ? props.TOTAL_BTS
            : (typeof props.bts === 'number' ? props.bts : (parseInt(props.TOTAL_BTS ?? props.bts) || 0));

          const poi = typeof props.TOTAL_POI === 'number'
            ? props.TOTAL_POI
            : (typeof props.poi === 'number' ? props.poi : (parseInt(props.TOTAL_POI ?? props.poi) || 0));

          const rawCat = String(
            props['SF Attack Category'] ?? props.SF_Attack_Category ?? props.SF_Grid_Category ?? props['SF_Grid_Category'] ?? props.sf_grid_category ?? props.cat ?? props.category ?? ''
          ).trim();
          let category: GridCategory = '1st Priority Acquisition';
          const upperCat = rawCat.toUpperCase();
          if (upperCat === 'FULL ATTACK' || upperCat.includes('1ST PRIORITY') || upperCat === 'PRIORITY 1') {
            category = '1st Priority Acquisition';
          } else if (upperCat === 'OPPORTUNITY ATTACK' || upperCat.includes('2ND PRIORITY') || upperCat === 'PRIORITY 2') {
            category = '2nd Priority Acquisition';
          } else if (upperCat.includes('3RD PRIORITY') || upperCat === 'PRIORITY 3') {
            category = '3rd Priority';
          } else if (upperCat.includes('AVOID') || upperCat === 'AVOID CANNIBALISM') {
            category = 'Avoid Cannibalism';
          } else if (rawCat) {
            category = rawCat as GridCategory;
          }

          let revNum = 0;
          const rawRev = props.Rev_August_2026 ?? props.rev_august_2026 ?? props.revenue ?? props.rev;
          if (typeof rawRev === 'number') {
            revNum = rawRev;
          } else if (rawRev) {
            revNum = parseFloat(String(rawRev).replace(/[^0-9.-]+/g, '')) || 0;
          } else {
            revNum = category === '1st Priority Acquisition' ? 46500000 : (category === '2nd Priority Acquisition' ? 33500000 : 18000000);
          }

          let revFlag = String(props.Revenue_Flag ?? props['Revenue Flag'] ?? props.revenue_flag ?? '');
          if (!revFlag || revFlag === 'Unknown') {
            if (revNum >= 40000000) revFlag = 'Rev >40 Mn';
            else if (revNum >= 30000000) revFlag = 'Rev 30-40 Mn';
            else if (revNum >= 20000000) revFlag = 'Rev 20-30 Mn';
            else if (revNum > 0) revFlag = 'Rev <20 Mn';
            else revFlag = 'Rev 0';
          }

          let wkt = String(props.Geometry_WKT ?? props['Geometry_WKT'] ?? props['Geometry WKT'] ?? props.wkt ?? '');
          if (!wkt || !wkt.toLowerCase().includes('polygon')) {
            if (coords.length >= 3) {
              const coordStr = coords.map((c: any) => `${c[0]} ${c[1]}`).join(', ');
              wkt = `POLYGON ((${coordStr}))`;
            } else {
              wkt = `POLYGON ((${west} ${south}, ${east} ${south}, ${east} ${north}, ${west} ${north}, ${west} ${south}))`;
            }
          }

          const sitename = String(props.sitename ?? props['Nama Site'] ?? props.name ?? `${kecamatan} Grid ${id.slice(-4)}`);
          const site_type = String(props.site_type ?? props['Tipe Site'] ?? (category === '1st Priority Acquisition' ? 'Macro' : 'Micro'));
          const metaId = String(props.GRID_META_ID ?? props['Grid Meta ID'] ?? `GM-${id}`);
          const deviceStatus = String(props.Device_Status ?? props['Device_Status'] ?? props.status ?? 'Active');
          const prom = String(props['Mapping Promotor'] ?? props.prom ?? 'MULTIBRAND');

          const speedXL = props.Download_Speed_XLCo;
          const speedSF = props.Download_Speed_SF;
          const xlco = String(speedXL ? `${speedXL} Mbps` : (props.xlco || props.xl || '35%'));
          const sf = String(speedSF ? `${speedSF} Mbps` : (props.sf || '15%'));

          return {
            id,
            sitename,
            site_type,
            Province: province,
            City: city,
            Kecamatan: kecamatan,
            Region: region,
            latitude: Number(centerLat.toFixed(6)),
            longitude: Number(centerLng.toFixed(6)),
            GRID_META_ID: metaId,
            Rev_August_2026: revNum,
            Revenue_Flag: revFlag as any,
            SF_Grid_Category: category,
            Geometry_WKT: wkt,
            Device_Status: deviceStatus,

            // Aliases for compatibility
            region,
            province,
            city,
            kecamatan,
            pop,
            tsel: String(props.tsel || '40%'),
            xlco,
            xl: xlco,
            ioh: String(props.ioh || '18%'),
            sf,
            bts,
            poi,
            cat: category,
            prom: prom as any,
            bounds: [[south, west], [north, east]],
            center: [Number(centerLat.toFixed(6)), Number(centerLng.toFixed(6))]
          };
        });
        return { file, type: 'grid', records: gridItems };
      }
      return null;
    } else {
      // Excel / CSV
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const rawJson: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      if (detectedType === 'bts') {
        const btsItems: BTSItem[] = rawJson.map((row, idx) => {
          const lat = parseFloat(row['latitude'] || row['Latitude'] || row.lat) || -7.054;
          const lng = parseFloat(row['ongitude'] || row['longitude'] || row['Longitude'] || row['ongitude'] || row.lng) || 112.742;
          const id = String(row['id'] || row['ID BTS'] || row.id || `EJ-BKL-${String(idx + 1).padStart(4, '0')}`);
          const sitename = String(row['sitename'] || row['Nama BTS'] || row.name || `Tower ${idx + 1}`);
          const agingRaw = row['Aging (Month)'] ?? row['aging_month'] ?? row['Aging'] ?? 24;
          const aging = typeof agingRaw === 'number' ? agingRaw : (parseInt(String(agingRaw)) || 24);
          const siteType = String(row['site_type'] || row['Tipe'] || row.type || 'Macro');
          const siteFunc = String(row['Site Function'] || row['Fungsi'] || row.func || 'Residential');
          const province = String(row['Province'] || row['Provinsi'] || row.province || 'JAWA TIMUR (4672)');
          const city = String(row['City'] || row['Kota'] || row.city || activeFolder?.city || 'KAB. BANGKALAN');
          const kecamatan = String(row['Kecamatan'] || row.kec || 'Bangkalan');
          const region = String(row['Region'] || row.region || activeFolder?.region || 'EAST JAVA');
          const metaId = String(row['GRID_META_ID'] || row['Grid ID'] || row.grid || `GM-${id}`);

          const rawRev = row['Rev.2026'] ?? row['Rev_2026'] ?? row['Rev 2026'] ?? row['Revenue'] ?? row.rev;
          let revNum = 0;
          if (typeof rawRev === 'number') {
            revNum = rawRev;
          } else if (typeof rawRev === 'string') {
            const parsed = parseFloat(rawRev.replace(/[^0-9.-]+/g, ''));
            revNum = isNaN(parsed) ? 42000000 : (parsed < 1000 ? parsed * 1000000 : parsed);
          } else {
            revNum = 42000000;
          }

          let revFlag = String(row['Revenue Flag'] || row['Revenue_Flag'] || row.rev || '');
          if (!revFlag) {
            if (revNum >= 40000000) revFlag = 'Rev >40 Mn';
            else if (revNum >= 30000000) revFlag = 'Rev 30-40 Mn';
            else if (revNum >= 20000000) revFlag = 'Rev 20-30 Mn';
            else if (revNum > 0) revFlag = 'Rev <20 Mn';
            else revFlag = 'Rev 0';
          }

          const bsp = String(row['BSP Data'] || row['bsp_data'] || row['BSP'] || 'Smartfren Fiber Core');
          const defaultWkt = `POINT (${lng.toFixed(6)} ${lat.toFixed(6)})`;
          const wkt = String(row['Geometry WKT'] || row['Geometry_WKT'] || row['WKT'] || defaultWkt);

          return {
            id,
            sitename,
            'Aging (Month)': aging,
            site_type: siteType,
            'Site Function': siteFunc,
            Province: province,
            City: city,
            Kecamatan: kecamatan,
            latitude: lat,
            ongitude: lng,
            Region: region,
            GRID_META_ID: metaId,
            'Rev.2026': revNum,
            'Revenue Flag': revFlag as any,
            'BSP Data': bsp,
            'Geometry WKT': wkt,

            name: sitename,
            type: siteType as any,
            func: siteFunc as any,
            province,
            city,
            kec: kecamatan,
            region,
            grid: metaId,
            rev: revFlag as any,
            lat,
            lng,
            longitude: lng,
            bsp_data: bsp,
            Geometry_WKT: wkt,
            heightMeters: parseInt(row['Tinggi'] || row.heightMeters) || 45,
            tenants: row['Tenants'] ? String(row['Tenants']).split(',') : ['Smartfren', 'XL']
          };
        });
        return { file, type: 'bts', records: btsItems };
      } else if (detectedType === 'poi') {
        const poiItems: POIItem[] = rawJson.map((row, idx) => {
          const poiId = String(row.POI_ID || row['POI_ID'] || row['ID POI'] || row.id || `POI-BKL-${String(idx + 1).padStart(4, '0')}`);
          const region = String(row.REGION || row['REGION'] || row.Region || row.region || activeFolder?.region || 'EAST JAVA');
          const province = String(row.PROVINCE || row['PROVINCE'] || row.Province || row.province || 'JAWA TIMUR (4672)');
          const city = String(row['XLS CITY'] || row['XLS_CITY'] || row['Kota'] || row.city || activeFolder?.city || 'KAB. BANGKALAN');
          const kecamatan = String(row.KECAMATAN || row['KECAMATAN'] || row.Kecamatan || row.kec || 'Bangkalan');
          const metaGridId = String(row['Meta Grid ID'] || row['META_GRID_ID'] || row['Grid ID'] || row.grid || '3526001000');
          const poiNameRaw = String(row.POI_NAME_RAW || row['POI_NAME_RAW'] || row['Nama POI Raw'] || row.name || `POI #${idx + 1}`);
          const poiName = String(row.POI_NAME || row['POI_NAME'] || row['Nama POI'] || row.name || poiNameRaw);
          const combinedTaxon = row['TAXON_NAME_RAW TAXON_NAME'] || row['TAXON_NAME_RAW_TAXON_NAME'] || '';
          const taxonRaw = String(row.TAXON_NAME_RAW || row['TAXON_NAME_RAW'] || (combinedTaxon ? combinedTaxon.split(' ')[0] : '') || row['Tipe'] || row.type || 'Traditional Market');
          const taxon = String(row.TAXON_NAME || row['TAXON_NAME'] || combinedTaxon || taxonRaw || row['Tipe'] || row.type || 'Traditional Market');
          const lat = parseFloat(row.LATITUDE || row['LATITUDE'] || row['Latitude'] || row.lat) || -7.052;
          const lng = parseFloat(row.LONGITUDE || row['LONGITUDE'] || row['Longitude'] || row.lng) || 112.742;

          return {
            'Meta Grid ID': metaGridId,
            REGION: region,
            PROVINCE: province,
            'XLS CITY': city,
            KECAMATAN: kecamatan,
            POI_ID: poiId,
            POI_NAME_RAW: poiNameRaw,
            POI_NAME: poiName,
            TAXON_NAME_RAW: taxonRaw,
            TAXON_NAME: taxon,
            LATITUDE: lat,
            LONGITUDE: lng,

            'TAXON_NAME_RAW TAXON_NAME': `${taxonRaw} ${taxon}`.trim(),

            id: poiId,
            name: poiName,
            type: taxon,
            city,
            kec: kecamatan,
            kecamatan,
            region,
            province,
            grid: metaGridId,
            gridId: metaGridId,
            lat,
            lng,
            latitude: lat,
            longitude: lng,
            poi_id: poiId,
            poi_name: poiName,
            poi_name_raw: poiNameRaw,
            taxon_name: taxon,
            taxon_name_raw: taxonRaw
          };
        });
        return { file, type: 'poi', records: poiItems };
      } else {
        const gridItems: GridItem[] = rawJson.map((row, idx) => {
          const rawLat = row['Center Lat'] ?? row['latitude'] ?? row['Latitude'] ?? row['LATITUDE'] ?? row.lat;
          const rawLng = row['Center Long'] ?? row['longitude'] ?? row['Longitude'] ?? row['LONGITUDE'] ?? row.lng ?? row.ongitude;
          const lat = parseFloat(rawLat) || -7.05;
          const lng = parseFloat(rawLng) || 112.9;
          const step = 0.022;

          const rawId = row['GRID_ID'] ?? row['GRID ID'] ?? row['Grid ID'] ?? row['id'] ?? row.id ?? `352600${1000 + idx}`;
          const id = String(rawId);
          const sitename = String(row['sitename'] || row['Sitename'] || row['Nama Grid'] || row['Nama Site'] || `${row['Kecamatan'] || row['KECAMATAN'] || row['kecamatan'] || 'Grid'} #${id.slice(-4)}`);
          const site_type = String(row['site_type'] || row['Site Type'] || row['Tipe Site'] || 'Macro');
          const province = String(row['PROVINCE'] || row['Province'] || row['Provinsi'] || row.province || 'JAWA TIMUR (4672)');
          const city = String(row['CITY'] || row['City'] || row['City MSA'] || row['Kota'] || row['Kota/Kab'] || row.city || activeFolder?.city || 'KAB. BANGKALAN');
          const kecamatan = String(row['KECAMATAN'] || row['Kecamatan'] || row.kecamatan || row.kec || 'Bangkalan');
          const region = String(row['REGION'] || row['Region'] || row.region || row['Wilayah'] || activeFolder?.region || 'EAST JAVA');
          const metaId = String(row['GRID_META_ID'] || row['Grid Meta ID'] || row.GRID_META_ID || `GM-${id}`);

          const rawRev = row['Rev_August_2026'] !== undefined ? row['Rev_August_2026'] : (row['Revenue'] || row['Rev'] || 35000000);
          const revNum = typeof rawRev === 'number' ? rawRev : (parseFloat(String(rawRev).replace(/[^0-9.-]+/g, '')) || 0);

          let revFlag = String(row['Revenue_Flag'] || row['Revenue Flag'] || '');
          if (!revFlag) {
            if (revNum >= 40000000) revFlag = 'Rev >40 Mn';
            else if (revNum >= 30000000) revFlag = 'Rev 30-40 Mn';
            else if (revNum >= 20000000) revFlag = 'Rev 20-30 Mn';
            else if (revNum > 0) revFlag = 'Rev <20 Mn';
            else revFlag = 'Rev 0';
          }

          const rawCat = String(row['SF Attack Category'] || row['SF_Grid_Category'] || row['Category'] || row['Kategori'] || row.cat || '').trim();
          let category: GridCategory = '1st Priority Acquisition';
          const upperCat = rawCat.toUpperCase();
          if (upperCat === 'FULL ATTACK' || upperCat.includes('1ST PRIORITY') || upperCat === 'PRIORITY 1') {
            category = '1st Priority Acquisition';
          } else if (upperCat === 'OPPORTUNITY ATTACK' || upperCat.includes('2ND PRIORITY') || upperCat === 'PRIORITY 2') {
            category = '2nd Priority Acquisition';
          } else if (upperCat.includes('3RD PRIORITY') || upperCat === 'PRIORITY 3') {
            category = '3rd Priority';
          } else if (upperCat.includes('AVOID') || upperCat === 'AVOID CANNIBALISM') {
            category = 'Avoid Cannibalism';
          } else if (rawCat) {
            category = rawCat as GridCategory;
          }

          const defaultWkt = `POLYGON ((${Number((lng - step / 2).toFixed(6))} ${Number((lat - step / 2).toFixed(6))}, ${Number((lng + step / 2).toFixed(6))} ${Number((lat - step / 2).toFixed(6))}, ${Number((lng + step / 2).toFixed(6))} ${Number((lat + step / 2).toFixed(6))}, ${Number((lng - step / 2).toFixed(6))} ${Number((lat + step / 2).toFixed(6))}, ${Number((lng - step / 2).toFixed(6))} ${Number((lat - step / 2).toFixed(6))}))`;
          const wkt = String(row['Geometry_WKT'] || row['Geometry WKT'] || row['WKT'] || defaultWkt);
          const deviceStatus = String(row['Device_Status'] || row['Status'] || 'Active');

          const rawPop = row['POPULATION'] ?? row['Populasi'] ?? row.pop;
          const pop = typeof rawPop === 'number' ? rawPop : (parseInt(String(rawPop || '').replace(/[^0-9]/g, '')) || 5000);

          return {
            id,
            sitename,
            site_type,
            Province: province,
            City: city,
            Kecamatan: kecamatan,
            Region: region,
            latitude: lat,
            longitude: lng,
            GRID_META_ID: metaId,
            Rev_August_2026: revNum,
            Revenue_Flag: revFlag as any,
            SF_Grid_Category: category,
            Geometry_WKT: wkt,
            Device_Status: deviceStatus,

            // Legacy compatibility
            region,
            province,
            city,
            kecamatan,
            pop,
            tsel: String(row['MS TSEL'] || row.tsel || '45%'),
            xlco: String(row['Download_Speed_XLCo'] ? `${row['Download_Speed_XLCo']} Mbps` : (row['MS XLCO'] || row['MS XL'] || row.xlco || row.xl || '30%')),
            xl: String(row['Download_Speed_XLCo'] ? `${row['Download_Speed_XLCo']} Mbps` : (row['MS XLCO'] || row['MS XL'] || row.xlco || row.xl || '30%')),
            ioh: String(row['MS IOH'] || row.ioh || '18%'),
            sf: String(row['Download_Speed_SF'] ? `${row['Download_Speed_SF']} Mbps` : (row['MS SF'] || row.sf || '7%')),
            bts: parseInt(row['TOTAL_BTS'] || row['BTS'] || row.bts) || 0,
            poi: parseInt(row['TOTAL_POI'] || row['POI'] || row.poi) || 0,
            cat: category,
            prom: (row['Mapping Promotor'] || row['Promotor'] || row.prom || 'MULTIBRAND') as any,
            bounds: [[lat - step / 2, lng - step / 2], [lat + step / 2, lng + step / 2]],
            center: [lat, lng]
          };
        });
        return { file, type: 'grid', records: gridItems };
      }
    }
    return null;
  };

  // Handle File Input Selection
  const handleFilesSelected = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    setLoading(true);
    setFeedback(null);

    const validExtensions = ['.xlsx', '.xls', '.csv', '.json', '.geojson'];
    const parsedList: { file: File; type: 'bts' | 'grid' | 'poi'; records: any[] }[] = [];

    for (let i = 0; i < filesList.length; i++) {
      const f = filesList[i];
      const hasValidExt = validExtensions.some((ext) => f.name.toLowerCase().endsWith(ext));
      if (!hasValidExt) continue;

      try {
        const parsed = await parseFile(f);
        if (parsed && parsed.records.length > 0) {
          parsedList.push(parsed);
        }
      } catch (err: any) {
        console.error(`Failed parsing file ${f.name}:`, err);
      }
    }

    setLoading(false);
    if (parsedList.length === 0) {
      setFeedback({ type: 'error', message: 'Tidak ada file data valid yang dapat diproses' });
    } else {
      setSelectedFiles(parsedList);
    }
  };

  // Execute Upload into Folder
  const handleExecuteUpload = async () => {
    if (!selectedFolderId) {
      setFeedback({ type: 'error', message: 'Silakan pilih folder tujuan terlebih dahulu' });
      return;
    }
    if (selectedFiles.length === 0) {
      setFeedback({ type: 'error', message: 'Silakan pilih file untuk diunggah' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      let totalRecords = 0;
      for (const item of selectedFiles) {
        const res = await api.uploadToFolder(selectedFolderId, {
          type: item.type,
          records: item.records,
          fileName: item.file.name,
          mode: updateMode,
          activate: autoActivate
        });
        totalRecords += res.count;
      }

      await loadFolders();
      onSuccess();
      setFeedback({
        type: 'success',
        message: `Berhasil mengupdate total ${totalRecords} data ke folder '${activeFolder?.name}'!`
      });
      setSelectedFiles([]);

      setTimeout(() => {
        setActiveTab('folders');
      }, 1500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal mengunggah data ke folder' });
    } finally {
      setLoading(false);
    }
  };

  // Download Sample Excel Template
  const handleDownloadTemplate = (type: 'bts' | 'grid' | 'poi') => {
    let data: any[] = [];
    let filename = '';

    if (type === 'bts') {
      filename = 'Template_BTS_Tower.xlsx';
      data = [
        {
          id: 'EJ-BKL-0001',
          sitename: 'BKL-SOC-001',
          'Aging (Month)': 24,
          site_type: 'Macro',
          'Site Function': 'Residential',
          Province: 'JAWA TIMUR (4672)',
          City: 'KAB. BANGKALAN',
          Kecamatan: 'Socah',
          latitude: -7.054,
          ongitude: 112.742,
          Region: 'EAST JAVA',
          GRID_META_ID: 'GM-3526001001',
          'Rev.2026': 45000000,
          'Revenue Flag': 'Rev >40 Mn',
          'BSP Data': 'Smartfren Fiber Core',
          'Geometry WKT': 'POINT (112.742000 -7.054000)'
        },
        {
          id: 'EJ-BKL-0002',
          sitename: 'BKL-BLE-002',
          'Aging (Month)': 36,
          site_type: 'Micro',
          'Site Function': 'Commercial',
          Province: 'JAWA TIMUR (4672)',
          City: 'KAB. BANGKALAN',
          Kecamatan: 'Blega',
          latitude: -7.135,
          ongitude: 113.085,
          Region: 'EAST JAVA',
          GRID_META_ID: 'GM-3526001002',
          'Rev.2026': 32500000,
          'Revenue Flag': 'Rev 30-40 Mn',
          'BSP Data': 'Telkom BSP Tier-1',
          'Geometry WKT': 'POINT (113.085000 -7.135000)'
        }
      ];
    } else if (type === 'poi') {
      filename = 'Template_POI_Master_12Headers.xlsx';
      data = [
        {
          'Meta Grid ID': '3526001000',
          REGION: 'EAST JAVA',
          PROVINCE: 'JAWA TIMUR (4672)',
          'XLS CITY': 'KAB. BANGKALAN',
          KECAMATAN: 'Socah',
          POI_ID: 'POI-BKL-0001',
          POI_NAME_RAW: 'PASAR TRADISIONAL SOCAH SENTRAL',
          POI_NAME: 'Pasar Tradisional Socah',
          TAXON_NAME_RAW: 'Traditional Market & Groceries',
          TAXON_NAME: 'Traditional Market',
          LATITUDE: -7.052,
          LONGITUDE: 112.74
        },
        {
          'Meta Grid ID': '3526001005',
          REGION: 'EAST JAVA',
          PROVINCE: 'JAWA TIMUR (4672)',
          'XLS CITY': 'KAB. BANGKALAN',
          KECAMATAN: 'Bangkalan',
          POI_ID: 'POI-BKL-0002',
          POI_NAME_RAW: 'OUTLET BERKAH CELL PUSAT',
          POI_NAME: 'Berkah Cell Bangkalan',
          TAXON_NAME_RAW: 'Outlet Smartphone & Voucher Pulsa',
          TAXON_NAME: 'Modern Outlet',
          LATITUDE: -7.043,
          LONGITUDE: 112.918
        }
      ];
    } else {
      filename = 'Template_Grid_Master.xlsx';
      data = [
        {
          id: '3526001001',
          sitename: 'Bangkalan Sentral 1',
          site_type: 'Macro',
          Province: 'JAWA TIMUR (4672)',
          City: 'KAB. BANGKALAN',
          Kecamatan: 'Bangkalan',
          Region: 'EAST JAVA',
          latitude: -7.045,
          longitude: 112.75,
          GRID_META_ID: 'GM-3526001001',
          Rev_August_2026: 45000000,
          Revenue_Flag: 'Rev >40 Mn',
          SF_Grid_Category: '1st Priority Acquisition',
          Geometry_WKT: 'POLYGON ((112.738000 -7.056000, 112.762000 -7.056000, 112.762000 -7.034000, 112.738000 -7.034000, 112.738000 -7.056000))',
          Device_Status: 'Active'
        }
      ];
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, filename);
  };

  // Export Folder Data as JSON
  const handleExportFolderJSON = async (folderId: string) => {
    try {
      const data = await api.exportFolder(folderId);
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dataset-${data.metadata.name.replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Gagal mengekspor data: ' + err.message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[99999] isolate bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
      style={{ zIndex: 99999 }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">CMS Data & Folder Hub</h3>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded font-mono font-bold">
                  Folder Integration
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Kelola dataset Grid & BTS terstruktur per folder, unggah batch file/folder, dan update data real-time.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('folders')}
            className={`pb-2.5 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'folders'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Folder className="w-4 h-4" />
            <span>Daftar Folder Dataset ({folders.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`pb-2.5 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'upload'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CloudUpload className="w-4 h-4" />
            <span>Unggah & Update Data ke Folder</span>
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`pb-2.5 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'files'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>File & Template Excel</span>
          </button>
          <button
            onClick={() => setActiveTab('deploy')}
            className={`pb-2.5 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'deploy'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Rocket className="w-4 h-4" />
            <span>Panduan Live Web</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="px-6 pt-3">
            <div
              className={`p-3 rounded-xl flex items-center gap-2.5 text-xs font-medium ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300'
                  : 'bg-red-950/60 border border-red-500/50 text-red-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5 text-xs">
          {/* TAB 1: FOLDER LIST & MANAGEMENT */}
          {activeTab === 'folders' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">Struktur Folder Dataset</h4>
                  <p className="text-slate-400 text-[11px]">
                    Dataset yang aktif akan langsung disajikan pada peta GIS, visualisasi poligon SF, dan kartu KPI.
                  </p>
                </div>
                <button
                  onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                  className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold px-3 py-2 rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>+ Buat Folder Baru</span>
                </button>
              </div>

              {/* Create Folder Inline Form */}
              {isCreatingFolder && (
                <form
                  onSubmit={handleCreateFolder}
                  className="bg-slate-950 border border-blue-500/40 rounded-xl p-4 space-y-3 animate-in fade-in"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-white text-xs flex items-center gap-2">
                      <FolderPlus className="w-4 h-4 text-blue-400" />
                      Buat Folder Dataset Baru
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingFolder(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Nama Folder *</label>
                      <input
                        type="text"
                        required
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Contoh: Jawa Timur - Q1 2026 Batch"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Region Scope</label>
                      <select
                        value={newFolderRegion}
                        onChange={(e) => setNewFolderRegion(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-blue-500 focus:outline-none"
                      >
                        <option value="EAST JAVA">EAST JAVA</option>
                        <option value="BALI NUSRA">BALI NUSRA</option>
                        <option value="CENTRAL JAVA">CENTRAL JAVA</option>
                        <option value="WEST JAVA">WEST JAVA</option>
                        <option value="ALL">ALL REGIONS</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Kota / Kabupaten</label>
                      <input
                        type="text"
                        value={newFolderCity}
                        onChange={(e) => setNewFolderCity(e.target.value)}
                        placeholder="Contoh: KAB. BANGKALAN atau ALL"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Deskripsi Singkat</label>
                      <input
                        type="text"
                        value={newFolderDesc}
                        onChange={(e) => setNewFolderDesc(e.target.value)}
                        placeholder="Keterangan dataset..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingFolder(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !newFolderName.trim()}
                      className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold disabled:opacity-50"
                    >
                      {loading ? 'Membuat Folder...' : 'Simpan Folder Baru'}
                    </button>
                  </div>
                </form>
              )}

              {/* Folders List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredFolders.map((folder) => {
                  const isActive = folder.isActive;
                  return (
                    <div
                      key={folder.id}
                      className={`rounded-xl border p-4 transition-all flex flex-col justify-between gap-3 ${
                        isActive
                          ? 'bg-blue-950/30 border-blue-500/60 shadow-lg shadow-blue-900/10'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <Folder className={`w-5 h-5 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                            <h5 className="font-bold text-white text-sm tracking-tight">{folder.name}</h5>
                          </div>
                          {isActive ? (
                            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-[0_0_8px_#10b98133]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              DATASET AKTIF
                            </span>
                          ) : (
                            <span className="bg-slate-800 text-slate-400 text-[10px] font-semibold px-2 py-0.5 rounded">
                              Tersimpan
                            </span>
                          )}
                        </div>

                        {folder.description && (
                          <p className="text-slate-400 text-[11px] mb-3 line-clamp-2">{folder.description}</p>
                        )}

                        {/* Counts Badge Matrix */}
                        <div className="grid grid-cols-3 gap-2 bg-slate-900/80 border border-slate-800/80 rounded-lg p-2.5 text-center">
                          <div>
                            <div className="text-[10px] text-slate-400 font-medium">Grid SF</div>
                            <div className="text-sm font-extrabold text-blue-400 font-mono">
                              {folder.gridCount.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-400 font-medium">BTS Tower</div>
                            <div className="text-sm font-extrabold text-emerald-400 font-mono">
                              {folder.btsCount.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-400 font-medium">File Data</div>
                            <div className="text-sm font-extrabold text-amber-400 font-mono">
                              {folder.files?.length || 0}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Folder Actions */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                        <span className="text-[10px] text-slate-500">
                          Update: {new Date(folder.updatedAt).toLocaleDateString('id-ID')}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {!isActive && (
                            <button
                              onClick={() => handleActivateFolder(folder.id)}
                              className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer flex items-center gap-1"
                              title="Tampilkan dataset folder ini ke peta GIS"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Aktifkan</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedFolderId(folder.id);
                              setActiveTab('upload');
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
                            title="Unggah data ke folder ini"
                          >
                            <CloudUpload className="w-3.5 h-3.5 text-blue-400" />
                            <span>Unggah</span>
                          </button>
                          <button
                            onClick={() => handleExportFolderJSON(folder.id)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded transition cursor-pointer"
                            title="Ekspor data folder (.json)"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          {folders.length > 1 && (
                            <button
                              onClick={() => handleDeleteFolder(folder.id, folder.name)}
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-1.5 rounded transition cursor-pointer"
                              title="Hapus folder"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: UPLOAD & UPDATE DATA INTO FOLDER */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-4">
                {/* Target Folder Selector */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    1. Pilih Folder Tujuan Penyimpanan
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedFolderId}
                      onChange={(e) => setSelectedFolderId(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-bold text-xs focus:border-blue-500 focus:outline-none cursor-pointer"
                    >
                      {filteredFolders.map((f) => (
                        <option key={f.id} value={f.id}>
                          📁 {f.name} {f.isActive ? '(Sedang Aktif di Peta)' : ''} — [{f.gridCount} Grid, {f.btsCount} BTS]
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('folders');
                        setIsCreatingFolder(true);
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-lg font-semibold flex items-center gap-1.5 shrink-0 transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-blue-400" />
                      <span>Buat Folder Baru</span>
                    </button>
                  </div>
                </div>

                {/* Upload Mode Selector (Files vs Directory Folder) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      2. Mode Unggah
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setUploadMode('files');
                          setSelectedFiles([]);
                        }}
                        className={`flex-1 py-2 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                          uploadMode === 'files'
                            ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        <FileText className="w-4 h-4" />
                        <span>Satu / Multi File</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadMode('folder');
                          setSelectedFiles([]);
                        }}
                        className={`flex-1 py-2 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                          uploadMode === 'folder'
                            ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Folder className="w-4 h-4" />
                        <span>Seluruh Folder (Folder Upload)</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Tipe Dataset
                    </label>
                    <select
                      value={dataType}
                      onChange={(e) => setDataType(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-medium text-xs focus:border-blue-500 focus:outline-none cursor-pointer"
                    >
                      <option value="auto">⚡ Deteksi Otomatis (Nama File / Kolom)</option>
                      <option value="bts">BTS / Tower (.xlsx, .csv, .json)</option>
                      <option value="grid">Grid Master SF (.xlsx, .geojson, .json)</option>
                      <option value="poi">Point of Interest / Outlet (.xlsx, .csv)</option>
                    </select>
                  </div>
                </div>

                {/* Drop Zone */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    3. Pilih atau Tarik File / Folder ke Area Ini
                  </label>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      handleFilesSelected(e.dataTransfer.files);
                    }}
                    onClick={() => {
                      if (uploadMode === 'folder') {
                        folderInputRef.current?.click();
                      } else {
                        fileInputRef.current?.click();
                      }
                    }}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                      isDragging
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-700 hover:border-slate-600 bg-slate-900/50 hover:bg-slate-900'
                    }`}
                  >
                    <CloudUpload className="w-8 h-8 text-blue-400 mx-auto mb-2 animate-bounce" />
                    <p className="font-bold text-white text-xs mb-1">
                      {uploadMode === 'folder'
                        ? 'Klik untuk memilih Seluruh Folder dari komputer Anda'
                        : 'Klik atau Seret file Excel (.xlsx), CSV, JSON, atau GeoJSON ke sini'}
                    </p>
                    <p className="text-slate-400 text-[11px]">
                      Mendukung format: <span className="font-mono text-slate-300">.xlsx, .xls, .csv, .geojson, .json</span>
                    </p>

                    {/* Hidden Native File Inputs */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".xlsx,.xls,.csv,.json,.geojson"
                      onChange={(e) => handleFilesSelected(e.target.files)}
                      className="hidden"
                    />
                    <input
                      ref={folderInputRef}
                      type="file"
                      // @ts-expect-error webkitdirectory is standard in Chromium/modern browsers
                      webkitdirectory=""
                      directory=""
                      multiple
                      onChange={(e) => handleFilesSelected(e.target.files)}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Update Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-800">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Metode Sinkronisasi Data
                    </label>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                        <input
                          type="radio"
                          name="update-mode"
                          checked={updateMode === 'merge'}
                          onChange={() => setUpdateMode('merge')}
                          className="accent-blue-500"
                        />
                        <span>
                          <strong>Gabungkan & Update (Merge)</strong> — memperbarui record ID sama dan menambah baru
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                        <input
                          type="radio"
                          name="update-mode"
                          checked={updateMode === 'replace'}
                          onChange={() => setUpdateMode('replace')}
                          className="accent-blue-500"
                        />
                        <span>
                          <strong>Ganti Seluruh Data (Replace)</strong> — bersihkan data lama di kategori ini
                        </span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Aktivasi Otomatis
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-slate-200 bg-slate-900 border border-slate-800 p-2.5 rounded-lg">
                      <input
                        type="checkbox"
                        checked={autoActivate}
                        onChange={(e) => setAutoActivate(e.target.checked)}
                        className="accent-emerald-500 rounded"
                      />
                      <span>Langsung tampilkan & aktifkan dataset ini di Peta GIS & KPI setelah upload selesai</span>
                    </label>
                  </div>
                </div>

                {/* Staged Files Preview */}
                {selectedFiles.length > 0 && (
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span>Daftar File yang Siap Diunggah ({selectedFiles.length}):</span>
                      <button
                        type="button"
                        onClick={() => setSelectedFiles([])}
                        className="text-red-400 hover:text-red-300 text-[11px] cursor-pointer"
                      >
                        Hapus Semua
                      </button>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                      {selectedFiles.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                            <div>
                              <div className="font-semibold text-slate-200">{item.file.name}</div>
                              <div className="text-[10px] text-slate-400">
                                Ukuran: {(item.file.size / 1024).toFixed(1)} KB • Tipe:{' '}
                                <span className="uppercase font-bold text-blue-400">{item.type}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono font-bold text-[11px]">
                              {item.records.length} baris data
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Submit Action */}
                <div className="pt-2">
                  <button
                    onClick={handleExecuteUpload}
                    disabled={loading || selectedFiles.length === 0}
                    className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-blue-600/20 cursor-pointer text-center text-sm flex items-center justify-center gap-2"
                  >
                    <CloudUpload className="w-4 h-4" />
                    <span>
                      {loading
                        ? 'Menyimpan & Memproses ke Folder...'
                        : `Simpan & Update ke Folder '${activeFolder?.name || 'Dataset'}'`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FILE EXPLORER & TEMPLATES */}
          {activeTab === 'files' && (
            <div className="space-y-4">
              {/* Template Download Section */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                  Unduh Format / Template Data Excel Resmi
                </h4>
                <p className="text-[11px] text-slate-400 mb-3">
                  Gunakan format kolom yang telah disesuaikan agar import data BTS, Grid SF, dan POI berjalan akurat dan otomatis:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    onClick={() => handleDownloadTemplate('bts')}
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-700 p-3 rounded-lg text-left transition flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-slate-200 text-xs">Template BTS / Tower</div>
                      <div className="text-[10px] text-slate-400">ID, Nama, Tipe, Rev Flag, Lat, Lng</div>
                    </div>
                    <Download className="w-4 h-4 text-emerald-400" />
                  </button>
                  <button
                    onClick={() => handleDownloadTemplate('grid')}
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-700 p-3 rounded-lg text-left transition flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-slate-200 text-xs">Template Grid SF Master</div>
                      <div className="text-[10px] text-slate-400">Grid ID, MS TSEL/XL/SF, Category</div>
                    </div>
                    <Download className="w-4 h-4 text-blue-400" />
                  </button>
                  <button
                    onClick={() => handleDownloadTemplate('poi')}
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-700 p-3 rounded-lg text-left transition flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-slate-200 text-xs">Template POI Promotor</div>
                      <div className="text-[10px] text-slate-400">ID, Nama Outlet, Tipe, Lat, Lng</div>
                    </div>
                    <Download className="w-4 h-4 text-amber-400" />
                  </button>
                </div>
              </div>

              {/* Files in Active Folder */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <FolderCheck className="w-4 h-4 text-blue-400" />
                      File dalam Folder: {activeFolder?.name}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Riwayat file yang tersimpan dan terintegrasi pada folder dataset ini.
                    </p>
                  </div>
                  {activeFolder && (
                    <button
                      onClick={() => handleExportFolderJSON(activeFolder.id)}
                      className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Backup JSON</span>
                    </button>
                  )}
                </div>

                {activeFolder?.files && activeFolder.files.length > 0 ? (
                  <div className="space-y-2">
                    {activeFolder.files.map((file) => (
                      <div
                        key={file.id}
                        className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-200">{file.name}</div>
                            <div className="text-[10px] text-slate-400">
                              Diunggah: {new Date(file.uploadedAt).toLocaleString('id-ID')} • Ukuran:{' '}
                              {(file.size / 1024).toFixed(1)} KB
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-mono font-bold text-[11px]">
                            {file.recordCount} baris
                          </span>
                          <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] uppercase font-bold">
                            {file.type}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-500 text-xs">
                    Belum ada file individual yang tercatat dalam folder ini.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: DEPLOY GUIDE */}
          {activeTab === 'deploy' && (
            <div className="space-y-4">
              <DeployGuideContent />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Database Storage: /database/folders/ aktif tersinkronisasi</span>
          </div>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-1.5 rounded-lg transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
