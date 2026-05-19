const state = {
  routePoints: [],
  waypoints: [],
  bounds: null,
  watchId: null,
  lastAcceptedPosition: null,
  lastAcceptedAt: 0,
  deferredInstallPrompt: null,
};

const elements = {
  canvas: document.querySelector('#mapCanvas'),
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
  if (!state.bounds) return;
  const rect = elements.canvas.getBoundingClientRect();
  const projected = project(point, rect.width, rect.height);
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
  const padding = 28;
  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);
  return {
    x: padding + ((point.lon - state.bounds.minLon) / state.bounds.lonSpan) * usableWidth,
    y: padding + ((state.bounds.maxLat - point.lat) / state.bounds.latSpan) * usableHeight,
  };
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
