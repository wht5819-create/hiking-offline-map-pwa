import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '0.0.0.0';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gpx': 'application/gpx+xml; charset=utf-8',
  '.wasm': 'application/wasm',
};

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const target = path.normalize(path.join(root, pathname));

  if (!target.startsWith(root) || !existsSync(target)) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  const extension = path.extname(target);
  response.setHeader('Content-Type', types[extension] || 'application/octet-stream');
  if (pathname === '/sw.js') {
    response.setHeader('Service-Worker-Allowed', './');
    response.setHeader('Cache-Control', 'no-cache');
  }

  createReadStream(target).pipe(response);
});

server.listen(port, host, async () => {
  const localIp = await getLocalIp();
  console.log(`PWA local: http://localhost:${port}`);
  if (localIp) console.log(`LAN preview: http://${localIp}:${port}`);
});

async function getLocalIp() {
  try {
    const { networkInterfaces } = await import('node:os');
    for (const addresses of Object.values(networkInterfaces())) {
      for (const address of addresses || []) {
        if (address.family === 'IPv4' && !address.internal) return address.address;
      }
    }
  } catch {
    return null;
  }
  return null;
}
