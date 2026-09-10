const http = require('http');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = Number(process.env.PORT || 8080);
const MAX_AUTO_PORT = DEFAULT_PORT + 20;
const ROOT = __dirname;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const relativePath = decodeURIComponent(requestPath).replace(/^\/+/, '');
  const filePath = path.resolve(ROOT, relativePath);

  if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  sendFile(res, filePath);
});

let currentPort = DEFAULT_PORT;

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE' && !process.env.PORT && currentPort < MAX_AUTO_PORT) {
    const usedPort = currentPort;
    currentPort += 1;
    console.log(`Port ${usedPort} is already in use. Trying ${currentPort}...`);
    server.listen(currentPort);
    return;
  }

  console.error(error.message);
  process.exit(1);
});

server.listen(currentPort, () => {
  console.log(`Frontend test server: http://localhost:${currentPort}`);
});
