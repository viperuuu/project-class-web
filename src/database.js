const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const databasePath = path.resolve(process.env.DATABASE_PATH || path.join(ROOT, 'data', 'lautkecil.sqlite'));
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new DatabaseSync(databasePath);
db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

const initialProducts = [
  ['betta-koi', 'Cupang Koi Galaxy', 'Ikan Cupang', 85000, 12, 'FAVORIT', 'Sirip cantik dengan corak koi yang unik.', 'https://images.unsplash.com/photo-1524704654690-b56c05c78a00?auto=format&fit=crop&w=700&q=80'],
  ['guppy-mosaic', 'Guppy Mosaic Blue', 'Ikan Guppy', 45000, 18, 'WARNA CERAH', 'Guppy aktif dengan ekor biru bermotif.', 'https://images.unsplash.com/photo-1535591273668-578e31182c4f?auto=format&fit=crop&w=700&q=80'],
  ['goldfish-ranchu', 'Mas Koki Ranchu', 'Ikan Mas Koki', 125000, 7, 'PILIHAN AQUARIST', 'Ranchu mungil, tenang, dan mudah disukai.', 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=700&q=80'],
  ['tetra-neon', 'Neon Tetra', 'Ikan Hias', 18000, 30, 'RAMAH PEMULA', 'Kilau biru-merah yang indah dalam kawanan.', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=700&q=80'],
  ['betta-copper', 'Cupang Copper', 'Ikan Cupang', 72000, 9, 'STOK TERBATAS', 'Kilau tembaga dengan karakter yang anggun.', 'https://images.unsplash.com/photo-1524704654690-b56c05c78a00?auto=format&fit=crop&w=700&q=80'],
  ['guppy-red', 'Guppy Red Dragon', 'Ikan Guppy', 38000, 14, 'MUDAH DIRAWAT', 'Warna merah menyala, cocok untuk akuarium kecil.', 'https://images.unsplash.com/photo-1535591273668-578e31182c4f?auto=format&fit=crop&w=700&q=80'],
  ['goldfish-oranda', 'Mas Koki Oranda', 'Ikan Mas Koki', 98000, 6, 'KOLEKSI PILIHAN', 'Siluet bulat dengan gerak berenang yang lembut.', 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=700&q=80'],
  ['molly-dalmatian', 'Molly Dalmatian', 'Ikan Hias', 22000, 22, 'TEMAN AKUARIUM', 'Bintik hitam putih yang ceria dan bersahabat.', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=700&q=80']
];
const seedProduct = db.prepare('INSERT OR IGNORE INTO products (id, name, category, price, stock, badge, description, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
db.exec('BEGIN');
try {
  for (const product of initialProducts) seedProduct.run(...product);
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  db.close();
  throw error;
}

const selectProducts = db.prepare('SELECT id, name, category, price, stock, badge, description, image FROM products');
const selectProduct = db.prepare('SELECT id, name, category, price, stock, badge, description, image FROM products WHERE id = ?');

function getProducts() {
  return selectProducts.all();
}

function getProduct(id) {
  return selectProduct.get(id);
}

function createOrder(customer, requestedItems) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const customerRecord = db.prepare(`
      INSERT INTO customers (name, email, address)
      VALUES (?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET name = excluded.name, address = excluded.address
      RETURNING id
    `).get(customer.customerName.trim(), customer.email.trim().toLowerCase(), customer.address.trim());

    const items = [];
    for (const [productId, quantity] of requestedItems) {
      const product = getProduct(productId);
      if (!product) {
        const error = new Error('Salah satu produk tidak ditemukan. Muat ulang katalog.');
        error.statusCode = 400;
        throw error;
      }
      if (product.stock < quantity) {
        const error = new Error(`Stok ${product.name} tidak cukup. Tersedia ${product.stock} ekor.`);
        error.statusCode = 409;
        throw error;
      }
      items.push({ productId, name: product.name, unitPrice: product.price, quantity, subtotal: product.price * quantity });
    }

    const orderId = `LK-${randomUUID().slice(0, 8).toUpperCase()}`;
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    const createdAt = new Date().toISOString();
    db.prepare('INSERT INTO orders (id, customer_id, status, total, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(orderId, customerRecord.id, 'menunggu konfirmasi', total, createdAt);
    const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      const result = updateStock.run(item.quantity, item.productId, item.quantity);
      if (result.changes !== 1) {
        const error = new Error('Stok produk baru saja berubah. Muat ulang katalog dan coba lagi.');
        error.statusCode = 409;
        throw error;
      }
      insertItem.run(orderId, item.productId, item.name, item.quantity, item.unitPrice, item.subtotal);
    }
    db.exec('COMMIT');
    return {
      id: orderId,
      status: 'menunggu konfirmasi',
      customer: { name: customer.customerName.trim(), email: customer.email.trim().toLowerCase(), address: customer.address.trim() },
      items,
      total,
      createdAt
    };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = { getProducts, getProduct, createOrder };

if (require.main === module) {
  console.log(`Database SQLite siap di: ${databasePath}`);
  console.log(`Jumlah produk terdaftar: ${getProducts().length}`);
}
