import { createServer, type IncomingMessage } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createSession } from './session.ts';

const port = Number(process.env.LAB_PORT ?? 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('LAB_PORT debe estar entre 1024 y 65535.');
const session = createSession();
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
]);

async function body(request: IncomingMessage): Promise<unknown> {
  if (request.headers['content-type'] !== 'application/json') throw new Error('Se esperaba un comando JSON.');
  if (request.headers['sec-fetch-site'] === 'cross-site') throw new Error('El comando debe originarse en el laboratorio local.');
  const parts: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 1_048_576) throw new Error('El archivo supera 1 MiB.');
    parts.push(chunk);
  }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}

createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'");
  const json = (data: unknown, status = 200) => {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(data, (_key, value: unknown) => typeof value === 'bigint' ? value.toString() : value));
  };
  try {
    const route = request.url ?? '';
    const host = request.headers.host;
    if (host !== 'localhost:' + port && host !== '127.0.0.1:' + port) return json({ error: 'Servidor local.' }, 403);
    if (request.method === 'GET') {
      if (route === '/api/state') return json(session.view());
      if (route === '/api/save') return json(session.save());
      const asset = assets.get(route);
      if (asset) {
        const [file, type] = asset;
        const content = await readFile(new URL('web/' + file, import.meta.url));
        response.writeHead(200, { 'Content-Type': type });
        return response.end(content);
      }
    }
    if (request.method === 'POST' && route === '/api/command') {
      const origin = request.headers.origin;
      if (origin && origin !== 'http://' + host) return json({ error: 'Origen inválido.' }, 403);
      return json(session.dispatch(await body(request)));
    }
    return json({ error: 'Ruta no disponible.' }, 404);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Error del laboratorio.' }, 400);
  }
}).listen(port, '127.0.0.1', () => console.log('Laboratorio ecológico en http://127.0.0.1:' + port));
