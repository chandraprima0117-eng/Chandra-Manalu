import fs from 'fs';
import path from 'path';
import type { GridItem, BTSItem, POIItem, UserProfile, GridCategory, RevenueFlag, DatasetFolder, FolderFileItem, POIUpdateRecord } from '../src/types';

const DATA_DIR = path.join(process.cwd(), 'database');
const FOLDERS_DIR = path.join(DATA_DIR, 'folders');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(FOLDERS_DIR)) {
  fs.mkdirSync(FOLDERS_DIR, { recursive: true });
}

const GRIDS_FILE = path.join(DATA_DIR, 'grids.json');
const BTS_FILE = path.join(DATA_DIR, 'bts.json');
const POI_FILE = path.join(DATA_DIR, 'pois.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const FOLDERS_INDEX_FILE = path.join(DATA_DIR, 'folders-index.json');
const POI_LOGS_FILE = path.join(DATA_DIR, 'poi_logs.json');

// Normalizer ensuring all 15 grid headers are consistently populated:
// id,sitename,site_type,Province,City,Kecamatan,Region,latitude,longitude,GRID_META_ID,Rev_August_2026,Revenue_Flag,SF_Grid_Category,Geometry_WKT,Device_Status
export function normalizeGridItem(raw: any, index = 0): GridItem {
  // Support GeoJSON feature object with properties and geometry
  const props = raw.properties ? { ...raw.properties, geometry: raw.geometry, bounds: raw.bounds, coordinates: raw.geometry?.coordinates } : raw;

  const id = String(
    props.GRID_ID ?? props.grid_id ?? props.id ?? props['Grid ID'] ?? props['GRID ID'] ?? props.gridId ?? `352600${1000 + index}`
  );
  const Region = String(
    props.REGION ?? props.Region ?? props.region ?? props['Wilayah'] ?? props.wilayah ?? 'EAST JAVA'
  ).trim();
  const Province = String(
    props.PROVINCE ?? props.Province ?? props.province ?? props['Provinsi'] ?? props.provinsi ?? 'JAWA TIMUR (4672)'
  ).trim();
  const City = String(
    props.CITY ?? props['City MSA'] ?? props['CITY MSA'] ?? props.City ?? props.city ?? props['Kota'] ?? props['Kota/Kab'] ?? 'KAB. BANGKALAN'
  ).trim();
  const Kecamatan = String(
    props.KECAMATAN ?? props.Kecamatan ?? props.kecamatan ?? props.kec ?? 'Bangkalan'
  ).trim();

  // Coordinates resolution
  let lat = parseFloat(props['Center Lat'] ?? props.center_lat ?? props.latitude ?? props.lat ?? props.center?.[0]);
  let lng = parseFloat(props['Center Long'] ?? props.center_long ?? props.longitude ?? props.lng ?? props.ongitude ?? props.center?.[1]);

  // If bounds or coordinates are present, calculate bounds & center if needed
  let bounds: [[number, number], [number, number]];
  const coords = props.coordinates?.[0] || props.geometry?.coordinates?.[0];
  if (Array.isArray(coords) && coords.length >= 3) {
    const lngList = coords.map((c: any) => typeof c[0] === 'number' ? c[0] : parseFloat(c[0])).filter((n: number) => !isNaN(n));
    const latList = coords.map((c: any) => typeof c[1] === 'number' ? c[1] : parseFloat(c[1])).filter((n: number) => !isNaN(n));
    if (lngList.length > 0 && latList.length > 0) {
      const west = Math.min(...lngList);
      const east = Math.max(...lngList);
      const south = Math.min(...latList);
      const north = Math.max(...latList);
      bounds = [[south, west], [north, east]];
      if (isNaN(lat)) lat = (south + north) / 2;
      if (isNaN(lng)) lng = (west + east) / 2;
    } else {
      const step = 0.022;
      const safeLat = isNaN(lat) ? -7.05 : lat;
      const safeLng = isNaN(lng) ? 112.9 : lng;
      bounds = [
        [Number((safeLat - step / 2).toFixed(6)), Number((safeLng - step / 2).toFixed(6))],
        [Number((safeLat + step / 2).toFixed(6)), Number((safeLng + step / 2).toFixed(6))]
      ];
    }
  } else if (Array.isArray(props.bounds) && props.bounds.length === 2 && Array.isArray(props.bounds[0]) && Array.isArray(props.bounds[1])) {
    bounds = props.bounds;
    if (isNaN(lat)) lat = (props.bounds[0][0] + props.bounds[1][0]) / 2;
    if (isNaN(lng)) lng = (props.bounds[0][1] + props.bounds[1][1]) / 2;
  } else {
    const step = 0.022;
    const safeLat = isNaN(lat) ? -7.05 : lat;
    const safeLng = isNaN(lng) ? 112.9 : lng;
    bounds = [
      [Number((safeLat - step / 2).toFixed(6)), Number((safeLng - step / 2).toFixed(6))],
      [Number((safeLat + step / 2).toFixed(6)), Number((safeLng + step / 2).toFixed(6))]
    ];
  }

  const latitude = isNaN(lat) ? -7.05 : Number(lat.toFixed(6));
  const longitude = isNaN(lng) ? 112.9 : Number(lng.toFixed(6));

  const sitename = String(
    props.sitename || props.site_name || props['Nama Site'] || props.name || `${Kecamatan} Grid ${id.slice(-4)}`
  );
  
  // Category resolution: full support for SF Attack Category ("FULL ATTACK", "OPPORTUNITY ATTACK", etc.)
  const rawCat = String(
    props['SF Attack Category'] ?? props.SF_Attack_Category ?? props.SF_Grid_Category ?? props['SF_Grid_Category'] ?? props.sf_grid_category ?? props.cat ?? props.category ?? props['Kategori Grid'] ?? ''
  ).trim();

  let SF_Grid_Category: GridCategory = 'Avoid Cannibalism';
  const upperCat = rawCat.toUpperCase();
  if (upperCat === 'FULL ATTACK' || upperCat.includes('1ST PRIORITY') || upperCat === 'PRIORITY 1') {
    SF_Grid_Category = '1st Priority Acquisition';
  } else if (upperCat === 'OPPORTUNITY ATTACK' || upperCat.includes('2ND PRIORITY') || upperCat === 'PRIORITY 2') {
    SF_Grid_Category = '2nd Priority Acquisition';
  } else if (upperCat.includes('3RD PRIORITY') || upperCat === 'PRIORITY 3') {
    SF_Grid_Category = '3rd Priority';
  } else if (upperCat.includes('AVOID') || upperCat === 'AVOID CANNIBALISM') {
    SF_Grid_Category = 'Avoid Cannibalism';
  } else if (rawCat) {
    SF_Grid_Category = rawCat as GridCategory;
  }

  const site_type = String(
    props.site_type || props.siteType || props['site_type'] || props['Tipe Site'] || (SF_Grid_Category === '1st Priority Acquisition' ? 'Macro' : 'Micro')
  );
  const GRID_META_ID = String(
    props.GRID_META_ID || props.grid_meta_id || props['GRID_META_ID'] || props.metaId || `GM-${id}`
  );

  // Revenue August 2026
  let revVal = props.Rev_August_2026 ?? props.rev_august_2026 ?? props['Rev_August_2026'] ?? props.revenue ?? props.rev;
  let Rev_August_2026 = 0;
  if (typeof revVal === 'number') {
    Rev_August_2026 = revVal;
  } else if (typeof revVal === 'string') {
    const parsed = parseFloat(revVal.replace(/[^0-9.-]+/g, ''));
    Rev_August_2026 = isNaN(parsed) ? 35000000 : (parsed < 1000 ? parsed * 1000000 : parsed);
  } else {
    // Derive based on priority category
    if (SF_Grid_Category === '1st Priority Acquisition') Rev_August_2026 = 46500000;
    else if (SF_Grid_Category === '2nd Priority Acquisition') Rev_August_2026 = 33500000;
    else if (SF_Grid_Category === '3rd Priority') Rev_August_2026 = 23000000;
    else Rev_August_2026 = 14000000;
  }

  // Revenue Flag
  let Revenue_Flag: RevenueFlag = (props.Revenue_Flag || props.revenue_flag || props['Revenue_Flag'] || props.rev_flag) as RevenueFlag;
  if (!Revenue_Flag || Revenue_Flag === 'Unknown') {
    if (Rev_August_2026 >= 40000000) Revenue_Flag = 'Rev >40 Mn';
    else if (Rev_August_2026 >= 30000000) Revenue_Flag = 'Rev 30-40 Mn';
    else if (Rev_August_2026 >= 20000000) Revenue_Flag = 'Rev 20-30 Mn';
    else if (Rev_August_2026 > 0) Revenue_Flag = 'Rev <20 Mn';
    else Revenue_Flag = 'Rev 0';
  }

  // Device Status
  const Device_Status = String(props.Device_Status || props['Device_Status'] || props.device_status || props.status || 'Active');

  let Geometry_WKT = String(props.Geometry_WKT || props['Geometry_WKT'] || props.geometry_wkt || props.wkt || '');
  if (!Geometry_WKT || !Geometry_WKT.toLowerCase().includes('polygon')) {
    if (Array.isArray(coords) && coords.length >= 3) {
      const coordStr = coords.map((c: any) => `${c[0]} ${c[1]}`).join(', ');
      Geometry_WKT = `POLYGON ((${coordStr}))`;
    } else {
      const [[s, w], [n, e]] = bounds;
      Geometry_WKT = `POLYGON ((${w.toFixed(6)} ${s.toFixed(6)}, ${e.toFixed(6)} ${s.toFixed(6)}, ${e.toFixed(6)} ${n.toFixed(6)}, ${w.toFixed(6)} ${n.toFixed(6)}, ${w.toFixed(6)} ${s.toFixed(6)}))`;
    }
  }

  // Population handling (strips whitespace and commas from "   703  ", " 1,110  ")
  const rawPop = props.POPULATION ?? props.Population ?? props.population ?? props.pop ?? props['Populasi'];
  const pop = typeof rawPop === 'number'
    ? rawPop
    : (parseInt(String(rawPop || '').replace(/[^0-9]/g, '')) || 5000);

  // BTS & POI totals from properties
  const bts = typeof props.TOTAL_BTS === 'number'
    ? props.TOTAL_BTS
    : (typeof props.bts === 'number' ? props.bts : (parseInt(props.TOTAL_BTS ?? props.bts) || 0));

  const poi = typeof props.TOTAL_POI === 'number'
    ? props.TOTAL_POI
    : (typeof props.poi === 'number' ? props.poi : (parseInt(props.TOTAL_POI ?? props.poi) || 0));

  const prom = props['Mapping Promotor'] || props.prom || 'MULTIBRAND';

  return {
    id,
    sitename,
    site_type,
    Province,
    City,
    Kecamatan,
    Region,
    latitude,
    longitude,
    GRID_META_ID,
    Rev_August_2026,
    Revenue_Flag,
    SF_Grid_Category,
    Geometry_WKT,
    Device_Status,

    // Aliases
    region: Region,
    province: Province,
    city: City,
    kecamatan: Kecamatan,
    cat: SF_Grid_Category,
    bounds,
    center: [latitude, longitude],
    pop,
    tsel: String(props.tsel || '42.0%'),
    xlco: String(props.Download_Speed_XLCo ? `${props.Download_Speed_XLCo} Mbps` : (props.xlco || props.xl || '30.0%')),
    xl: String(props.Download_Speed_XLCo ? `${props.Download_Speed_XLCo} Mbps` : (props.xlco || props.xl || '30.0%')),
    ioh: String(props.ioh || '18.0%'),
    sf: String(props.Download_Speed_SF ? `${props.Download_Speed_SF} Mbps` : (props.sf || '10.0%')),
    bts,
    poi,
    prom
  };
}

// Normalizer ensuring all BTS / Tower headers requested by user:
// id,sitename,Aging (Month),site_type,Site Function,Province,City,Kecamatan,latitude,ongitude,Region,GRID_META_ID,,Rev.2026,Revenue Flag,BSP Data,Geometry WKT
export function normalizeBTSItem(raw: any, index = 0): BTSItem {
  const id = String(raw.id || raw['ID BTS'] || raw.ID || `EJ-BKL-${String(index + 1).padStart(4, '0')}`);
  const Province = String(raw.Province || raw.province || raw['Provinsi'] || 'JAWA TIMUR (4672)');
  const City = String(raw.City || raw.city || raw['Kota'] || raw['Kota/Kab'] || 'KAB. BANGKALAN');
  const Kecamatan = String(raw.Kecamatan || raw.kecamatan || raw.kec || 'Bangkalan');
  const Region = String(raw.Region || raw.region || raw['Wilayah'] || 'EAST JAVA');

  const lat = parseFloat(raw.latitude ?? raw.lat ?? raw['Latitude'] ?? -7.054);
  const lng = parseFloat(raw.ongitude ?? raw.longitude ?? raw.lng ?? raw['Longitude'] ?? raw['ongitude'] ?? 112.742);
  const latitude = isNaN(lat) ? -7.054 : Number(lat.toFixed(6));
  const ongitude = isNaN(lng) ? 112.742 : Number(lng.toFixed(6));

  const sitename = String(
    raw.sitename || raw['Nama BTS'] || raw.name || raw['sitename'] || 
    `BKL-${Kecamatan.toUpperCase().slice(0, 3)}-${String((index % 99) + 1).padStart(3, '0')}`
  );

  let agingRaw = raw['Aging (Month)'] ?? raw.aging_month ?? raw.aging ?? raw['Aging'] ?? (12 + ((index * 7) % 48));
  const agingMonth = typeof agingRaw === 'number' ? agingRaw : (parseInt(String(agingRaw)) || 24);

  const site_type = String(
    raw.site_type || raw['Tipe'] || raw.type || raw.siteType || (index % 4 === 0 ? 'Macro' : (index % 4 === 1 ? 'Micro' : 'Pole'))
  );

  const siteFunction = String(
    raw['Site Function'] || raw['Fungsi'] || raw.func || raw.site_function || (index % 3 === 0 ? 'Residential' : (index % 3 === 1 ? 'Commercial' : 'Highway'))
  );

  const GRID_META_ID = String(
    raw.GRID_META_ID || raw['Grid ID'] || raw.grid || raw.gridId || `GM-352600${1000 + (index % 50)}`
  );

  // Rev.2026
  let revVal = raw['Rev.2026'] ?? raw.Rev_2026 ?? raw['Rev 2026'] ?? raw.rev_2026 ?? raw.Rev_August_2026 ?? raw.revenue ?? (raw.rev ? null : undefined);
  let rev2026 = 0;
  if (typeof revVal === 'number') {
    rev2026 = revVal;
  } else if (typeof revVal === 'string') {
    const parsed = parseFloat(revVal.replace(/[^0-9.-]+/g, ''));
    rev2026 = isNaN(parsed) ? 42000000 : (parsed < 1000 ? parsed * 1000000 : parsed);
  } else {
    // Derived from rev flag if provided
    const flag = raw['Revenue Flag'] || raw.rev;
    if (flag === 'Rev >40 Mn') rev2026 = 48000000;
    else if (flag === 'Rev 30-40 Mn') rev2026 = 34000000;
    else if (flag === 'Rev 20-30 Mn') rev2026 = 24000000;
    else if (flag === 'Rev <20 Mn') rev2026 = 14000000;
    else if (flag === 'Rev 0') rev2026 = 0;
    else rev2026 = 45000000;
  }

  // Revenue Flag
  let revenueFlag: RevenueFlag = (raw['Revenue Flag'] || raw.revenue_flag || raw.rev || raw['Revenue_Flag']) as RevenueFlag;
  if (!revenueFlag || revenueFlag === 'Unknown') {
    if (rev2026 >= 40000000) revenueFlag = 'Rev >40 Mn';
    else if (rev2026 >= 30000000) revenueFlag = 'Rev 30-40 Mn';
    else if (rev2026 >= 20000000) revenueFlag = 'Rev 20-30 Mn';
    else if (rev2026 > 0) revenueFlag = 'Rev <20 Mn';
    else revenueFlag = 'Rev 0';
  }

  const bspData = String(
    raw['BSP Data'] || raw.bsp_data || raw['BSP'] || raw.bsp || 
    (index % 3 === 0 ? 'Smartfren Fiber Core' : (index % 3 === 1 ? 'Telkom BSP Tier-1' : 'Indosat Fiber BSP'))
  );

  const geometryWkt = String(
    raw['Geometry WKT'] || raw.Geometry_WKT || raw.wkt || 
    `POINT (${ongitude.toFixed(6)} ${latitude.toFixed(6)})`
  );

  return {
    id,
    sitename,
    'Aging (Month)': agingMonth,
    site_type,
    'Site Function': siteFunction,
    Province,
    City,
    Kecamatan,
    latitude,
    ongitude,
    Region,
    GRID_META_ID,
    'Rev.2026': rev2026,
    'Revenue Flag': revenueFlag,
    'BSP Data': bspData,
    'Geometry WKT': geometryWkt,

    // Aliases
    name: sitename,
    aging_month: agingMonth,
    site_function: siteFunction,
    func: siteFunction as any,
    type: site_type as any,
    region: Region,
    province: Province,
    city: City,
    kec: Kecamatan,
    lat: latitude,
    lng: ongitude,
    longitude: ongitude,
    grid: GRID_META_ID,
    gridId: GRID_META_ID,
    Rev_2026: rev2026,
    rev: revenueFlag,
    Revenue_Flag: revenueFlag,
    revenue_flag: revenueFlag,
    bsp_data: bspData,
    Geometry_WKT: geometryWkt,
    tenants: raw.tenants || ['Smartfren', 'XL', 'Indosat'],
    heightMeters: raw.heightMeters || 42
  };
}

// Normalizer ensuring all POI headers requested by user:
// Meta Grid ID,REGION,PROVINCE,XLS CITY,KECAMATAN,POI_ID,POI_NAME_RAW,POI_NAME,TAXON_NAME_RAW,TAXON_NAME,LATITUDE,LONGITUDE
export function normalizePOIItem(raw: any, index = 0): POIItem {
  const POI_ID = String(
    raw.POI_ID || raw.poi_id || raw['POI_ID'] || raw.id || raw.ID || raw['ID POI'] || `POI-BKL-${String(index + 1).padStart(4, '0')}`
  );
  const REGION = String(raw.REGION || raw.Region || raw.region || raw['Wilayah'] || 'EAST JAVA');
  const PROVINCE = String(raw.PROVINCE || raw.Province || raw.province || raw['Provinsi'] || 'JAWA TIMUR (4672)');
  const XLS_CITY = String(raw['XLS CITY'] || raw['XLS_CITY'] || raw['Xls City'] || raw.City || raw.city || raw['Kota'] || 'KAB. BANGKALAN');
  const KECAMATAN = String(raw.KECAMATAN || raw.Kecamatan || raw.kec || raw.kecamatan || 'Bangkalan');
  const Meta_Grid_ID = String(raw['Meta Grid ID'] || raw['META_GRID_ID'] || raw['Meta_Grid_ID'] || raw.meta_grid_id || raw['Grid ID'] || raw.grid || raw.GRID_META_ID || raw.gridId || '3526001000');

  const POI_NAME_RAW = String(
    raw.POI_NAME_RAW || raw['POI_NAME_RAW'] || raw.poi_name_raw || raw['Nama POI Raw'] || raw.name || raw.POI_NAME || raw.poi_name || `Titik POI #${index + 1}`
  );
  const POI_NAME = String(
    raw.POI_NAME || raw['POI_NAME'] || raw.poi_name || raw.name || raw['Nama POI'] || POI_NAME_RAW
  );

  const combinedTaxon = raw['TAXON_NAME_RAW TAXON_NAME'] || raw['TAXON_NAME_RAW_TAXON_NAME'] || '';
  const TAXON_NAME_RAW = String(
    raw.TAXON_NAME_RAW || raw['TAXON_NAME_RAW'] || raw.taxon_name_raw || (combinedTaxon ? combinedTaxon.split(' ')[0] : '') || raw.type || raw.category || 'Traditional Market'
  );
  const TAXON_NAME = String(
    raw.TAXON_NAME || raw['TAXON_NAME'] || raw.taxon_name || combinedTaxon || TAXON_NAME_RAW || raw.type || 'Traditional Market'
  );

  const lat = parseFloat(raw.LATITUDE ?? raw['Latitude'] ?? raw.latitude ?? raw.lat ?? -7.054);
  const lng = parseFloat(raw.LONGITUDE ?? raw['Longitude'] ?? raw.longitude ?? raw.ongitude ?? raw.lng ?? 112.742);
  const LATITUDE = isNaN(lat) ? -7.054 : Number(lat.toFixed(6));
  const LONGITUDE = isNaN(lng) ? 112.742 : Number(lng.toFixed(6));

  return {
    'Meta Grid ID': Meta_Grid_ID,
    REGION,
    PROVINCE,
    'XLS CITY': XLS_CITY,
    KECAMATAN,
    POI_ID,
    POI_NAME_RAW,
    POI_NAME,
    TAXON_NAME_RAW,
    TAXON_NAME,
    LATITUDE,
    LONGITUDE,

    'TAXON_NAME_RAW TAXON_NAME': `${TAXON_NAME_RAW} ${TAXON_NAME}`.trim(),

    // Aliases for compatibility
    id: POI_ID,
    name: POI_NAME,
    type: TAXON_NAME,
    city: XLS_CITY,
    kec: KECAMATAN,
    kecamatan: KECAMATAN,
    province: PROVINCE,
    region: REGION,
    grid: Meta_Grid_ID,
    gridId: Meta_Grid_ID,
    lat: LATITUDE,
    lng: LONGITUDE,
    latitude: LATITUDE,
    longitude: LONGITUDE,
    poi_id: POI_ID,
    poi_name: POI_NAME,
    poi_name_raw: POI_NAME_RAW,
    taxon_name: TAXON_NAME,
    taxon_name_raw: TAXON_NAME_RAW
  };
}

// Helper to generate realistic Bangkalan grids matching the screenshot counts:
// Exactly 207 grids: 50 P1, 8 P2, 0 P3, 149 Avoid Cannibalism
function generateBangkalanGrids(): GridItem[] {
  const grids: GridItem[] = [];
  const kecamatans = [
    'Bangkalan', 'Burneh', 'Socah', 'Arosbaya', 'Klampis', 
    'Sepulu', 'Tanjungbumi', 'Kokop', 'Kwanyar', 'Modung', 
    'Blega', 'Galis', 'Tanah Merah', 'Tragah', 'Labuhan', 
    'Kedungdung', 'Kamal', 'Banyuates'
  ];

  // Grid bounding box around Bangkalan:
  // Lat: -7.22 to -6.88 (~17 rows)
  // Lng: 112.65 to 113.15 (~22 cols)
  const baseLat = -7.22;
  const baseLng = 112.66;
  const stepLat = 0.022;
  const stepLng = 0.024;

  let p1Remaining = 50;
  let p2Remaining = 8;
  let avoidRemaining = 149;
  let idCounter = 1000;

  // Generate grid matrix within Bangkalan peninsula boundary
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 18; c++) {
      if (grids.length >= 207) break;

      const south = baseLat + r * stepLat;
      const north = south + stepLat;
      const west = baseLng + c * stepLng;
      const east = west + stepLng;
      const centerLat = (south + north) / 2;
      const centerLng = (west + east) / 2;

      // Approximate Madura island / Bangkalan shape check
      const isOcean = (centerLat < -7.16 && centerLng < 112.72) || 
                      (centerLat > -6.90 && centerLng < 112.80) ||
                      (centerLat < -7.18 && centerLng > 113.05);
      
      if (isOcean && Math.random() > 0.3) {
        continue;
      }

      let category: GridCategory = 'Avoid Cannibalism';
      if (p1Remaining > 0 && ((r + c) % 4 === 0 || (c < 6 && r > 4))) {
        category = '1st Priority Acquisition';
        p1Remaining--;
      } else if (p2Remaining > 0 && ((r * c) % 7 === 1)) {
        category = '2nd Priority Acquisition';
        p2Remaining--;
      } else if (avoidRemaining > 0) {
        category = 'Avoid Cannibalism';
        avoidRemaining--;
      } else if (p1Remaining > 0) {
        category = '1st Priority Acquisition';
        p1Remaining--;
      } else if (p2Remaining > 0) {
        category = '2nd Priority Acquisition';
        p2Remaining--;
      }

      const kec = kecamatans[(r * 3 + c) % kecamatans.length];
      const pop = Math.floor(2500 + Math.random() * 18000);
      const tselNum = 35 + Math.random() * 20;
      const xlcoNum = 20 + Math.random() * 18;
      const iohNum = 14 + Math.random() * 12;
      const sfNum = Math.max(3, 100 - tselNum - xlcoNum - iohNum);
      const total = tselNum + xlcoNum + iohNum + sfNum;

      const tselShare = ((tselNum / total) * 100).toFixed(1) + '%';
      const xlcoShare = ((xlcoNum / total) * 100).toFixed(1) + '%';
      const iohShare = ((iohNum / total) * 100).toFixed(1) + '%';
      const sfShare = ((sfNum / total) * 100).toFixed(1) + '%';

      const btsNum = category === '1st Priority Acquisition' ? Math.floor(Math.random() * 3) : Math.floor(Math.random() * 2);
      const poiNum = Math.floor(Math.random() * 28);

      const gridId = `3526${String(idCounter++).padStart(6, '0')}`;
      const sitename = `${kec} Sentral ${((r + c) % 6) + 1}`;
      const site_type = category === '1st Priority Acquisition' ? 'Macro' : (category === '2nd Priority Acquisition' ? 'Micro' : 'Pole');
      const gridMetaId = `GM-${gridId}`;

      let revAmount = 15000000;
      let revFlag: RevenueFlag = 'Rev <20 Mn';
      if (category === '1st Priority Acquisition') {
        revAmount = Math.floor(41000000 + Math.random() * 24000000);
        revFlag = 'Rev >40 Mn';
      } else if (category === '2nd Priority Acquisition') {
        revAmount = Math.floor(31000000 + Math.random() * 8500000);
        revFlag = 'Rev 30-40 Mn';
      } else {
        revAmount = Math.floor(12000000 + Math.random() * 16000000);
        revFlag = revAmount >= 20000000 ? 'Rev 20-30 Mn' : 'Rev <20 Mn';
      }

      const statuses = ['Active', 'Normal', 'High Load', 'Active', 'Active'];
      const deviceStatus = statuses[(r + c) % statuses.length];
      const wkt = `POLYGON ((${west.toFixed(6)} ${south.toFixed(6)}, ${east.toFixed(6)} ${south.toFixed(6)}, ${east.toFixed(6)} ${north.toFixed(6)}, ${west.toFixed(6)} ${north.toFixed(6)}, ${west.toFixed(6)} ${south.toFixed(6)}))`;

      grids.push({
        id: gridId,
        sitename,
        site_type,
        Province: 'JAWA TIMUR (4672)',
        City: 'KAB. BANGKALAN',
        Kecamatan: kec,
        Region: 'EAST JAVA',
        latitude: Number(centerLat.toFixed(6)),
        longitude: Number(centerLng.toFixed(6)),
        GRID_META_ID: gridMetaId,
        Rev_August_2026: revAmount,
        Revenue_Flag: revFlag,
        SF_Grid_Category: category,
        Geometry_WKT: wkt,
        Device_Status: deviceStatus,

        // Aliases
        region: 'EAST JAVA',
        province: 'JAWA TIMUR (4672)',
        city: 'KAB. BANGKALAN',
        kecamatan: kec,
        pop,
        tsel: tselShare,
        xlco: xlcoShare,
        ioh: iohShare,
        sf: sfShare,
        xl: xlcoShare,
        bts: btsNum,
        poi: poiNum,
        cat: category,
        prom: (r + c) % 2 === 0 ? 'MULTIBRAND' : 'SINGLEBRAND',
        bounds: [[south, west], [north, east]],
        center: [centerLat, centerLng]
      });
    }
  }

  // Ensure exact counts: 50 P1, 8 P2, 0 P3, 149 Avoid
  const p1Target = 50;
  const p2Target = 8;
  grids.forEach(g => {
    g.cat = 'Avoid Cannibalism';
    g.SF_Grid_Category = 'Avoid Cannibalism';
    g.Rev_August_2026 = Math.floor(12000000 + Math.random() * 12000000);
    g.Revenue_Flag = 'Rev <20 Mn';
    g.site_type = 'Pole';
  });
  for (let i = 0; i < p1Target && i < grids.length; i++) {
    grids[i].cat = '1st Priority Acquisition';
    grids[i].SF_Grid_Category = '1st Priority Acquisition';
    grids[i].Rev_August_2026 = Math.floor(42000000 + Math.random() * 25000000);
    grids[i].Revenue_Flag = 'Rev >40 Mn';
    grids[i].site_type = 'Macro';
  }
  for (let i = p1Target; i < p1Target + p2Target && i < grids.length; i++) {
    grids[i].cat = '2nd Priority Acquisition';
    grids[i].SF_Grid_Category = '2nd Priority Acquisition';
    grids[i].Rev_August_2026 = Math.floor(32000000 + Math.random() * 7000000);
    grids[i].Revenue_Flag = 'Rev 30-40 Mn';
    grids[i].site_type = 'Micro';
  }

  return grids;
}

