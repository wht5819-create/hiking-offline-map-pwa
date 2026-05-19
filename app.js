const state = {
  routePoints: [],
  waypoints: [],
  bounds: null,
  watchId: null,
  lastAcceptedPosition: null,
  lastAcceptedAt: 0,
  deferredInstallPrompt: null,
  sqlReady: null,
  mapPackage: null,
  tileImageCache: new Map(),
};

const elements = {
  canvas: document.querySelector('#mapCanvas'),
  mapInput: document.querySelector('#mapInput'),
  gpxInput: document.querySelector('#gpxInput'),
  trackCount: document.querySelector('#trackCount'),
  waypointCount: document.querySelector('#waypointCount'),
  waypointList: document.querySelector('#waypointList'),
  routeName: document.querySelector('#routeName'),
  trackingButton: document.querySelector('#trackingButton'),
  clearButton: document.querySelector('#clearButton'),
  safetyStatus: document.querySelector('#safetyStatus'),
  deviationDistance: document.querySelector('#deviationDistance'),
  gpsDot: document.querySelector('#gpsDot'),
  installButton: document.querySelector('#installButton'),
  readyCount: document.querySelector('#readyCount'),
  departureChecks: document.querySelectorAll('[data-check]'),
  mapName: document.querySelector('#mapName'),
  mapMeta: document.querySelector('#mapMeta'),
  mapStatus: document.querySelector('#mapStatus'),
};

const ctx = elements.canvas.getContext('2d');

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  state.deferredInstallPrompt = event;
  elements.installButton.hidden = false;
});

elements.installButton.addEventListener('click', async () => {
  if (!state.deferredInstallPrompt) return;
  state.deferredInstallPrompt.prompt();
  await state.deferredInstallPrompt.userChoice;
  state.deferredInstallPrompt = null;
  elements.installButton.hidden = true;
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(() => {
    state.offlineReady = true;
    updateDepartureChecklist();
  }).catch(() => {
    state.offlineReady = false;
    updateDepartureChecklist();
  });
}

elements.mapInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    setSafetyStatus('正在讀取魯地圖圖資', '');
    elements.mapStatus.textContent = '正在讀取圖資 metadata，檔案越大需要越久。';
    const mapPackage = await importMapPackage(file);
    state.mapPackage?.db?.close();
    state.tileImageCache.clear();
    state.mapPackage = mapPackage;
    updateMapPackageSummary();
    updateDepartureChecklist();
    drawMap();
    const renderNote = mapPackage.isRaster ? '可作為地圖底圖' : '已匯入，vector PBF 尚未在 PWA 渲染';
    setSafetyStatus(`魯地圖已匯入：${renderNote}`, 'ok');
  } catch (error) {
    state.mapPackage = null;
    updateMapPackageSummary();
    updateDepartureChecklist();
    drawMap();
    setSafetyStatus(`魯地圖匯入失敗：${error.message}`, 'danger');
  }
});

elements.gpxInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const xmlText = await file.text();
    const parsed = parseGpx(xmlText);
    state.routePoints = parsed.routePoints;
    state.waypoints = parsed.waypoints;
    state.bounds = calculateBounds(parsed.routePoints);
    elements.routeName.textContent = file.name;
    updateRouteSummary();
    updateDepartureChecklist();
    drawMap();
    setSafetyStatus('GPX 已載入，可啟動定位', 'ok');
  } catch (error) {
    setSafetyStatus(`GPX 匯入失敗：${error.message}`, 'danger');
  }
});

elements.trackingButton.addEventListener('click', () => {
  if (state.watchId !== null) {
    stopTracking();
    return;
  }
  startTracking();
});

elements.clearButton.addEventListener('click', () => {
  stopTracking();
  state.routePoints = [];
  state.waypoints = [];
  state.bounds = null;
  state.lastAcceptedPosition = null;
  elements.gpsDot.hidden = true;
  elements.gpxInput.value = '';
  elements.routeName.textContent = '未載入路線';
  elements.deviationDistance.textContent = '--';
  updateRouteSummary();
  updateDepartureChecklist();
  setSafetyStatus('尚未匯入 GPX', '');
  drawMap();
});

