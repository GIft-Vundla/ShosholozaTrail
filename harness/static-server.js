import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'public');
const types = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webmanifest', 'application/manifest+json'],
]);

function publicPath(pathname) {
  const relative = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  const candidate = join(root, relative);
  return candidate.startsWith(root) ? candidate : null;
}

async function isFile(candidate) {
  if (!candidate) return false;
  try {
    return (await stat(candidate)).isFile();
  } catch {
    return false;
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/api/health') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ readiness: 'working-towards-trl5', localHarness: true }));
    return;
  }
  const engineShell = url.pathname === '/app' || url.pathname.startsWith('/app/');
  let file = publicPath(url.pathname === '/' ? '/index.html' : url.pathname);
  try {
    // stat() rejects for paths that do not exist, so probe before falling back
    // to whichever shell owns the route: React at "/", the engine under /app.
    if (!(await isFile(file))) file = join(root, engineShell ? 'app.html' : 'index.html');
    response.writeHead(200, {
      'content-type': types.get(extname(file)) || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

// PORT lets a second agent or a parallel suite bind its own port.
server.listen(Number(process.env.PORT) || 4173, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