// Helper to generate Bali Nusra grids: 602 total
function generateBaliGrids(): GridItem[] {
  const grids: GridItem[] = [];
  const cities = ['KAB. BADUNG', 'KOTA DENPASAR', 'KAB. BANGLI', 'KAB. GIANYAR', 'KAB. TABANAN', 'KAB. BULELENG'];
  const kecamatans = ['Kuta', 'Kuta Selatan', 'Kuta Utara', 'Denpasar Barat', 'Denpasar Selatan', 'Denpasar Timur', 'Kintamani', 'Ubud', 'Sukawati', 'Mengwi'];

  const baseLat = -8.85;
  const baseLng = 114.50;
  const step = 0.035;

  let id = 600000;
  // Exact distribution: 153 P1, 72 P2, 81 P3, 296 Avoid Cannibalism = 602 total
  const catDistribution: GridCategory[] = [];
  for (let i = 0; i < 153; i++) catDistribution.push('1st Priority Acquisition');
  for (let i = 0; i < 72; i++) catDistribution.push('2nd Priority Acquisition');
  for (let i = 0; i < 81; i++) catDistribution.push('3rd Priority');
  for (let i = 0; i < 296; i++) catDistribution.push('Avoid Cannibalism');

  // Shuffle slightly
  catDistribution.sort(() => Math.random() - 0.5);

  for (let i = 0; i < 602; i++) {
    const row = Math.floor(i / 25);
    const col = i % 25;
    const south = baseLat + row * step;
    const north = south + step;
    const west = baseLng + col * step;
    const east = west + step;
    const city = cities[i % cities.length];
    const kec = kecamatans[i % kecamatans.length];

    const pop = Math.floor(4000 + Math.random() * 25000);
    const tselNum = 38 + Math.random() * 20;
    const xlcoNum = 24 + Math.random() * 18;
    const iohNum = 14 + Math.random() * 12;
    const sfNum = Math.max(3, 100 - tselNum - xlcoNum - iohNum);
    const total = tselNum + xlcoNum + iohNum + sfNum;

    const cat = catDistribution[i];
    const gridId = `5100${String(id++).padStart(6, '0')}`;
    const sitename = `${kec} Sector ${(i % 5) + 1}`;
    const site_type = cat === '1st Priority Acquisition' ? 'Macro' : (cat === '2nd Priority Acquisition' ? 'Micro' : 'Small Cell');
    const gridMetaId = `GM-${gridId}`;

    let revAmount = 22000000;
    let revFlag: RevenueFlag = 'Rev 20-30 Mn';
    if (cat === '1st Priority Acquisition') {
      revAmount = Math.floor(43000000 + Math.random() * 20000000);
      revFlag = 'Rev >40 Mn';
    } else if (cat === '2nd Priority Acquisition') {
      revAmount = Math.floor(31000000 + Math.random() * 8000000);
      revFlag = 'Rev 30-40 Mn';
    } else if (cat === '3rd Priority') {
      revAmount = Math.floor(21000000 + Math.random() * 7000000);
      revFlag = 'Rev 20-30 Mn';
    } else {
      revAmount = Math.floor(10000000 + Math.random() * 9000000);
      revFlag = 'Rev <20 Mn';
    }

    const statuses = ['Active', 'Normal', 'High Load', 'Active', 'Under Maintenance'];
    const deviceStatus = statuses[i % statuses.length];
    const wkt = `POLYGON ((${west.toFixed(6)} ${south.toFixed(6)}, ${east.toFixed(6)} ${south.toFixed(6)}, ${east.toFixed(6)} ${north.toFixed(6)}, ${west.toFixed(6)} ${north.toFixed(6)}, ${west.toFixed(6)} ${south.toFixed(6)}))`;

    grids.push({
      id: gridId,
      sitename,
      site_type,
      Province: 'BALI (602)',
      City: city,
      Kecamatan: kec,
      Region: 'BALI NUSRA',
      latitude: Number(((south + north) / 2).toFixed(6)),
      longitude: Number(((west + east) / 2).toFixed(6)),
      GRID_META_ID: gridMetaId,
      Rev_August_2026: revAmount,
      Revenue_Flag: revFlag,
      SF_Grid_Category: cat,
      Geometry_WKT: wkt,
      Device_Status: deviceStatus,

      // Aliases
      region: 'BALI NUSRA',
      province: 'BALI (602)',
      city,
      kecamatan: kec,
      pop,
      tsel: ((tselNum / total) * 100).toFixed(1) + '%',
      xlco: ((xlcoNum / total) * 100).toFixed(1) + '%',
      ioh: ((iohNum / total) * 100).toFixed(1) + '%',
      sf: ((sfNum / total) * 100).toFixed(1) + '%',
      xl: ((xlcoNum / total) * 100).toFixed(1) + '%',
      bts: Math.floor(Math.random() * 6),
      poi: Math.floor(Math.random() * 45),
      cat,
      prom: i % 3 === 0 ? 'MULTIBRAND' : 'SINGLEBRAND',
      bounds: [[south, west], [north, east]],
      center: [(south + north) / 2, (west + east) / 2]
    });
  }

  return grids;
}

