import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
]);
export function createApp() {
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    res.setHeader('Cache-Control', 'no-store');
    try {
      const file = files.get(new URL(req.url, 'http://127.0.0.1').pathname);
      if (req.method === 'GET' && file) {
        const content = await readFile(new URL(file[0], import.meta.url));
        res.writeHead(200, { 'Content-Type': file[1] });
        return res.end(content);
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('페이지를 찾을 수 없어요.');
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('페이지를 불러오지 못했어요.');
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 8001);
  createApp().listen(port, '127.0.0.1', () => console.log(`한입습관: http://127.0.0.1:${port}`));
}
