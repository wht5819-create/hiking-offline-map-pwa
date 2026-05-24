const state = {
  routePoints: [],
  routeSegments: [],
  waypoints: [],
  bounds: null,
  watchId: null,
  lastAcceptedPosition: null,
  lastAcceptedAt: 0,
  deferredInstallPrompt: null,
  sqlReady: null,
  mapPackage: null,
  tileImageCache: new Map(),
  onlineTileCache: new Map(),
  layers: {
    route: true,
    waypoints: true,
    highContrast: true,
  },
};

const storedMapPackageKey = 'hiking:pwa:map-package:v1';

const elements = {
  canvas: document.querySelector('#mapCanvas'),
  mapInput: document.querySelector('#mapInput'),
  gpxInput: document.querySelector('#gpxInput'),
  trackCount: document.querySelector('#trackCount'),
  waypointCount: document.querySelector('#waypointCount'),
  waypointList: document.querySelector('#waypointList'),
  routeName: document.querySelector('#routeName'),
  demoButton: document.querySelector('#demoButton'),
  trackingButton: document.querySelector('#trackingButton'),
  clearButton: document.querySelector('#clearButton'),
  routeLayerToggle: document.querySelector('#routeLayerToggle'),
  waypointLayerToggle: document.querySelector('#waypointLayerToggle'),
  contrastLayerToggle: document.querySelector('#contrastLayerToggle'),
  regionList: document.querySelector('#regionList'),
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
  navigator.serviceWorker.register('./sw.js?v=20').then(() => {
    state.offlineReady = true;
    updateDepartureChecklist();
  }).catch(() => {
    state.offlineReady = false;
    updateDepartureChecklist();
  });
}

restoreStoredMapPackage();

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
    saveStoredMapPackage(mapPackage);
    updateMapPackageSummary();
    updateDepartureChecklist();
    drawMap();
    const renderNote = getMapRenderNote(mapPackage);
    setSafetyStatus(`魯地圖已匯入：${renderNote}`, 'ok');
  } catch (error) {
    state.mapPackage = null;
    localStorage.removeItem(storedMapPackageKey);
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
    state.routeSegments = parsed.routeSegments;
    state.waypoints = parsed.waypoints;
    state.bounds = calculateBounds([...parsed.routePoints, ...parsed.waypoints]);
    elements.routeName.textContent = file.name;
    updateRouteSummary();
    updateDepartureChecklist();
    drawMap();
    setSafetyStatus('GPX 已載入，可啟動定位', 'ok');
  } catch (error) {
    setSafetyStatus(`GPX 匯入失敗：${error.message}`, 'danger');
  }
});

elements.demoButton.addEventListener('click', async () => {
  try {
    setSafetyStatus('正在載入範例魯地圖...', '');
    await loadSampleMap();
    setSafetyStatus('正在載入範例路線...', '');
    await loadSampleRoute();
    setSafetyStatus('示範已載入：魯地圖底圖 + GPX 路線', 'ok');
  } catch (error) {
    setSafetyStatus(`示範載入失敗：${error.message}`, 'danger');
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
  state.routeSegments = [];
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

elements.routeLayerToggle.addEventListener('change', () => {
  state.layers.route = elements.routeLayerToggle.checked;
  drawMap();
});

elements.waypointLayerToggle.addEventListener('change', () => {
  state.layers.waypoints = elements.waypointLayerToggle.checked;
  drawMap();
});

elements.contrastLayerToggle.addEventListener('change', () => {
  state.layers.highContrast = elements.contrastLayerToggle.checked;
  drawMap();
});

elements.regionList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-region]');
  if (!button) return;
  const region = button.dataset.region;
  if (region === 'demo') {
    try {
      setSafetyStatus('正在載入示範區...', '');
      await loadSampleMap();
      setSafetyStatus('示範區已載入', 'ok');
    } catch (error) {
      setSafetyStatus(`示範區載入失敗：${error.message}`, 'danger');
    }
    return;
  }
  const regionNames = {
    north: '北部',
    central: '中部',
    south: '南部',
    east: '東部',
    all: '全台',
  };
  setSafetyStatus(`${regionNames[region]}地圖需先下載 MBTiles，再用「匯入圖」載入`, '');
});

window.addEventListener('resize', drawMap);
updateDepartureChecklist();
drawMap();