function generateInitialBTS(grids: GridItem[]): BTSItem[] {
  const btsList: BTSItem[] = [];
  const revOptions = ['Rev >40 Mn', 'Rev 30-40 Mn', 'Rev 20-30 Mn', 'Rev <20 Mn', 'Rev 0', 'Unknown'] as const;

  // Generate 25 BTS in Bangkalan area
  const bklGrids = grids.filter(g => g.city === 'KAB. BANGKALAN');
  for (let i = 0; i < Math.min(25, bklGrids.length); i++) {
    const g = bklGrids[i * 8 % bklGrids.length];
    const btsId = `EJ-BKL-${String(i + 1).padStart(4, '0')}`;
    const sitename = `BKL-${g.kecamatan.toUpperCase().slice(0, 3)}-${String(i + 1).padStart(3, '0')}`;
    const lat = g.center[0] + (Math.random() - 0.5) * 0.01;
    const lng = g.center[1] + (Math.random() - 0.5) * 0.01;
    const revFlag = revOptions[i % revOptions.length];
    const siteType = i % 4 === 0 ? 'Macro' : i % 4 === 1 ? 'Micro' : 'Pole';
    const siteFunc = i % 3 === 0 ? 'Residential' : i % 3 === 1 ? 'Commercial' : 'Highway';

    btsList.push(normalizeBTSItem({
      id: btsId,
      sitename,
      'Aging (Month)': 18 + ((i * 7) % 40),
      site_type: siteType,
      'Site Function': siteFunc,
      Province: g.province,
      City: g.city,
      Kecamatan: g.kecamatan,
      latitude: lat,
      ongitude: lng,
      Region: g.region,
      GRID_META_ID: `GM-${g.id}`,
      'Rev.2026': revFlag === 'Rev >40 Mn' ? 48500000 : (revFlag === 'Rev 30-40 Mn' ? 34200000 : 22000000),
      'Revenue Flag': revFlag,
      'BSP Data': i % 2 === 0 ? 'Smartfren Fiber Core' : 'Telkom BSP Tier-1',
      'Geometry WKT': `POINT (${lng.toFixed(6)} ${lat.toFixed(6)})`,
      heightMeters: 42,
      tenants: ['XL', 'Smartfren', 'Indosat']
    }, i));
  }

  // Generate 35 BTS in Bali area
  const baliGrids = grids.filter(g => g.province === 'BALI (602)');
  for (let i = 0; i < Math.min(35, baliGrids.length); i++) {
    const g = baliGrids[i * 15 % baliGrids.length];
    const btsId = `BAL-BA-${String(i + 1).padStart(4, '0')}`;
    const sitename = `BAL-${g.kecamatan.toUpperCase().slice(0, 3)}-${String(i + 1).padStart(3, '0')}`;
    const lat = g.center[0] + (Math.random() - 0.5) * 0.015;
    const lng = g.center[1] + (Math.random() - 0.5) * 0.015;
    const revFlag = revOptions[i % revOptions.length];
    const siteType = i % 2 === 0 ? 'Macro' : 'Micro';
    const siteFunc = 'Residential';

    btsList.push(normalizeBTSItem({
      id: btsId,
      sitename,
      'Aging (Month)': 12 + ((i * 5) % 36),
      site_type: siteType,
      'Site Function': siteFunc,
      Province: g.province,
      City: g.city,
      Kecamatan: g.kecamatan,
      latitude: lat,
      ongitude: lng,
      Region: g.region,
      GRID_META_ID: `GM-${g.id}`,
      'Rev.2026': revFlag === 'Rev >40 Mn' ? 51000000 : (revFlag === 'Rev 30-40 Mn' ? 35000000 : 25000000),
      'Revenue Flag': revFlag,
      'BSP Data': 'Fiber Optic Tier-1',
      'Geometry WKT': `POINT (${lng.toFixed(6)} ${lat.toFixed(6)})`,
      heightMeters: 50,
      tenants: ['Telkomsel', 'XL', 'Smartfren']
    }, i + 25));
  }

  return btsList;
}