window.addEventListener('resize', drawMap);
updateDepartureChecklist();
drawMap();

function parseGpx(xmlText) {
  const documentXml = new DOMParser().parseFromString(xmlText, 'application/xml');
  const parserError = documentXml.querySelector('parsererror');
  if (parserError) {
    throw new Error('XML 格式毀損');
  }

  const routePoints = [...documentXml.querySelectorAll('trkpt')].map((node) => ({
    lat: readNumberAttribute(node, 'lat'),
    lon: readNumberAttribute(node, 'lon'),
    ele: readOptionalNumber(node.querySelector('ele')?.textContent),
  }));
  const waypoints = [...documentXml.querySelectorAll('wpt')].map((node) => ({
    lat: readNumberAttribute(node, 'lat'),
    lon: readNumberAttribute(node, 'lon'),
    ele: readOptionalNumber(node.querySelector('ele')?.textContent),
    name: node.querySelector('name')?.textContent?.trim() || '未命名航點',
  }));

  if (routePoints.length === 0 && waypoints.length === 0) {
    throw new Error('檔案內沒有 trkpt 或 wpt');
  }

  return { routePoints, waypoints };
}

function readNumberAttribute(node, name) {
  const value = Number(node.getAttribute(name));
  if (!Number.isFinite(value)) {
    throw new Error(`座標欄位 ${name} 不是有效數值`);
  }
  return value;
}