async function loadSampleMap() {
  elements.mapStatus.textContent = '正在讀取範例 raster MBTiles，第一次載入可能需要幾秒鐘。';
  const response = await fetch('./sample/rudy-route-z12-z16.mbtiles');
  if (!response.ok) throw new Error(`MBTiles HTTP ${response.status}`);
  const blob = await response.blob();
  const file = new File([blob], 'rudy-route-z12-z16.mbtiles', { type: 'application/octet-stream' });
  const mapPackage = await importMapPackage(file);
  state.mapPackage?.db?.close();
  state.tileImageCache.clear();
  state.mapPackage = mapPackage;
  saveStoredMapPackage(mapPackage);
  updateMapPackageSummary();
  updateDepartureChecklist();
  drawMap();
}

async function loadSampleRoute() {
  const response = await fetch('./sample/demo-route.gpx', { cache: 'no-store' });
  if (!response.ok) throw new Error(`GPX HTTP ${response.status}`);
  const xmlText = await response.text();
  const parsed = parseGpx(xmlText);
  state.routePoints = parsed.routePoints;
  state.routeSegments = parsed.routeSegments;
  state.waypoints = parsed.waypoints;
  state.bounds = calculateBounds([...parsed.routePoints, ...parsed.waypoints]);
  state.lastAcceptedPosition = null;
  elements.gpsDot.hidden = true;
  elements.routeName.textContent = '範例路線';
  elements.deviationDistance.textContent = '--';
  updateRouteSummary();
  updateDepartureChecklist();
  drawMap();
}

function parseGpx(xmlText) {
  const documentXml = new DOMParser().parseFromString(xmlText, 'application/xml');
  const parserError = documentXml.querySelector('parsererror');
  if (parserError) {
    throw new Error('XML 格式毀損');
  }

  const routeSegments = [...documentXml.querySelectorAll('trkseg')]
    .map((segment) => [...segment.querySelectorAll('trkpt')].map(readGpxPoint))
    .filter((segment) => segment.length > 0);
  const routePoints = routeSegments.length > 0
    ? routeSegments.flat()
    : [...documentXml.querySelectorAll('trkpt')].map(readGpxPoint);
  const waypoints = [...documentXml.querySelectorAll('wpt')].map((node) => ({
    lat: readNumberAttribute(node, 'lat'),
    lon: readNumberAttribute(node, 'lon'),
    ele: readOptionalNumber(node.querySelector('ele')?.textContent),
    name: node.querySelector('name')?.textContent?.trim() || '未命名航點',
  }));

  if (routePoints.length === 0 && waypoints.length === 0) {
    throw new Error('檔案內沒有 trkpt 或 wpt');
  }

  return { routePoints, routeSegments: routeSegments.length > 0 ? routeSegments : [routePoints], waypoints };
}

