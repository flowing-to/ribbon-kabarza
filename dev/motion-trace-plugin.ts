import type { Plugin } from 'vite';
import { appendFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Local development capture only; never included in production output. */
export function motionTracePlugin(): Plugin {
  let pending = Promise.resolve();
  return {
    name: 'ribbon-motion-trace',
    apply: 'serve',
    configureServer(server) {
      const directory = path.join(server.config.root, 'motion-traces');
      server.middlewares.use('/__ribbon-trace', async (request, response) => {
        const url = new URL(request.url ?? '/', 'http://localhost');
        const session = url.searchParams.get('session');
        const video = url.searchParams.has('video');
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('Cache-Control', 'no-store');
        if (session && !/^[a-zA-Z0-9_-]{1,100}$/.test(session)) {
          response.statusCode = 400; response.end('{"error":"Invalid session"}'); return;
        }
        try {
          await mkdir(directory, { recursive: true });
          if (request.method === 'GET') {
            await pending;
            if (session) {
              if (video) {
                response.setHeader('Content-Type', 'video/webm');
                response.end(await readFile(path.join(directory, `${session}.webm`)));
                return;
              }
              const text = await readFile(path.join(directory, `${session}.ndjson`), 'utf8');
              response.end(JSON.stringify(text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))));
            } else {
              const files = (await readdir(directory)).filter(file => file.endsWith('.ndjson'));
              response.end(JSON.stringify(await Promise.all(files.map(async file => ({ session: file.slice(0, -7), bytes: (await stat(path.join(directory, file))).size })))));
            }
            return;
          }
          if (request.method !== 'POST' || !session) { response.statusCode = 405; response.end('{}'); return; }
          if (video) {
            const chunks: Buffer[] = [];
            let size = 0;
            for await (const chunk of request) {
              size += chunk.length;
              if (size > 80_000_000) { response.statusCode = 413; response.end('{}'); return; }
              chunks.push(Buffer.from(chunk));
            }
            await writeFile(path.join(directory, `${session}.webm`), Buffer.concat(chunks));
            response.end(JSON.stringify({ bytes: size }));
            return;
          }
          let body = '';
          for await (const chunk of request) {
            body += chunk;
            if (body.length > 4_000_000) { response.statusCode = 413; response.end('{}'); return; }
          }
          const rows: unknown = JSON.parse(body);
          if (!Array.isArray(rows) || rows.length > 1000 || rows.some(row => !row || typeof row !== 'object')) {
            response.statusCode = 400; response.end('{}'); return;
          }
          const content = rows.map(row => JSON.stringify(row)).join('\n') + '\n';
          const write = pending.then(() => appendFile(path.join(directory, `${session}.ndjson`), content));
          pending = write.catch(() => {});
          await write;
          response.end(JSON.stringify({ saved: rows.length }));
        } catch {
          response.statusCode = 500;
          response.end('{"error":"Could not read or save trace"}');
        }
      });
    },
  };
}