function readOptionalNumber(value) {
  if (!value) return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function startTracking() {
  if (state.routePoints.length < 2) {
    setSafetyStatus('請先匯入 GPX 航跡', 'danger');
    return;
  }
  if (!navigator.geolocation) {
    setSafetyStatus('此瀏覽器不支援 GPS 定位', 'danger');
    return;
  }

  state.watchId = navigator.geolocation.watchPosition(
    handlePosition,
    (error) => setSafetyStatus(`定位失敗：${error.message}`, 'danger'),
    {
      enableHighAccuracy: true,
      maximumAge: 8000,
      timeout: 15000,
    },
  );
  elements.trackingButton.textContent = '停止定位';
  setSafetyStatus('定位啟動中', 'ok');
}

function stopTracking() {
  if (state.watchId !== null) {
    navigator.geolocation.clearWatch(state.watchId);
  }
  state.watchId = null;
  elements.trackingButton.textContent = '啟動定位';
  if (state.routePoints.length > 0) {
    setSafetyStatus('偏離警報未啟動', '');
  }
}

function handlePosition(position) {
  const current = {
    lat: position.coords.latitude,
    lon: position.coords.longitude,
  };
  const now = Date.now();
  const movedMeters = state.lastAcceptedPosition
    ? haversineMeters(current, state.lastAcceptedPosition)
    : Infinity;

  if (now - state.lastAcceptedAt < 10000 && movedMeters < 10) {
    return;
  }

  state.lastAcceptedAt = now;
  state.lastAcceptedPosition = current;
  const distance = shortestDistanceToRouteMeters(current, state.routePoints);
  elements.deviationDistance.textContent = `${Math.round(distance)}m`;
  updateGpsDot(current);
  updateDepartureChecklist();

  if (distance > 50) {
    setSafetyStatus(`偏離航線 ${Math.round(distance)} 公尺`, 'danger');
    if ('vibrate' in navigator) navigator.vibrate([250, 120, 250]);
  } else {
    setSafetyStatus(`航線內 ${Math.round(distance)} 公尺`, 'ok');
  }
}

function updateRouteSummary() {
  elements.trackCount.textContent = state.routePoints.length.toString();
  elements.waypointCount.textContent = state.waypoints.length.toString();
  elements.waypointList.innerHTML = '';

  if (state.waypoints.length === 0) {
    const item = document.createElement('li');
    item.textContent = '尚無航點';
    elements.waypointList.append(item);
    return;
  }

  for (const waypoint of state.waypoints.slice(0, 20)) {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    const meta = document.createElement('span');
    title.textContent = waypoint.name;
    meta.textContent = `${waypoint.lat.toFixed(5)}, ${waypoint.lon.toFixed(5)}`;
    item.append(title, meta);
    elements.waypointList.append(item);
  }
}

function drawMap() {
  const canvas = elements.canvas;
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(320, Math.floor(rect.width * scale));
  canvas.height = Math.max(320, Math.floor(rect.height * scale));
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  const width = rect.width;
  const height = rect.height;
  drawTerrain(width, height);
  if (state.mapPackage?.isRaster) {
    drawRasterMap(width, height);
  }

  if (state.routePoints.length >= 2 && state.bounds) {
    drawRoute(width, height);
  }
  if (state.lastAcceptedPosition) {
    updateGpsDot(state.lastAcceptedPosition);
  }
}

function drawTerrain(width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f8f6ef';
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 18; i += 1) {
    ctx.beginPath();
    const y = (height / 18) * i + 8;
    for (let x = -20; x <= width + 20; x += 20) {
      const wave = Math.sin((x + i * 27) / 54) * 13 + Math.cos(x / 91) * 7;
      if (x === -20) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(155, 139, 100, 0.55)' : 'rgba(155, 139, 100, 0.28)';
    ctx.lineWidth = i % 3 === 0 ? 1.4 : 0.8;
    ctx.stroke();
  }
}

function drawRoute(width, height) {
  ctx.beginPath();
  state.routePoints.forEach((point, index) => {
    const projected = project(point, width, height);
    if (index === 0) ctx.moveTo(projected.x, projected.y);
    else ctx.lineTo(projected.x, projected.y);
  });
  ctx.strokeStyle = '#d9792b';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function updateGpsDot(point) {
  const bounds = getViewBounds();
  if (!bounds) return;
  const rect = elements.canvas.getBoundingClientRect();
  const projected = project(point, rect.width, rect.height, bounds);
  elements.gpsDot.hidden = false;
  elements.gpsDot.style.left = `${projected.x}px`;
  elements.gpsDot.style.top = `${projected.y}px`;
}

function calculateBounds(points) {
  if (points.length === 0) return null;
  const lats = points.map((point) => point.lat);
  const lons = points.map((point) => point.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  return {
    minLat,
    maxLat,
    minLon,
    maxLon,
    latSpan: Math.max(maxLat - minLat, 0.0001),
    lonSpan: Math.max(maxLon - minLon, 0.0001),
  };
}

function project(point, width, height) {
  const bounds = getViewBounds();
  if (!bounds) return { x: width / 2, y: height / 2 };
  return projectIntoBounds(point, width, height, bounds);
}

function projectIntoBounds(point, width, height, bounds) {
  const padding = 28;
  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);
  return {
    x: padding + ((point.lon - bounds.minLon) / bounds.lonSpan) * usableWidth,
    y: padding + ((bounds.maxLat - point.lat) / bounds.latSpan) * usableHeight,
  };
}

function getViewBounds() {
  return state.bounds || state.mapPackage?.bounds || null;
}

function shortestDistanceToRouteMeters(point, route) {
  let shortest = Infinity;
  for (let index = 0; index < route.length - 1; index += 1) {
    shortest = Math.min(shortest, distancePointToSegmentMeters(point, route[index], route[index + 1]));
  }
  return shortest;
}

function distancePointToSegmentMeters(point, start, end) {
  const originLatRad = degreesToRadians(point.lat);
  const projectMeters = (coordinate) => ({
    x: earthRadiusMeters * degreesToRadians(coordinate.lon - point.lon) * Math.cos(originLatRad),
    y: earthRadiusMeters * degreesToRadians(coordinate.lat - point.lat),
  });
  const p = { x: 0, y: 0 };
  const a = projectMeters(start);
  const b = projectMeters(end);
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const abLengthSquared = abX * abX + abY * abY;
  if (abLengthSquared === 0) return haversineMeters(point, start);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abX + (p.y - a.y) * abY) / abLengthSquared));
  const nearest = { x: a.x + abX * t, y: a.y + abY * t };
  return Math.hypot(p.x - nearest.x, p.y - nearest.y);
}

const earthRadiusMeters = 6371008.8;