function readGpxPoint(node) {
  return {
    lat: readNumberAttribute(node, 'lat'),
    lon: readNumberAttribute(node, 'lon'),
    ele: readOptionalNumber(node.querySelector('ele')?.textContent),
  };
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
  if (!isGpsAllowedHere()) {
    setSafetyStatus('定位需要 HTTPS；手機用區網 http 網址會被瀏覽器擋住', 'danger');
    return;
  }
  if (!navigator.geolocation) {
    setSafetyStatus('此瀏覽器不支援 GPS 定位', 'danger');
    return;
  }

  state.watchId = navigator.geolocation.watchPosition(
    handlePosition,
    (error) => setSafetyStatus(`定位失敗：${formatGeolocationError(error)}`, 'danger'),
    {
      enableHighAccuracy: true,
      maximumAge: 8000,
      timeout: 15000,
    },
  );
  elements.trackingButton.textContent = '停止定位';
  setSafetyStatus(state.routePoints.length >= 2 ? '定位啟動中，偏離警報待命' : '定位啟動中，尚未載入 GPX', 'ok');
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
  if (state.routePoints.length < 2) {
    state.bounds = boundsAroundPoint(current);
    elements.deviationDistance.textContent = '--';
    updateGpsDot(current);
    updateDepartureChecklist();
    drawMap();
    setSafetyStatus('已取得目前位置；匯入 GPX 後可啟用偏離警報', 'ok');
    return;
  }

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

function isGpsAllowedHere() {
  return window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function formatGeolocationError(error) {
  if (error.code === error.PERMISSION_DENIED) return '定位權限被拒絕，請到瀏覽器網站設定允許位置';
  if (error.code === error.POSITION_UNAVAILABLE) return '目前位置不可用，請確認手機 GPS 已開啟';
  if (error.code === error.TIMEOUT) return '定位逾時，請到戶外或窗邊再試一次';
  return error.message || '未知錯誤';
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
  drawOnlineTopoMap(width, height);
  if (state.mapPackage?.isRaster) {
    drawRasterMap(width, height);
  }

  if (state.layers.route && state.routePoints.length >= 2 && state.bounds) {
    drawRoute(width, height);
  }
  if (state.lastAcceptedPosition) {
    updateGpsDot(state.lastAcceptedPosition);
  }
}

function drawTerrain(width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#b7c979';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.fillStyle = '#86aa56';
  for (let i = 0; i < 7; i += 1) {
    ctx.beginPath();
    const cx = (width / 6) * i + ((i % 2) * 45);
    const cy = height * (0.16 + (i % 5) * 0.17);
    ctx.ellipse(cx, cy, width * 0.18, height * 0.13, i * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(63, 86, 59, 0.28)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 34; i += 1) {
    ctx.beginPath();
    const y = (height / 32) * i + 4;
    for (let x = -20; x <= width + 20; x += 20) {
      const wave = Math.sin((x + i * 31) / 62) * 11 + Math.cos((x + i * 17) / 96) * 6;
      if (x === -20) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.strokeStyle = i % 5 === 0 ? 'rgba(52, 73, 51, 0.42)' : 'rgba(52, 73, 51, 0.20)';
    ctx.lineWidth = i % 5 === 0 ? 1.8 : 0.8;
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(46, 146, 184, 0.74)';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(width * 0.72, -20);
  ctx.bezierCurveTo(width * 0.66, height * 0.2, width * 0.78, height * 0.38, width * 0.7, height * 0.58);
  ctx.bezierCurveTo(width * 0.62, height * 0.76, width * 0.78, height * 0.88, width * 0.74, height + 20);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-10, height * 0.55);
  ctx.bezierCurveTo(width * 0.18, height * 0.47, width * 0.33, height * 0.64, width * 0.52, height * 0.47);
  ctx.bezierCurveTo(width * 0.67, height * 0.34, width * 0.82, height * 0.46, width + 20, height * 0.32);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(132, 77, 45, 0.7)';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.moveTo(width * 0.1, height * 0.78);
  ctx.bezierCurveTo(width * 0.24, height * 0.68, width * 0.35, height * 0.82, width * 0.5, height * 0.7);
  ctx.bezierCurveTo(width * 0.6, height * 0.62, width * 0.72, height * 0.72, width * 0.92, height * 0.58);
  ctx.stroke();
  ctx.restore();
}

function drawMapsforgePlaceholder(width, height) {
  const mapPackage = state.mapPackage;
  if (!mapPackage?.bounds) return;

  ctx.save();
  ctx.fillStyle = 'rgba(47, 111, 79, 0.06)';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(47, 111, 79, 0.28)';
  ctx.lineWidth = 1;
  for (let x = 28; x < width; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 28; y < height; y += 54) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(31, 86, 61, 0.72)';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, Math.max(1, width - 36), Math.max(1, height - 36));
  ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
  ctx.fillRect(28, 28, Math.min(280, width - 56), 46);
  ctx.fillStyle = '#1f563d';
  ctx.font = '700 14px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('魯地圖範圍已載入', 42, 56);
  ctx.restore();
}

async function drawOnlineTopoMap(width, height) {
  const bounds = getViewBounds();
  if (!bounds) return;
  const zoom = chooseOnlineZoom(bounds, width, height);
  const tileRange = getTileRange(bounds, zoom);
  if (!tileRange) return;

  const tiles = [];
  for (let x = tileRange.minX; x <= tileRange.maxX; x += 1) {
    for (let y = tileRange.minY; y <= tileRange.maxY; y += 1) {
      const image = await readOnlineTileImage(zoom, x, y);
      if (image) tiles.push({ x, y, image });
    }
  }

  for (const tile of tiles) {
    const topLeft = tileToLonLat(tile.x, tile.y, zoom);
    const bottomRight = tileToLonLat(tile.x + 1, tile.y + 1, zoom);
    const start = projectIntoBounds({ lon: topLeft.lon, lat: topLeft.lat }, width, height, bounds);
    const end = projectIntoBounds({ lon: bottomRight.lon, lat: bottomRight.lat }, width, height, bounds);
    ctx.drawImage(tile.image, start.x, start.y, end.x - start.x, end.y - start.y);
  }

  if (state.layers.route && state.routePoints.length >= 2 && state.bounds) drawRoute(width, height);
  if (state.lastAcceptedPosition) updateGpsDot(state.lastAcceptedPosition);
}

function chooseOnlineZoom(bounds, width, height) {
  let selected = 8;
  const maxZoom = state.routePoints.length >= 2 ? 16 : 10;
  for (let zoom = maxZoom; zoom >= 6; zoom -= 1) {
    const range = getTileRange(bounds, zoom);
    if (!range) continue;
    const tileTotal = (range.maxX - range.minX + 1) * (range.maxY - range.minY + 1);
    if (tileTotal <= 42 || (width > 700 && height > 700 && tileTotal <= 70)) {
      selected = zoom;
      break;
    }
  }
  return selected;
}

async function readOnlineTileImage(zoom, x, y) {
  const key = `opentopo/${zoom}/${x}/${y}`;
  if (state.onlineTileCache.has(key)) return state.onlineTileCache.get(key);
  const subdomain = ['a', 'b', 'c'][(x + y) % 3];
  const url = `https://${subdomain}.tile.opentopomap.org/${zoom}/${x}/${y}.png`;
  try {
    const image = await loadImage(url);
    state.onlineTileCache.set(key, image);
    return image;
  } catch {
    return null;
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function drawRoute(width, height) {
  const screenPoints = buildRouteScreenPoints(width, height, state.routePoints);
  if (screenPoints.length < 2) return;
  drawRouteStroke(screenPoints, 'rgba(255, 255, 255, 0.94)', 11);
  for (const [index, segment] of state.routeSegments.entries()) {
    const segmentPoints = buildRouteScreenPoints(width, height, segment);
    const color = index % 2 === 0 ? '#166bc8' : '#2b84df';
    drawRouteStroke(segmentPoints, color, 5.5);
  }
  if (state.layers.waypoints) drawWaypointPins(width, height);
  drawRouteEndpoints(screenPoints);
}

function buildRouteScreenPoints(width, height, routePoints) {
  const minGap = 5;
  const points = [];
  for (const point of routePoints) {
    const projected = project(point, width, height);
    const previous = points[points.length - 1];
    if (!previous || Math.hypot(projected.x - previous.x, projected.y - previous.y) >= minGap) {
      points.push({ ...point, ...projected });
    }
  }
  const lastRoutePoint = routePoints[routePoints.length - 1];
  const last = { ...lastRoutePoint, ...project(lastRoutePoint, width, height) };
  const previous = points[points.length - 1];
  if (!previous || previous.x !== last.x || previous.y !== last.y) points.push(last);
  return points;
}

function drawRouteStroke(points, color, lineWidth) {
  if (points.length < 2) return;
  ctx.beginPath();
  for (const [index, point] of points.entries()) {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawDirectionArrows(points) {
  const targetCount = Math.min(8, Math.max(2, Math.floor(points.length / 18)));
  const step = Math.max(10, Math.floor(points.length / (targetCount + 1)));
  for (let index = step; index < points.length - 1; index += step) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const angle = Math.atan2(next.y - previous.y, next.x - previous.x);
    drawArrow(current, angle);
  }
}

function drawArrow(point, angle) {
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fillStyle = '#1f563d';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}

function drawRouteCallouts(width, height) {
  if (state.routePoints.length < 2) return;
  const samples = buildRouteCalloutSamples(state.routePoints);
  for (const sample of samples) {
    const point = project(sample, width, height);
    const kmLabel = sample.distanceMeters >= 1000
      ? `${(sample.distanceMeters / 1000).toFixed(1)} km`
      : `${Math.round(sample.distanceMeters)} m`;
    const eleLabel = Number.isFinite(sample.ele) ? `H ${Math.round(sample.ele)}m` : '';
    drawPinLabel(point, '#e53935', kmLabel, eleLabel);
  }
}

function buildRouteCalloutSamples(points) {
  const totalMeters = calculateRouteLengthMeters(points);
  if (!Number.isFinite(totalMeters) || totalMeters <= 0) return [];
  const targets = [];
  const interval = totalMeters > 8000 ? 2000 : totalMeters > 3000 ? 1000 : Math.max(500, totalMeters / 4);
  for (let distance = interval; distance < totalMeters; distance += interval) targets.push(distance);
  if (targets.length === 0) targets.push(totalMeters / 2);

  const samples = [];
  let travelled = 0;
  let nextTargetIndex = 0;
  for (let index = 1; index < points.length && nextTargetIndex < targets.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const segmentDistance = haversineMeters(previous, current);
    while (nextTargetIndex < targets.length && travelled + segmentDistance >= targets[nextTargetIndex]) {
      const ratio = segmentDistance === 0 ? 0 : (targets[nextTargetIndex] - travelled) / segmentDistance;
      samples.push({
        lat: previous.lat + (current.lat - previous.lat) * ratio,
        lon: previous.lon + (current.lon - previous.lon) * ratio,
        ele: Number.isFinite(current.ele) ? current.ele : previous.ele,
        distanceMeters: targets[nextTargetIndex],
      });
      nextTargetIndex += 1;
    }
    travelled += segmentDistance;
  }
  return samples.slice(0, 10);
}

function drawWaypointPins(width, height) {
  for (const waypoint of state.waypoints.slice(0, 30)) {
    const point = project(waypoint, width, height);
    drawSmallMapPoint(point, '#2f66c5');
  }
}

function drawSmallMapPoint(point, color) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(point.x, point.y, 6.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(point.x, point.y + 7);
  ctx.lineTo(point.x - 5, point.y + 17);
  ctx.lineTo(point.x + 5, point.y + 17);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawPinLabel(point, color, title, subtitle = '') {
  ctx.save();
  ctx.font = '700 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const titleWidth = ctx.measureText(title).width;
  ctx.font = '600 10px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const subtitleWidth = subtitle ? ctx.measureText(subtitle).width : 0;
  const labelWidth = Math.min(138, Math.max(42, titleWidth, subtitleWidth) + 14);
  const labelHeight = subtitle ? 32 : 22;
  const x = clamp(point.x - labelWidth / 2, 6, Math.max(6, elements.canvas.getBoundingClientRect().width - labelWidth - 6));
  const y = Math.max(6, point.y - labelHeight - 18);

  ctx.beginPath();
  ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(point.x, point.y + 6);
  ctx.lineTo(point.x - 5, point.y + 16);
  ctx.lineTo(point.x + 5, point.y + 16);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.lineWidth = 3;
  roundedRectPath(x, y, labelWidth, labelHeight, 6);
  ctx.stroke();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(fitLabel(title, 12), x + labelWidth / 2, y + (subtitle ? 10 : 11));
  if (subtitle) {
    ctx.font = '600 9px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(subtitle, x + labelWidth / 2, y + 23);
  }
  ctx.restore();
}

function fitLabel(text, maxLength) {
  const value = String(text || '');
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function roundedRectPath(x, y, width, height, radius) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function calculateRouteLengthMeters(points) {
  let total = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    total += haversineMeters(points[index], points[index + 1]);
  }
  return total;
}

function drawRouteEndpoints(points) {
  const start = points[0];
  const end = points[points.length - 1];
  drawRouteMarker(start, '#2f6f4f', '');
  drawRouteMarker(end, '#f33d3d', '');
}

function drawRouteMarker(point, color, label) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(point.x, point.y, 8.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  if (label) {
    ctx.fillStyle = '#fff';
    ctx.font = '700 10px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, point.x, point.y + 0.5);
  }
  ctx.restore();
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

function boundsAroundPoint(point) {
  const span = 0.01;
  return {
    minLat: point.lat - span / 2,
    maxLat: point.lat + span / 2,
    minLon: point.lon - span / 2,
    maxLon: point.lon + span / 2,
    latSpan: span,
    lonSpan: span,
  };
}

function project(point, width, height) {
  const bounds = getViewBounds();
  if (!bounds) return { x: width / 2, y: height / 2 };
  return projectIntoBounds(point, width, height, bounds);
}

function projectIntoBounds(point, width, height, bounds) {
  const padding = 12;
  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);
  return {
    x: padding + ((point.lon - bounds.minLon) / bounds.lonSpan) * usableWidth,
    y: padding + ((bounds.maxLat - point.lat) / bounds.latSpan) * usableHeight,
  };
}

function getViewBounds() {
  if (state.routePoints.length >= 2 && state.lastAcceptedPosition) {
    return calculateBounds([...state.routePoints, ...state.waypoints, state.lastAcceptedPosition]);
  }
  if (state.lastAcceptedPosition && state.routePoints.length < 2) return boundsAroundPoint(state.lastAcceptedPosition);
  return state.bounds || state.mapPackage?.bounds || null;
}

function saveStoredMapPackage(mapPackage) {
  if (mapPackage.type === 'mbtiles' && mapPackage.isRaster) return;
  const stored = {
    type: mapPackage.type,
    fileName: mapPackage.fileName,
    format: mapPackage.format,
    formatLabel: mapPackage.formatLabel,
    minZoom: mapPackage.minZoom,
    maxZoom: mapPackage.maxZoom,
    tileCount: mapPackage.tileCount,
    bounds: mapPackage.bounds,
  };
  localStorage.setItem(storedMapPackageKey, JSON.stringify(stored));
}

function restoreStoredMapPackage() {
  try {
    const stored = JSON.parse(localStorage.getItem(storedMapPackageKey) || 'null');
    if (!stored?.bounds) return;
    state.mapPackage = {
      ...stored,
      db: null,
      metadata: {},
      isRaster: false,
      scheme: stored.type || 'stored',
      restored: true,
    };
    updateMapPackageSummary();
    updateDepartureChecklist();
    setSafetyStatus('已載入上次匯入的魯地圖設定', 'ok');
  } catch {
    localStorage.removeItem(storedMapPackageKey);
  }
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
  const secureReady = isGpsAllowedHere();
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
      ready: Boolean(state.mapPackage) || navigator.onLine,
      text: state.mapPackage ? state.mapPackage.formatLabel : navigator.onLine ? '線上地形' : '未匯入',
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
  const lowerName = (file.name || '').toLowerCase();
  if (lowerName.endsWith('.map')) {
    return importMapsforgeMap(file);
  }
  if (lowerName.endsWith('.mbtiles')) {
    return importMbtiles(file);
  }

  const signature = decodeAscii(new Uint8Array(await file.slice(0, 32).arrayBuffer()));
  if (signature.startsWith('SQLite format 3')) {
    return importMbtiles(file);
  }
  if (signature.startsWith('mapsforge binary OSM')) {
    return importMapsforgeMap(file);
  }

  throw new Error('請選擇魯地圖 .map 或 .mbtiles 圖資；若手機改掉副檔名，請重新命名成 rudy-test.mbtiles');
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
    elements.mapStatus.textContent = '可直接匯入 GPX 使用線上地形底圖；需要離線底圖時再匯入 `.mbtiles`。';
  } else if (item.type === 'mapsforge') {
    elements.mapStatus.textContent = '魯地圖 `.map` 目前只讀取範圍，PWA 尚不能完整渲染 Mapsforge 圖層；若要完整區域底圖，請改匯入 raster `.mbtiles`。';
  } else if (item.isRaster) {
    elements.mapStatus.textContent = 'Raster MBTiles 已載入，會依目前位置或 GPX 範圍顯示可用圖磚。';
  } else {
    elements.mapStatus.textContent = 'Vector MBTiles 已載入；PWA 目前先辨識圖資，尚未渲染 PBF 向量圖磚。';
  }
}

function getMapRenderNote(mapPackage) {
  if (mapPackage.type === 'mapsforge') {
    return '已讀取範圍，完整 `.map` 圖層尚未渲染';
  }
  if (mapPackage.isRaster) return '可作為地圖底圖';
  return '已匯入，vector PBF 尚未在 PWA 渲染';
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
    if (state.layers.highContrast) ctx.filter = 'contrast(1.08) saturate(1.08)';
    ctx.drawImage(tile.image, start.x, start.y, end.x - start.x, end.y - start.y);
    ctx.filter = 'none';
  }

  if (state.layers.route && state.routePoints.length >= 2 && state.bounds) drawRoute(width, height);
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