function generateInitialPOIs(grids: GridItem[]): POIItem[] {
  const pois: POIItem[] = [];
  const taxonPairs = [
    { raw: 'Traditional Market & Groceries', clean: 'Traditional Market' },
    { raw: 'Outlet Smartphone & Voucher Pulsa', clean: 'Modern Outlet' },
    { raw: 'Sekolah Menengah & Kampus', clean: 'School/Campus' },
    { raw: 'Terminal, Pelabuhan & Transportasi', clean: 'Transportation' },
    { raw: 'Kantor Pemerintahan & BUMN', clean: 'Government' },
    { raw: 'Pusat Pertokoan & Ruko Niaga', clean: 'Store Cluster' }
  ];

  const bklGrids = grids.filter(g => g.city === 'KAB. BANGKALAN');
  for (let i = 0; i < Math.min(40, bklGrids.length); i++) {
    const g = bklGrids[(i * 5) % bklGrids.length];
    const pair = taxonPairs[i % taxonPairs.length];
    const id = `POI-BKL-${String(i + 1).padStart(4, '0')}`;
    const rawName = `TITIK OUTLET PROMOTOR ${g.kecamatan.toUpperCase()} #${i + 1}`;
    const cleanName = `Titik Promotor ${g.kecamatan} #${i + 1}`;
    const lat = g.center[0] + (Math.random() - 0.5) * 0.008;
    const lng = g.center[1] + (Math.random() - 0.5) * 0.008;

    pois.push(normalizePOIItem({
      'Meta Grid ID': g.GRID_META_ID || `GM-${g.id}`,
      REGION: g.Region || g.region || 'EAST JAVA',
      PROVINCE: g.Province || g.province || 'JAWA TIMUR (4672)',
      'XLS CITY': g.City || g.city || 'KAB. BANGKALAN',
      KECAMATAN: g.Kecamatan || g.kecamatan || 'Bangkalan',
      POI_ID: id,
      POI_NAME_RAW: rawName,
      POI_NAME: cleanName,
      TAXON_NAME_RAW: pair.raw,
      TAXON_NAME: pair.clean,
      LATITUDE: lat,
      LONGITUDE: lng
    }, i));
  }

  return pois;
}