function haversineMeters(a, b) {
  const lat1 = degreesToRadians(a.lat);
  const lat2 = degreesToRadians(b.lat);
  const deltaLat = degreesToRadians(b.lat - a.lat);
  const deltaLon = degreesToRadians(b.lon - a.lon);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function degreesToRadians(degrees) {
  return degrees * Math.PI / 180;
}

function setSafetyStatus(message, mode) {
  elements.safetyStatus.textContent = message;
  elements.safetyStatus.classList.toggle('danger', mode === 'danger');
  elements.safetyStatus.classList.toggle('ok', mode === 'ok');
}

function updateDepartureChecklist() {
  const secureReady = window.isSecureContext || window.location.hostname === 'localhost';
  const installedReady =
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const checks = {
    secure: {
      ready: secureReady,
      text: secureReady ? (installedReady ? '已安裝' : '可安裝') : '需要 HTTPS',
    },
    offline: {
      ready: state.offlineReady === true,
      text: state.offlineReady ? '已快取' : '等待快取',
    },
    map: {
      ready: Boolean(state.mapPackage),
      text: state.mapPackage ? state.mapPackage.formatLabel : '未匯入',
    },
    gpx: {
      ready: state.routePoints.length >= 2,
      text: state.routePoints.length >= 2 ? `${state.routePoints.length} 點` : '未載入',
    },
    gps: {
      ready: state.lastAcceptedPosition !== null,
      text: state.lastAcceptedPosition ? '已取得位置' : state.watchId !== null ? '定位中' : '未啟動',
    },
  };

  let readyTotal = 0;
  for (const item of elements.departureChecks) {
    const key = item.dataset.check;
    const check = checks[key];
    if (!check) continue;
    item.classList.toggle('ready', check.ready);
    item.querySelector('em').textContent = check.text;
    if (check.ready) readyTotal += 1;
  }
  elements.readyCount.textContent = `${readyTotal}/${Object.keys(checks).length}`;
}

async function importMapPackage(file) {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.map')) {
    return importMapsforgeMap(file);
  }
  if (lowerName.endsWith('.mbtiles')) {
    return importMbtiles(file);
  }
  throw new Error('請選擇魯地圖 .map 或 .mbtiles 圖資');
}

async function importMbtiles(file) {
  const SQL = await loadSqlJs();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const db = new SQL.Database(bytes);
  const metadata = readMbtilesMetadata(db);
  const format = normalizeTileFormat(metadata.format);
  const bounds = parseMbtilesBounds(metadata.bounds);
  const minZoom = readZoom(metadata.minzoom, db, 'MIN');
  const maxZoom = readZoom(metadata.maxzoom, db, 'MAX');
  const tileCount = readTileCount(db);
  const isRaster = ['png', 'jpg', 'jpeg', 'webp'].includes(format);

  if (!bounds) {
    throw new Error('metadata 缺少 bounds，無法定位圖資範圍');
  }

  return {
    db,
    type: 'mbtiles',
    fileName: file.name,
    metadata,
    format,
    formatLabel: isRaster ? format.toUpperCase() : format ? format.toUpperCase() : '未知',
    isRaster,
    minZoom,
    maxZoom,
    tileCount,
    scheme: (metadata.scheme || 'tms').toLowerCase(),
    bounds,
  };
}

async function importMapsforgeMap(file) {
  const headerBytes = new Uint8Array(await file.slice(0, 96).arrayBuffer());
  const header = parseMapsforgeHeader(headerBytes, file.size);
  return {
    db: null,
    type: 'mapsforge',
    fileName: file.name,
    metadata: {
      version: header.version.toString(),
      date: header.mapDate ? new Date(header.mapDate).toISOString().slice(0, 10) : '',
    },
    format: 'mapsforge',
    formatLabel: 'MAP',
    isRaster: false,
    minZoom: 0,
    maxZoom: 0,
    tileCount: 0,
    scheme: 'mapsforge',
    bounds: header.bounds,
  };
}

