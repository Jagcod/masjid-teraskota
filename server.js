const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    let reqPath = decodeURI(req.url.split('?')[0]);

    // Handle root and admin routes
    if (reqPath === '/' || reqPath === '') {
        reqPath = '/index.html';
    } else if (reqPath === '/admin' || reqPath === '/admin/') {
        reqPath = '/admin/index.html';
    }

    let filePath = path.join(PUBLIC_DIR, reqPath);

    // Check if directory, if so look for index.html
    fs.stat(filePath, (err, stats) => {
        if (!err && stats.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
        }

        fs.readFile(filePath, (readErr, content) => {
            if (readErr) {
                if (readErr.code === 'ENOENT') {
                    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end('404 Not Found');
                } else {
                    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end('500 Server Error: ' + readErr.code);
                }
            } else {
                const ext = path.extname(filePath).toLowerCase();
                const contentType = MIME_TYPES[ext] || 'application/octet-stream';
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            }
        });
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Masjid Teraskota] Server aktif dan berjalan di:`);
    console.log(`- Display TV : http://localhost:${PORT}/`);
    console.log(`- Panel Admin: http://localhost:${PORT}/admin/`);
});

