const baseUrl = `http://127.0.0.1:${process.env.PORT || 4173}`;
const regionMapFiles = [
  ['maps/rudy-north.mbtiles', 90_000_000],
  ['maps/rudy-central.mbtiles', 130_000_000],
  ['maps/rudy-south.mbtiles', 140_000_000],
  ['maps/rudy-east.mbtiles', 120_000_000],
  ['maps/rudy-taiwan.mbtiles', 500_000_000],
];
const checks = [
  {
    path: '/',
    label: '首頁',
    expectText: ['登山離線地圖', '地圖分區', '匯入 GPX'],
  },
  {
    path: '/sample/demo-route.gpx',
    label: '範例 GPX',
    expectText: ['登山口', '稜線休息點', '山頂'],
  },
  {
    path: '/sw.js',
    label: 'Service Worker',
    expectText: ['hiking-pwa-v38', './sample/demo-route.gpx', './sample/rudy-route-z12-z16.mbtiles'],
  },
  {
    path: '/sample/rudy-route-z12-z16.mbtiles',
    label: '範例魯地圖 MBTiles',
    minBytes: 1_000_000,
  },
];

await import('./server.js');
await wait(800);

const results = [];
const { stat } = await import('node:fs/promises');

for (const [path, minBytes] of regionMapFiles) {
  const info = await stat(new URL(path, import.meta.url));
  if (info.size < minBytes) {
    throw new Error(`${path} 檔案過小：${info.size} bytes`);
  }
  results.push({
    label: path,
    status: 'file',
    bytes: info.size,
  });
}

for (const check of checks) {
  const response = await fetch(`${baseUrl}${check.path}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const text = check.expectText ? new TextDecoder('utf-8').decode(bytes) : '';
  const missing = (check.expectText || []).filter((value) => !text.includes(value));

  if (!response.ok) {
    throw new Error(`${check.label} 回應 ${response.status}`);
  }
  if (missing.length > 0) {
    throw new Error(`${check.label} 缺少關鍵字：${missing.join(', ')}`);
  }
  if (check.minBytes && bytes.byteLength < check.minBytes) {
    throw new Error(`${check.label} 檔案過小：${bytes.byteLength} bytes`);
  }

  results.push({
    label: check.label,
    status: response.status,
    bytes: bytes.byteLength,
  });
}

console.table(results);
process.exit(0);

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
