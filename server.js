const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.resolve(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// Files that must never be served over HTTP
const BLOCKED_FILES = new Set([
  'server.js',
  'package.json',
  'package-lock.json',
  'push_to_github.bat'
]);

// Base security headers added to all HTTP responses
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=()'
};

const server = http.createServer((req, res) => {
  // Only allow GET and HEAD requests
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
    res.end('Method Not Allowed');
    return;
  }

  // Parse and safely decode request URL
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(req.url.split('?')[0]);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
    res.end('Bad Request');
    return;
  }

  if (decodedPath === '/' || decodedPath === '') {
    decodedPath = '/index.html';
  }

  // Split into segments to detect hidden files or blocked assets
  const segments = decodedPath.split(/[/\\]+/).filter(Boolean);

  // Block any request containing hidden files or directories (.git, .env, .gitignore, etc.)
  const hasHiddenSegment = segments.some(seg => seg.startsWith('.'));
  if (hasHiddenSegment) {
    res.writeHead(403, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
    res.end('Forbidden');
    return;
  }

  // Block sensitive server files and node_modules
  const filename = segments[segments.length - 1];
  if (BLOCKED_FILES.has(filename) || segments.includes('node_modules')) {
    res.writeHead(403, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
    res.end('Forbidden');
    return;
  }

  // Strict path traversal containment check
  const targetRelative = path.join(...segments);
  const resolvedPath = path.resolve(PUBLIC_DIR, targetRelative);

  if (!resolvedPath.startsWith(PUBLIC_DIR + path.sep) && resolvedPath !== PUBLIC_DIR) {
    res.writeHead(403, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
    res.end('Forbidden');
    return;
  }

  fs.stat(resolvedPath, (err, stats) => {
    let filePathToServe = resolvedPath;

    if (err) {
      // Fallback to index.html for client-side routing if requested route doesn't exist
      filePathToServe = path.join(PUBLIC_DIR, 'index.html');
    } else if (stats.isDirectory()) {
      filePathToServe = path.join(resolvedPath, 'index.html');
    }

    serveFile(filePathToServe, res, req.method);
  });
});

function serveFile(filePath, res, method) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
      res.end('404 Not Found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': Buffer.byteLength(content),
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      ...SECURITY_HEADERS
    });

    if (method === 'HEAD') {
      res.end();
    } else {
      res.end(content);
    }
  });
}

server.listen(PORT, () => {
  console.log(`Secure Node server running on port ${PORT}`);
});