function parseMapsforgeHeader(bytes, fileSize) {
  const magic = decodeAscii(bytes.slice(0, 20));
  if (magic !== 'mapsforge binary OSM') {
    throw new Error('不是有效的 Mapsforge .map 圖資');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const declaredHeaderSize = view.getInt32(20, false);
  const version = view.getInt32(24, false);
  const declaredFileSize = Number(view.getBigInt64(28, false));
  const mapDate = Number(view.getBigInt64(36, false));
  const minLat = view.getInt32(44, false) / 1000000;
  const minLon = view.getInt32(48, false) / 1000000;
  const maxLat = view.getInt32(52, false) / 1000000;
  const maxLon = view.getInt32(56, false) / 1000000;

  if (!Number.isFinite(declaredHeaderSize) || declaredHeaderSize <= 0) {
    throw new Error('Mapsforge header 不完整');
  }
  if (declaredFileSize > 0 && Math.abs(declaredFileSize - fileSize) > 8) {
    throw new Error('Mapsforge 檔案大小與 header 不一致');
  }
  if ([minLat, minLon, maxLat, maxLon].some((value) => !Number.isFinite(value))) {
    throw new Error('Mapsforge 圖資範圍無法讀取');
  }

  return {
    version,
    mapDate,
    bounds: {
      minLat,
      maxLat,
      minLon,
      maxLon,
      latSpan: Math.max(maxLat - minLat, 0.0001),
      lonSpan: Math.max(maxLon - minLon, 0.0001),
    },
  };
}

function decodeAscii(bytes) {
  return [...bytes].map((byte) => String.fromCharCode(byte)).join('');
}

async function loadSqlJs() {
  if (!state.sqlReady) {
    if (!window.initSqlJs) {
      throw new Error('SQL 讀取器尚未載入，請確認網路後重試');
    }
    state.sqlReady = window.initSqlJs({
      locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`,
    });
  }
  return state.sqlReady;
}

function readMbtilesMetadata(db) {
  const metadata = {};
  const rows = db.exec('SELECT name, value FROM metadata');
  for (const row of rows[0]?.values || []) {
    metadata[String(row[0]).toLowerCase()] = String(row[1] ?? '');
  }
  return metadata;
}

function normalizeTileFormat(format) {
  return String(format || '').toLowerCase().replace('jpeg', 'jpg');
}

function parseMbtilesBounds(value) {
  const parts = String(value || '').split(',').map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [minLon, minLat, maxLon, maxLat] = parts;
  return {
    minLat,
    maxLat,
    minLon,
    maxLon,
    latSpan: Math.max(maxLat - minLat, 0.0001),
    lonSpan: Math.max(maxLon - minLon, 0.0001),
  };
}

function readZoom(metadataValue, db, aggregate) {
  const parsed = Number(metadataValue);
  if (Number.isFinite(parsed)) return parsed;
  const result = db.exec(`SELECT ${aggregate}(zoom_level) FROM tiles`);
  const value = result[0]?.values?.[0]?.[0];
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function readTileCount(db) {
  const result = db.exec('SELECT COUNT(1) FROM tiles');
  const value = result[0]?.values?.[0]?.[0];
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function updateMapPackageSummary() {
  const item = state.mapPackage;
  elements.mapName.textContent = item?.fileName || '尚未匯入';
  const values = item
    ? [item.formatLabel, `${item.minZoom}-${item.maxZoom}`, item.tileCount.toLocaleString('zh-TW')]
    : ['--', '--', '--'];
  [...elements.mapMeta.querySelectorAll('dd')].forEach((node, index) => {
    node.textContent = values[index];
  });
  if (!item) {
    elements.mapStatus.textContent = '請先匯入魯地圖 `.map` 或 `.mbtiles` 圖資，再匯入 GPX 航跡。';
  } else if (item.type === 'mapsforge') {
    elements.mapStatus.textContent = '魯地圖 Mapsforge .map 已匯入；目前先完成圖資辨識，PWA 尚未渲染 Mapsforge 向量圖層。';
  } else if (item.isRaster) {
    elements.mapStatus.textContent = 'Raster MBTiles 已載入，匯入 GPX 後會依航跡範圍載入底圖。';
  } else {
    elements.mapStatus.textContent = 'Vector MBTiles 已載入；PWA 目前先辨識圖資，尚未渲染 PBF 向量圖磚。';
  }
}

async function drawRasterMap(width, height) {
  const mapPackage = state.mapPackage;
  const bounds = getViewBounds();
  if (!mapPackage?.isRaster || !bounds) return;
  const zoom = chooseRasterZoom(mapPackage, bounds, width, height);
  const tileRange = getTileRange(bounds, zoom);
  if (!tileRange) return;

  const tiles = [];
  const statement = mapPackage.db.prepare(
    'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ? LIMIT 1',
  );
  try {
    for (let x = tileRange.minX; x <= tileRange.maxX; x += 1) {
      for (let y = tileRange.minY; y <= tileRange.maxY; y += 1) {
        const row = mapPackage.scheme === 'xyz' ? y : (2 ** zoom - 1 - y);
        const image = await readTileImage(statement, zoom, x, row, mapPackage.format);
        if (image) tiles.push({ x, y, image });
      }
    }
  } finally {
    statement.free();
  }

  for (const tile of tiles) {
    const topLeft = tileToLonLat(tile.x, tile.y, zoom);
    const bottomRight = tileToLonLat(tile.x + 1, tile.y + 1, zoom);
    const start = projectIntoBounds({ lon: topLeft.lon, lat: topLeft.lat }, width, height, bounds);
    const end = projectIntoBounds({ lon: bottomRight.lon, lat: bottomRight.lat }, width, height, bounds);
    ctx.drawImage(tile.image, start.x, start.y, end.x - start.x, end.y - start.y);
  }

  if (state.routePoints.length >= 2 && state.bounds) drawRoute(width, height);
  if (state.lastAcceptedPosition) updateGpsDot(state.lastAcceptedPosition);
}

function chooseRasterZoom(mapPackage, bounds, width, height) {
  let selected = mapPackage.minZoom;
  for (let zoom = mapPackage.maxZoom; zoom >= mapPackage.minZoom; zoom -= 1) {
    const range = getTileRange(bounds, zoom);
    if (!range) continue;
    const tileTotal = (range.maxX - range.minX + 1) * (range.maxY - range.minY + 1);
    if (tileTotal <= 48 || (width > 700 && height > 700 && tileTotal <= 80)) {
      selected = zoom;
      break;
    }
  }
  return selected;
}

function getTileRange(bounds, zoom) {
  const maxIndex = 2 ** zoom - 1;
  const minX = clamp(Math.floor(lonToTileX(bounds.minLon, zoom)), 0, maxIndex);
  const maxX = clamp(Math.floor(lonToTileX(bounds.maxLon, zoom)), 0, maxIndex);
  const minY = clamp(Math.floor(latToTileY(bounds.maxLat, zoom)), 0, maxIndex);
  const maxY = clamp(Math.floor(latToTileY(bounds.minLat, zoom)), 0, maxIndex);
  if ([minX, maxX, minY, maxY].some((value) => !Number.isFinite(value))) return null;
  return { minX, maxX, minY, maxY };
}

async function readTileImage(statement, zoom, x, row, format) {
  const key = `${zoom}/${x}/${row}`;
  if (state.tileImageCache.has(key)) return state.tileImageCache.get(key);
  statement.bind([zoom, x, row]);
  const hasRow = statement.step();
  if (!hasRow) {
    statement.reset();
    return null;
  }
  const tileData = statement.get()[0];
  statement.reset();
  const blob = new Blob([tileData], { type: tileMimeType(format) });
  const image = await blobToImage(blob);
  state.tileImageCache.set(key, image);
  return image;
}

function tileMimeType(format) {
  if (format === 'jpg') return 'image/jpeg';
  if (format === 'webp') return 'image/webp';
  return 'image/png';
}

async function blobToImage(blob) {
  if ('createImageBitmap' in window) return createImageBitmap(blob);
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('圖磚影像無法讀取'));
    };
    image.src = url;
  });
}

function lonToTileX(lon, zoom) {
  return ((lon + 180) / 360) * 2 ** zoom;
}

function latToTileY(lat, zoom) {
  const latRad = degreesToRadians(Math.max(-85.05112878, Math.min(85.05112878, lat)));
  return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * 2 ** zoom;
}

function tileToLonLat(x, y, zoom) {
  const n = 2 ** zoom;
  const lon = (x / n) * 360 - 180;
  const lat = radiansToDegrees(Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))));
  return { lon, lat };
}

function radiansToDegrees(radians) {
  return radians * 180 / Math.PI;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
