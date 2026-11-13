const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const database = require('./src/database');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.sql': 'text/plain; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon' };

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''; let size = 0;
    req.on('data', (chunk) => { size += chunk.length; if (size > 20_000) { reject(new Error('Permintaan terlalu besar.')); req.destroy(); } else body += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Format JSON tidak valid.')); } });
    req.on('error', reject);
  });
}
async function handleApi(req, res, url) {
  if (req.method === 'GET' && (url.pathname === '/api' || url.pathname === '/api/')) {
    return sendJson(res, 200, { name: 'LautKecil API', version: '1.0.0', endpoints: { products: 'GET /api/products?search=&category=&sort=price-asc', product: 'GET /api/products/:id', orders: 'POST /api/orders' } });
  }
  if (req.method === 'GET' && url.pathname === '/api/products') {
    let result = database.getProducts(); const search = (url.searchParams.get('search') || '').trim().toLocaleLowerCase('id');
    const category = url.searchParams.get('category'); const sort = url.searchParams.get('sort');
    if (search) result = result.filter((p) => `${p.name} ${p.category} ${p.description}`.toLocaleLowerCase('id').includes(search));
    if (category) result = result.filter((p) => p.category.toLocaleLowerCase('id') === category.toLocaleLowerCase('id'));
    if (sort === 'price-asc') result.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') result.sort((a, b) => b.price - a.price);
    return sendJson(res, 200, { products: result, count: result.length });
  }
  const productMatch = url.pathname.match(/^\/api\/products\/([a-z0-9-]+)$/);
  if (req.method === 'GET' && productMatch) {
    const product = database.getProduct(productMatch[1]);
    return product ? sendJson(res, 200, { product }) : sendJson(res, 404, { error: 'Produk tidak ditemukan.' });
  }
  if (req.method === 'POST' && url.pathname === '/api/orders') {
    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      error.statusCode = 400;
      throw error;
    }
    const { customer, items } = body;
    if (!customer || typeof customer.customerName !== 'string' || customer.customerName.trim().length < 2 || typeof customer.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim()) || typeof customer.address !== 'string' || customer.address.trim().length < 8) {
      return sendJson(res, 400, { error: 'Nama, email, dan alamat pengiriman perlu diisi dengan benar.' });
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > 30) return sendJson(res, 400, { error: 'Keranjang kosong atau jumlah item tidak valid.' });
    const combined = new Map();
    for (const item of items) {
      if (!item || typeof item.productId !== 'string' || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 50) return sendJson(res, 400, { error: 'Jumlah produk tidak valid.' });
      combined.set(item.productId, (combined.get(item.productId) || 0) + item.quantity);
    }
    const order = database.createOrder(customer, combined);
    return sendJson(res, 201, { message: 'Pesanan berhasil dibuat.', order });
  }
  return sendJson(res, 404, { error: 'Endpoint API tidak ditemukan.' });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    return handleApi(req, res, url).catch((error) => {
      const statusCode = error.statusCode || 500;
      if (statusCode >= 500) console.error(`Gagal memproses ${req.method} ${url.pathname}:`, error);
      if (!res.destroyed && !res.headersSent) sendJson(res, statusCode, { error: statusCode >= 500 ? 'Terjadi kendala pada server. Coba lagi sebentar.' : error.message });
    });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Metode tidak didukung.' });
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end('Bad request'); }

  if (pathname === '/schema.sql') {
    const schemaFile = path.join(ROOT, 'src', 'schema.sql');
    fs.readFile(schemaFile, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
      res.end(data);
    });
    return;
  }

  if (pathname === '/') pathname = '/index.html';
  const file = path.resolve(PUBLIC_DIR, `.${pathname}`);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': path.extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, () => console.log(`LautKecil berjalan di http://localhost:${PORT}`));