export class DataStore {
  private grids: GridItem[] = [];
  private bts: BTSItem[] = [];
  private pois: POIItem[] = [];
  private poiLogs: POIUpdateRecord[] = [];
  private folders: DatasetFolder[] = [];
  private users: UserProfile[] = [
    { id: '1', name: 'Super Admin', role: 'ADMIN', scope: 'NASIONAL', email: 'admin@xlsmart.co.id' },
    { id: '2', name: 'Bali Nusra Manager', role: 'REGION', scope: 'BALI NUSRA', email: 'region.balinusra@xlsmart.co.id' },
    { id: '3', name: 'Bangkalan Specialist', role: 'CITY', scope: 'KAB. BANGKALAN', email: 'city.bangkalan@xlsmart.co.id' },
    { id: '4', name: 'Harpa Promoter', role: 'PROMOTER', scope: 'HARPA', email: 'HARPA' }
  ];

  constructor() {
    this.init();
  }

  private init() {
    if (fs.existsSync(GRIDS_FILE)) {
      try {
        const raw = JSON.parse(fs.readFileSync(GRIDS_FILE, 'utf-8'));
        this.grids = raw.map((g: any, idx: number) => normalizeGridItem(g, idx));
        this.saveGrids();
      } catch (e) {
        console.error('Error reading grids file, regenerating', e);
        this.resetDefaults();
      }
    } else {
      this.resetDefaults();
    }

    if (fs.existsSync(BTS_FILE)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(BTS_FILE, 'utf-8'));
        this.bts = Array.isArray(parsed) ? parsed.map((b, idx) => normalizeBTSItem(b, idx)) : [];
        this.saveBTS();
      } catch (e) {
        console.error('Error reading bts file, regenerating', e);
      }
    }

    if (fs.existsSync(POI_FILE)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(POI_FILE, 'utf-8'));
        this.pois = Array.isArray(parsed) ? parsed.map((p, idx) => normalizePOIItem(p, idx)) : [];
        this.savePOIs();
      } catch (e) {
        console.error('Error reading pois file, regenerating', e);
      }
    }

    if (fs.existsSync(POI_LOGS_FILE)) {
      try {
        this.poiLogs = JSON.parse(fs.readFileSync(POI_LOGS_FILE, 'utf-8'));
      } catch (e) {
        console.error('Error reading poi_logs file', e);
        this.poiLogs = [];
      }
    } else {
      this.poiLogs = [];
      this.savePOILogs();
    }

    if (fs.existsSync(USERS_FILE)) {
      try {
        this.users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      } catch (e) {
        console.error('Error reading users file', e);
      }
    } else {
      this.saveUsers();
    }

    this.initFolders();
  }

  public resetDefaults() {
    const bklGrids = generateBangkalanGrids();
    const baliGrids = generateBaliGrids();
    this.grids = [...bklGrids, ...baliGrids];
    this.bts = generateInitialBTS(this.grids);
    this.pois = generateInitialPOIs(this.grids);
    this.saveAll();
  }

  private saveGrids() {
    const json = this.grids.length > 1000 ? JSON.stringify(this.grids) : JSON.stringify(this.grids, null, 2);
    fs.writeFileSync(GRIDS_FILE, json, 'utf-8');
  }

  private saveBTS() {
    const json = this.bts.length > 1000 ? JSON.stringify(this.bts) : JSON.stringify(this.bts, null, 2);
    fs.writeFileSync(BTS_FILE, json, 'utf-8');
  }

  private savePOIs() {
    const json = this.pois.length > 1000 ? JSON.stringify(this.pois) : JSON.stringify(this.pois, null, 2);
    fs.writeFileSync(POI_FILE, json, 'utf-8');
  }

  private saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(this.users, null, 2), 'utf-8');
  }

  public saveAll() {
    this.saveGrids();
    this.saveBTS();
    this.savePOIs();
    this.saveUsers();
  }

  // Grids operations
  public getGrids(filters?: {
    region?: string;
    province?: string;
    city?: string;
    kecamatan?: string;
    category?: string;
    search?: string;
  }): GridItem[] {
    let result = [...this.grids];

    if (filters) {
      if (filters.region && filters.region !== 'ALL') {
        result = result.filter(g => g.region === filters.region);
      }
      if (filters.province && filters.province !== 'ALL') {
        result = result.filter(g => g.province === filters.province);
      }
      if (filters.city && filters.city !== 'ALL') {
        result = result.filter(g => g.city === filters.city);
      }
      if (filters.kecamatan && filters.kecamatan !== 'ALL') {
        const targetKec = filters.kecamatan.toLowerCase();
        result = result.filter(g => g.kecamatan.toLowerCase() === targetKec);
      }
      if (filters.category) {
        const cats = filters.category.split(',').map(c => c.trim());
        if (cats.length > 0 && cats[0] !== 'ALL') {
          result = result.filter(g => cats.includes(g.cat) || cats.includes(g.SF_Grid_Category));
        }
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        result = result.filter(g => 
          g.id.toLowerCase().includes(q) || 
          (g.sitename && g.sitename.toLowerCase().includes(q)) ||
          (g.GRID_META_ID && g.GRID_META_ID.toLowerCase().includes(q)) ||
          (g.site_type && g.site_type.toLowerCase().includes(q)) ||
          (g.Device_Status && g.Device_Status.toLowerCase().includes(q)) ||
          (g.Revenue_Flag && g.Revenue_Flag.toLowerCase().includes(q)) ||
          g.kecamatan.toLowerCase().includes(q) ||
          g.city.toLowerCase().includes(q)
        );
      }
    }

    return result;
  }

  public getGridById(id: string): GridItem | undefined {
    return this.grids.find(g => g.id === id);
  }

  public addGrid(grid: GridItem): GridItem {
    const normalized = normalizeGridItem(grid);
    const existingIndex = this.grids.findIndex(g => g.id === normalized.id);
    if (existingIndex >= 0) {
      this.grids[existingIndex] = normalized;
    } else {
      this.grids.unshift(normalized);
    }
    this.saveGrids();
    return normalized;
  }

  public updateGrid(id: string, updates: Partial<GridItem>): GridItem | null {
    const idx = this.grids.findIndex(g => g.id === id);
    if (idx === -1) return null;
    const normalized = normalizeGridItem({ ...this.grids[idx], ...updates });
    this.grids[idx] = normalized;
    this.saveGrids();
    return this.grids[idx];
  }

  public deleteGrid(id: string): boolean {
    const initialLen = this.grids.length;
    this.grids = this.grids.filter(g => g.id !== id);
    if (this.grids.length !== initialLen) {
      this.saveGrids();
      return true;
    }
    return false;
  }

  // BTS operations
  public getBTS(filters?: { region?: string; province?: string; city?: string; kec?: string; rev?: string; search?: string; limit?: number }): BTSItem[] {
    let result = [...this.bts];
    if (filters) {
      if (filters.region && filters.region !== 'ALL') {
        result = result.filter(b => b.region === filters.region || b.Region === filters.region);
      }
      if (filters.province && filters.province !== 'ALL') {
        result = result.filter(b => b.province === filters.province || b.Province === filters.province);
      }
      if (filters.city && filters.city !== 'ALL') {
        result = result.filter(b => b.city === filters.city || b.City === filters.city);
      }
      if (filters.kec && filters.kec !== 'ALL') {
        const targetKec = filters.kec.toLowerCase();
        result = result.filter(b => (b.kec && b.kec.toLowerCase() === targetKec) || (b.Kecamatan && b.Kecamatan.toLowerCase() === targetKec));
      }
      if (filters.rev && filters.rev !== 'ALL') {
        result = result.filter(b => b.rev === filters.rev || b['Revenue Flag'] === filters.rev);
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        result = result.filter(b => 
          b.id.toLowerCase().includes(q) ||
          (b.sitename && b.sitename.toLowerCase().includes(q)) ||
          (b.name && b.name.toLowerCase().includes(q)) ||
          (b.GRID_META_ID && b.GRID_META_ID.toLowerCase().includes(q)) ||
          (b.site_type && b.site_type.toLowerCase().includes(q)) ||
          (b['Site Function'] && b['Site Function'].toLowerCase().includes(q)) ||
          (b['BSP Data'] && b['BSP Data'].toLowerCase().includes(q)) ||
          (b.Kecamatan && b.Kecamatan.toLowerCase().includes(q)) ||
          (b.City && b.City.toLowerCase().includes(q))
        );
      }
      if (filters.limit && filters.limit > 0 && result.length > filters.limit) {
        result = result.slice(0, filters.limit);
      }
    }
    return result;
  }

  public addBTS(bts: BTSItem): BTSItem {
    const normalized = normalizeBTSItem(bts);
    const existingIndex = this.bts.findIndex(b => b.id === normalized.id);
    if (existingIndex >= 0) {
      this.bts[existingIndex] = normalized;
    } else {
      this.bts.unshift(normalized);
    }
    this.saveBTS();
    return normalized;
  }

  public updateBTS(id: string, updates: Partial<BTSItem>): BTSItem | null {
    const idx = this.bts.findIndex(b => b.id === id);
    if (idx === -1) return null;
    const normalized = normalizeBTSItem({ ...this.bts[idx], ...updates });
    this.bts[idx] = normalized;
    this.saveBTS();
    return this.bts[idx];
  }

  public deleteBTS(id: string): boolean {
    const prev = this.bts.length;
    this.bts = this.bts.filter(b => b.id !== id);
    if (this.bts.length !== prev) {
      this.saveBTS();
      return true;
    }
    return false;
  }

  // POIs
  public getPOIs(filters?: { region?: string; province?: string; city?: string; kec?: string } | string): POIItem[] {
    let result = [...this.pois];
    if (typeof filters === 'string') {
      if (filters && filters !== 'ALL') {
        result = result.filter(p => p.city === filters || p['XLS CITY'] === filters);
      }
      return result;
    }
    if (filters) {
      if (filters.region && filters.region !== 'ALL') {
        result = result.filter(p => p.REGION === filters.region || p.region === filters.region);
      }
      if (filters.province && filters.province !== 'ALL') {
        result = result.filter(p => p.PROVINCE === filters.province || p.province === filters.province);
      }
      if (filters.city && filters.city !== 'ALL') {
        result = result.filter(p => p['XLS CITY'] === filters.city || p.city === filters.city);
      }
      if (filters.kec && filters.kec !== 'ALL') {
        const targetKec = filters.kec.toLowerCase();
        result = result.filter(p => (p.KECAMATAN && p.KECAMATAN.toLowerCase() === targetKec) || (p.kec && p.kec.toLowerCase() === targetKec));
      }
    }
    return result;
  }

  public addPOI(poi: any): POIItem {
    const normalized = normalizePOIItem(poi);
    const existingIndex = this.pois.findIndex(p => p.id === normalized.id || p.POI_ID === normalized.POI_ID);
    if (existingIndex >= 0) {
      this.pois[existingIndex] = normalized;
    } else {
      this.pois.unshift(normalized);
    }
    this.savePOIs();
    return normalized;
  }

  public updatePOI(id: string, updates: Partial<POIItem> | any): POIItem | null {
    const idx = this.pois.findIndex(p => p.id === id || p.POI_ID === id);
    if (idx === -1) return null;
    const normalized = normalizePOIItem({ ...this.pois[idx], ...updates });
    this.pois[idx] = normalized;
    this.savePOIs();
    return this.pois[idx];
  }

  public deletePOI(id: string): boolean {
    const prevLen = this.pois.length;
    this.pois = this.pois.filter(p => p.id !== id && p.POI_ID !== id);
    if (this.pois.length !== prevLen) {
      this.savePOIs();
      return true;
    }
    return false;
  }

  public batchUpsertPOIs(newPOIs: any[]): number {
    const map = new Map<string, POIItem>();
    for (const p of this.pois) {
      map.set(p.POI_ID || p.id, p);
    }
    for (let i = 0; i < newPOIs.length; i++) {
      const p = normalizePOIItem(newPOIs[i], i);
      const key = p.POI_ID || p.id;
      const ex = map.get(key);
      map.set(key, ex ? { ...ex, ...p } : p);
    }
    this.pois = Array.from(map.values());
    this.savePOIs();
    return newPOIs.length;
  }

  // --- USER MANAGEMENT METHODS ---
  public getUsers(): UserProfile[] {
    return this.users.map(u => ({
      id: u.id,
      name: u.name,
      role: u.role,
      scope: u.scope,
      email: u.email,
      status: u.status || 'ACTIVE',
      createdAt: u.createdAt || '2026-01-01T00:00:00.000Z'
    }));
  }

  public createUser(userData: Omit<UserProfile, 'id'> & { password?: string }): UserProfile {
    const newUser: UserProfile = {
      id: 'usr-' + Date.now(),
      name: userData.name.trim(),
      role: userData.role || 'PROMOTER',
      scope: userData.scope?.trim() || 'NASIONAL',
      email: userData.email.trim(),
      password: userData.password?.trim() || '123456',
      status: userData.status || 'ACTIVE',
      createdAt: new Date().toISOString()
    };
    this.users.push(newUser);
    this.saveUsers();
    return newUser;
  }

  public updateUser(id: string, updates: Partial<UserProfile & { password?: string }>): UserProfile | null {
    const idx = this.users.findIndex(u => u.id === id);
    if (idx === -1) return null;

    this.users[idx] = {
      ...this.users[idx],
      ...updates
    };
    this.saveUsers();
    return this.users[idx];
  }

  public deleteUser(id: string): boolean {
    const userToDelete = this.users.find(u => u.id === id);
    // Protect primary admin from deletion
    if (userToDelete && userToDelete.email === 'admin@xlsmart.co.id') {
      return false;
    }

    const prevLen = this.users.length;
    this.users = this.users.filter(u => u.id !== id);
    if (this.users.length !== prevLen) {
      this.saveUsers();
      return true;
    }
    return false;
  }

  // POI Logs & Photo Form Management
  private savePOILogs() {
    try {
      fs.writeFileSync(POI_LOGS_FILE, JSON.stringify(this.poiLogs, null, 2));
    } catch (e) {
      console.error('Error writing poi_logs file', e);
    }
  }

  public getPOILogs(): POIUpdateRecord[] {
    return [...this.poiLogs];
  }

  public addPOILog(data: Omit<POIUpdateRecord, 'id' | 'createdAt'>): POIUpdateRecord {
    const newLog: POIUpdateRecord = {
      id: 'poi-log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      ...data,
      createdAt: new Date().toISOString()
    };
    this.poiLogs.unshift(newLog);
    this.savePOILogs();
    return newLog;
  }

  public deletePOILog(id: string): boolean {
    const prev = this.poiLogs.length;
    this.poiLogs = this.poiLogs.filter(l => l.id !== id);
    if (this.poiLogs.length !== prev) {
      this.savePOILogs();
      return true;
    }
    return false;
  }

  // Batch CMS import
  public batchUpsertGrids(newGrids: GridItem[]): number {
    const map = new Map<string, GridItem>();
    for (const g of this.grids) {
      map.set(g.id, g);
    }
    for (let i = 0; i < newGrids.length; i++) {
      const g = normalizeGridItem(newGrids[i], i);
      const ex = map.get(g.id);
      map.set(g.id, ex ? { ...ex, ...g } : g);
    }
    this.grids = Array.from(map.values());
    this.saveGrids();
    return newGrids.length;
  }

  public batchUpsertBTS(newBTS: BTSItem[]): number {
    const map = new Map<string, BTSItem>();
    for (const b of this.bts) {
      map.set(b.id, b);
    }
    for (let i = 0; i < newBTS.length; i++) {
      const b = normalizeBTSItem(newBTS[i], i);
      const ex = map.get(b.id);
      map.set(b.id, ex ? { ...ex, ...b } : b);
    }
    this.bts = Array.from(map.values());
    this.saveBTS();
    return newBTS.length;
  }

  // KPI summary calculation
  public getKPI(filters?: { region?: string; province?: string; city?: string; kecamatan?: string }) {
    const filteredGrids = this.getGrids(filters);
    const filteredBTS = this.getBTS({
      region: filters?.region,
      province: filters?.province,
      city: filters?.city,
      kec: filters?.kecamatan
    });

    return {
      towerCount: filteredBTS.length,
      gridCount: filteredGrids.length,
      p1Count: filteredGrids.filter(g => g.cat === '1st Priority Acquisition').length,
      p2Count: filteredGrids.filter(g => g.cat === '2nd Priority Acquisition').length,
      p3Count: filteredGrids.filter(g => g.cat === '3rd Priority').length,
      cannibalCount: filteredGrids.filter(g => g.cat === 'Avoid Cannibalism').length
    };
  }

  // Dynamic Geographic Hierarchy derived from all Grids, BTS, and POIs
  public getGeoHierarchy() {
    const hierarchy: Record<string, Record<string, Record<string, string[]>>> = {};

    const addEntry = (regionRaw?: string, provinceRaw?: string, cityRaw?: string, kecRaw?: string) => {
      const region = (regionRaw || 'EAST JAVA').trim();
      const province = (provinceRaw || 'JAWA TIMUR (4672)').trim();
      const city = (cityRaw || 'KAB. BANGKALAN').trim();
      const kec = (kecRaw || 'Bangkalan').trim();

      if (!hierarchy[region]) {
        hierarchy[region] = {};
      }
      if (!hierarchy[region][province]) {
        hierarchy[region][province] = {};
      }
      if (!hierarchy[region][province][city]) {
        hierarchy[region][province][city] = [];
      }
      if (kec && !hierarchy[region][province][city].includes(kec)) {
        hierarchy[region][province][city].push(kec);
      }
    };

    // Scan all grids
    for (const g of this.grids) {
      addEntry(g.region || g.Region, g.province || g.Province, g.city || g.City, g.kecamatan || g.Kecamatan);
    }

    // Scan all BTS
    for (const b of this.bts) {
      addEntry(b.region || b.Region, b.province || b.Province, b.city || b.City, b.kec || b.Kecamatan);
    }

    // Scan all POIs
    for (const p of this.pois) {
      addEntry(p.REGION || p.region, p.PROVINCE || p.province, p['XLS CITY'] || p.city, p.KECAMATAN || p.kec);
    }

    // Sort all kecamatans alphabetically
    for (const reg in hierarchy) {
      for (const prov in hierarchy[reg]) {
        for (const c in hierarchy[reg][prov]) {
          hierarchy[reg][prov][c].sort();
        }
      }
    }

    return hierarchy;
  }

  public authenticate(username: string): UserProfile {
    const normalized = username.trim().toLowerCase();
    const existing = this.users.find(
      u => u.email.toLowerCase() === normalized ||
           u.name.toLowerCase() === normalized ||
           u.scope.toLowerCase() === normalized
    );
    if (existing) {
      return {
        id: existing.id,
        name: existing.name,
        role: existing.role,
        scope: existing.scope,
        email: existing.email,
        status: existing.status || 'ACTIVE'
      };
    }

    if (normalized.includes('admin')) {
      return this.users[0];
    } else if (normalized.includes('balinusra') || normalized.includes('region')) {
      return this.users[1];
    } else if (normalized.includes('bangkalan') || normalized.includes('city')) {
      return this.users[2];
    } else {
      return {
        id: 'user-' + Date.now(),
        name: username.toUpperCase(),
        role: 'PROMOTER',
        scope: username.toUpperCase(),
        email: username,
        status: 'ACTIVE'
      };
    }
  }

  // --- DATASET FOLDERS MANAGEMENT ---
  private initFolders() {
    const now = new Date().toISOString();

    // Check if grids need complete national defaults
    if (this.grids.length < 500) {
      this.resetDefaults();
    }

    // Always ensure single unified 'Nasional' folder as requested
    const folderNasional: DatasetFolder = {
      id: 'folder-nasional',
      name: 'Nasional',
      description: 'Dataset Master Nasional (Seluruh Region, Provinsi, Kota & BTS Terintegrasi)',
      region: 'NASIONAL',
      city: 'ALL',
      createdAt: now,
      updatedAt: now,
      gridCount: this.grids.length,
      btsCount: this.bts.length,
      poiCount: this.pois.length,
      isActive: true,
      files: [
        {
          id: 'file-nasional-grid',
          name: 'Grid_Master_Nasional.xlsx',
          type: 'grid',
          size: 198000,
          uploadedAt: now,
          recordCount: this.grids.length
        },
        {
          id: 'file-nasional-bts',
          name: 'BTS_Master_Nasional.xlsx',
          type: 'bts',
          size: 64000,
          uploadedAt: now,
          recordCount: this.bts.length
        },
        {
          id: 'file-nasional-poi',
          name: 'POI_Master_Nasional.xlsx',
          type: 'poi',
          size: 48000,
          uploadedAt: now,
          recordCount: this.pois.length
        }
      ]
    };

    if (fs.existsSync(FOLDERS_INDEX_FILE)) {
      try {
        const loaded: DatasetFolder[] = JSON.parse(fs.readFileSync(FOLDERS_INDEX_FILE, 'utf-8'));
        // Check if old split folders exist (folder-bangkalan or folder-bali)
        const hasOldSplit = loaded.some(f => f.id === 'folder-bangkalan' || f.id === 'folder-bali');
        if (hasOldSplit || loaded.length === 0) {
          this.folders = [folderNasional];
        } else {
          // Keep custom user-created folders, but ensure folder-nasional is present and active
          const existingNasional = loaded.find(f => f.id === 'folder-nasional');
          if (existingNasional) {
            existingNasional.gridCount = this.grids.length;
            existingNasional.btsCount = this.bts.length;
            existingNasional.poiCount = this.pois.length;
            this.folders = loaded;
          } else {
            this.folders = [folderNasional, ...loaded.filter(f => f.id !== 'folder-bangkalan' && f.id !== 'folder-bali')];
          }
        }
      } catch (e) {
        console.error('Error reading folders index, setting default nasional folder', e);
        this.folders = [folderNasional];
      }
    } else {
      this.folders = [folderNasional];
    }

    if (!this.folders.some(f => f.isActive)) {
      this.folders[0].isActive = true;
    }

    this.saveFoldersIndex();
    this.persistFolderData('folder-nasional', this.grids, this.bts, this.pois);
  }

  private persistFolderData(folderId: string, grids: GridItem[], bts: BTSItem[], pois: POIItem[]) {
    const dir = path.join(FOLDERS_DIR, folderId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'grids.json'), grids.length > 1000 ? JSON.stringify(grids) : JSON.stringify(grids, null, 2), 'utf-8');
    fs.writeFileSync(path.join(dir, 'bts.json'), bts.length > 1000 ? JSON.stringify(bts) : JSON.stringify(bts, null, 2), 'utf-8');
    fs.writeFileSync(path.join(dir, 'pois.json'), pois.length > 1000 ? JSON.stringify(pois) : JSON.stringify(pois, null, 2), 'utf-8');
  }

  private saveFoldersIndex() {
    fs.writeFileSync(FOLDERS_INDEX_FILE, JSON.stringify(this.folders, null, 2), 'utf-8');
  }

  public getFolders(): DatasetFolder[] {
    return this.folders.filter(f => f.id !== 'folder-all' && !f.name.toLowerCase().includes('master gabungan'));
  }

  public getFolderById(id: string) {
    const folder = this.folders.find(f => f.id === id);
    if (!folder) return null;
    const dir = path.join(FOLDERS_DIR, id);
    let grids: GridItem[] = [];
    let bts: BTSItem[] = [];
    let pois: POIItem[] = [];
    try {
      if (fs.existsSync(path.join(dir, 'grids.json'))) {
        const rawGrids = JSON.parse(fs.readFileSync(path.join(dir, 'grids.json'), 'utf-8'));
        grids = Array.isArray(rawGrids) ? rawGrids.map((g: any, idx: number) => normalizeGridItem(g, idx)) : [];
      }
      if (fs.existsSync(path.join(dir, 'bts.json'))) {
        bts = JSON.parse(fs.readFileSync(path.join(dir, 'bts.json'), 'utf-8'));
      }
      if (fs.existsSync(path.join(dir, 'pois.json'))) {
        pois = JSON.parse(fs.readFileSync(path.join(dir, 'pois.json'), 'utf-8'));
      }
    } catch (e) {
      console.error('Error reading folder detail', e);
    }
    return { folder, grids, bts, pois };
  }

  public createFolder(
    name: string,
    description?: string,
    region?: string,
    city?: string,
    dataDate?: string,
    period?: string
  ): DatasetFolder {
    const id = 'folder-' + Date.now();
    const now = new Date().toISOString();
    const newFolder: DatasetFolder = {
      id,
      name,
      description: description || 'Folder dataset kustom pengguna',
      region: region || 'ALL',
      city: city || 'ALL',
      dataDate: dataDate || new Date().toISOString().split('T')[0],
      period: period || 'Q1 2026',
      createdAt: now,
      updatedAt: now,
      gridCount: 0,
      btsCount: 0,
      poiCount: 0,
      isActive: false,
      files: []
    };

    this.folders.unshift(newFolder);
    this.saveFoldersIndex();
    this.persistFolderData(id, [], [], []);
    return newFolder;
  }

  public updateFolder(id: string, updates: Partial<DatasetFolder>): DatasetFolder | null {
    const idx = this.folders.findIndex(f => f.id === id);
    if (idx === -1) return null;
    this.folders[idx] = { ...this.folders[idx], ...updates, updatedAt: new Date().toISOString() };
    this.saveFoldersIndex();
    return this.folders[idx];
  }

  public deleteFolder(id: string): boolean {
    if (this.folders.length <= 1) return false;
    const idx = this.folders.findIndex(f => f.id === id);
    if (idx === -1) return false;
    const wasActive = this.folders[idx].isActive;
    this.folders.splice(idx, 1);

    const dir = path.join(FOLDERS_DIR, id);
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (e) {
        console.error('Error deleting folder dir', e);
      }
    }

    if (wasActive && this.folders.length > 0) {
      this.activateFolder(this.folders[0].id);
    } else {
      this.saveFoldersIndex();
    }
    return true;
  }

  public activateFolder(id: string): boolean {
    const folderData = this.getFolderById(id);
    if (!folderData) return false;

    this.grids = folderData.grids;
    this.bts = folderData.bts;
    this.pois = folderData.pois;
    this.saveAll();

    this.folders = this.folders.map(f => ({
      ...f,
      isActive: f.id === id
    }));
    this.saveFoldersIndex();
    return true;
  }

  public uploadToFolder(
    folderId: string,
    options: {
      type: 'grid' | 'bts' | 'poi' | 'batch';
      records: any[];
      fileName?: string;
      mode?: 'replace' | 'merge' | 'append';
      activate?: boolean;
      isFirstChunk?: boolean;
      isLastChunk?: boolean;
      totalRecords?: number;
    }
  ): { success: boolean; count: number; folder: DatasetFolder } {
    let folder = this.folders.find(f => f.id === folderId);
    if (!folder) {
      folder = this.createFolder(folderId.replace('folder-', 'Folder '));
    }

    const currentData = this.getFolderById(folder.id) || {
      folder,
      grids: [],
      bts: [],
      pois: []
    };

    let updatedGrids = [...currentData.grids];
    let updatedBTS = [...currentData.bts];
    let updatedPOIs = [...currentData.pois];
    const mode = options.mode || 'merge';
    const isFirstChunk = options.isFirstChunk !== false;
    const isLastChunk = options.isLastChunk !== false;

    let count = 0;
    if (options.type === 'grid') {
      const incoming = (options.records as any[]).map((g, idx) => normalizeGridItem(g, idx));
      count = incoming.length;
      if (mode === 'replace') {
        updatedGrids = incoming;
      } else if (mode === 'append') {
        updatedGrids.push(...incoming);
      } else {
        const map = new Map<string, GridItem>();
        for (const g of updatedGrids) map.set(g.id, g);
        for (const g of incoming) {
          const ex = map.get(g.id);
          map.set(g.id, ex ? { ...ex, ...g } : g);
        }
        updatedGrids = Array.from(map.values());
      }
    } else if (options.type === 'bts') {
      const incoming = (options.records as any[]).map((b, idx) => normalizeBTSItem(b, idx));
      count = incoming.length;
      if (mode === 'replace') {
        updatedBTS = incoming;
      } else if (mode === 'append') {
        updatedBTS.push(...incoming);
      } else {
        const map = new Map<string, BTSItem>();
        for (const b of updatedBTS) map.set(b.id, b);
        for (const b of incoming) {
          const ex = map.get(b.id);
          map.set(b.id, ex ? { ...ex, ...b } : b);
        }
        updatedBTS = Array.from(map.values());
      }
    } else if (options.type === 'poi') {
      const incoming = (options.records as any[]).map((p, idx) => normalizePOIItem(p, idx));
      count = incoming.length;
      if (mode === 'replace') {
        updatedPOIs = incoming;
      } else if (mode === 'append') {
        updatedPOIs.push(...incoming);
      } else {
        const map = new Map<string, POIItem>();
        for (const p of updatedPOIs) {
          const key = p.POI_ID || p.id;
          map.set(key, p);
        }
        for (const p of incoming) {
          const key = p.POI_ID || p.id;
          const ex = map.get(key);
          map.set(key, ex ? { ...ex, ...p } : p);
        }
        updatedPOIs = Array.from(map.values());
      }
    }

    const now = new Date().toISOString();
    const finalRecordCount = options.totalRecords || (
      options.type === 'bts' ? updatedBTS.length : options.type === 'poi' ? updatedPOIs.length : updatedGrids.length
    );

    folder.gridCount = updatedGrids.length;
    folder.btsCount = updatedBTS.length;
    folder.poiCount = updatedPOIs.length;
    folder.updatedAt = now;

    if (updatedGrids.length > 0) {
      const sampleGrid = updatedGrids[0];
      if (sampleGrid && sampleGrid.region) {
        if (!folder.region || folder.region === 'ALL' || folder.region === 'EAST JAVA') {
          folder.region = sampleGrid.region;
        }
        if (sampleGrid.city && (!folder.city || folder.city === 'ALL' || folder.city === 'KAB. BANGKALAN')) {
          folder.city = sampleGrid.city;
        }
      }
    }

    // Persist folder data to disk
    this.persistFolderData(folder.id, updatedGrids, updatedBTS, updatedPOIs);

    if (isLastChunk) {
      // Record file metadata
      const newFileItem: FolderFileItem = {
        id: 'file-' + Date.now(),
        name: options.fileName || `${options.type}-dataset-${now.slice(0, 10)}.xlsx`,
        type: options.type === 'batch' ? 'raw' : options.type,
        size: finalRecordCount * 280,
        uploadedAt: now,
        recordCount: finalRecordCount
      };

      const existingFileIdx = folder.files.findIndex(f => f.name === newFileItem.name);
      if (existingFileIdx >= 0) {
        folder.files[existingFileIdx] = newFileItem;
      } else {
        folder.files.unshift(newFileItem);
      }

      this.saveFoldersIndex();

      // If folder is currently active, or user requested activation, update active database
      if (folder.isActive || options.activate) {
        this.grids = updatedGrids;
        this.bts = updatedBTS;
        this.pois = updatedPOIs;
        this.saveAll();
        if (options.activate) {
          for (const f of this.folders) {
            f.isActive = f.id === folder.id;
          }
          this.saveFoldersIndex();
        }
      }
    }

    return { success: true, count: finalRecordCount, folder };
  }

  public exportFolderData(folderId: string) {
    const data = this.getFolderById(folderId);
    if (!data) return null;
    return {
      metadata: data.folder,
      grids: data.grids,
      bts: data.bts,
      pois: data.pois,
      exportedAt: new Date().toISOString()
    };
  }
}

export const db = new DataStore();
