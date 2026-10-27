import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const root = fileURLToPath(new URL('../dist', import.meta.url));
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.webp':'image/webp', '.svg':'image/svg+xml', '.xml':'application/xml; charset=utf-8', '.txt':'text/plain; charset=utf-8' };

export function headersForPath(pathname) {
  const headers = {};
  for (const rule of config.headers) {
    const match = rule.source === '/(.*)' || (rule.source.endsWith('/:path*') ? pathname.startsWith(rule.source.slice(0, -7)) : pathname === rule.source);
    if (match) for (const header of rule.headers) headers[header.key] = header.value;
  }
  return headers;
}

export async function resolveStaticPath(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return {status:400}; }
  if (decoded.includes('\0') || decoded.includes('\\')) return {status:400};
  const base = resolve(root, `.${decoded}`);
  if (base !== root && !base.startsWith(root + sep)) return {status:400};
  const candidates = extname(base) ? [base] : [base, `${base}.html`, resolve(base,'index.html')];
  for (const file of candidates) {
    try { if ((await stat(file)).isFile()) return {status:200,file}; } catch { /* Try clean URL / directory index. */ }
  }
  return {status:404,file:resolve(root,'404.html')};
}

// Local static acceptance harness, not a Vercel emulator. .html aliases return
// exact bodies here; Vercel cleanUrls may canonicalize them with a same-host redirect.
export function createPreviewServer() {
  return createServer(async (request,response) => {
    try {
      const {pathname} = new URL(request.url,'http://localhost');
      const resolved = await resolveStaticPath(pathname);
      if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405,{'Allow':'GET, HEAD'}); return response.end(); }
      response.writeHead(resolved.status,{...headersForPath(pathname),'Content-Type':mime[extname(resolved.file || '')] || 'text/plain; charset=utf-8'});
      response.end(request.method === 'HEAD' ? undefined : resolved.file ? await readFile(resolved.file) : 'Bad request');
    } catch { response.writeHead(500); response.end('Local preview error'); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.argv[2] || 4173);
  createPreviewServer().listen(port,'127.0.0.1',() => console.log(`Local marketing preview: http://127.0.0.1:${port}/app/ko`));
}
