# 🐠 LautKecil — E-Commerce Ikan Hias & REST API

Website toko online ikan hias modern dengan antarmuka profesional, sistem keranjang belanja interaktif, validasi pesanan, backend **RESTful API**, dan basis data relasional **SQLite** (`node:sqlite`). Dibangun murni tanpa *framework heavy* eksternal untuk performa instan dan arsitektur yang bersih.

---

## 🌟 Fitur Utama

- **Katalog Produk Dinamis**: Menampilkan ikan hias lengkap dengan foto, lencana, kategori, deskripsi, harga, dan indikator stok *real-time*.
- **Pencarian & Filter Interaktif**: Cari ikan berdasarkan nama atau deskripsi, filter kategori (Cupang, Guppy, Mas koki, Ikan hias), dan urutkan harga terendah/tertinggi.
- **Keranjang Belanja & Checkout (Drawer & Modal)**: Tambah item, ubah kuantitas, hitung subtotal otomatis, dan formulir data pengiriman.
- **Transaksi Atomik (ACID)**: Stok produk berkurang secara aman saat pesanan berhasil dibuat via transaksi database.
- **Keunggulan, Panduan Aklimatisasi, & Testimoni**: Halaman beranda dirancang sesuai standar e-commerce profesional.
- **Dokumentasi Teknis & API Interaktif**: Tersedia modal dokumentasi arsitektur sistem dan REST API langsung dari antarmuka web.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5 Semantik, CSS3 Modern (CSS Grid, Flexbox, Variable), Vanilla JavaScript ES6+.
- **Backend**: Node.js murni (`node:http`, tanpa Express atau library berat).
- **Database**: SQLite terintegrasi melalui modul bawaan `node:sqlite` (`DatabaseSync`).
- **Prasyarat**: Node.js **>= 22.13.0** (direkomendasikan Node.js 22 LTS atau lebih baru).

---

## 🚀 Cara Menjalankan

### 1. Jalankan Aplikasi Web & Database
Cukup jalankan satu perintah berikut di terminal:

```sh
npm start
```
*atau:*
```sh
node server.js
```

Buka browser Anda di:
👉 **`http://localhost:3000`**

> *Catatan:* Saat pertama kali dijalankan, server akan **secara otomatis** membuat file database `data/lautkecil.sqlite`, mengeksekusi tabel dari `schema.sql`, dan mengisikan data awal produk.

### 2. Inisialisasi Database Saja (Opsional)
Jika ingin menginisialisasi atau mengecek kesiapan database secara mandiri tanpa menjalankan server web:

```sh
npm run db:init
```

---

## 📡 Dokumentasi REST API

Semua respons API menggunakan standar format JSON:

### 1. Ringkasan Endpoint
- **URL**: `GET /api`
- **Respons**: Metadata API dan daftar endpoint yang tersedia.

### 2. Ambil Katalog Produk
- **URL**: `GET /api/products`
- **Query Parameter Opsional**:
  - `search` (contoh: `?search=cupang`)
  - `category` (contoh: `?category=Ikan+Cupang`)
  - `sort` (`price-asc` atau `price-desc`)
- **Contoh Respons**:
```json
{
  "products": [
    {
      "id": "betta-koi",
      "name": "Cupang Koi Galaxy",
      "category": "Ikan Cupang",
      "price": 85000,
      "stock": 12,
      "badge": "FAVORIT",
      "description": "Sirip cantik dengan corak koi yang unik.",
      "image": "https://..."
    }
  ],
  "count": 1
}
```

### 3. Ambil Detail Satu Produk
- **URL**: `GET /api/products/:id` (contoh: `/api/products/betta-koi`)

### 4. Buat Pesanan Baru
- **URL**: `POST /api/orders`
- **Headers**: `Content-Type: application/json`
- **Body JSON**:
```json
{
  "customer": {
    "customerName": "Dimas Anggara",
    "email": "dimas@example.com",
    "address": "Jl. Mawar No. 12, Surabaya, 60111"
  },
  "items": [
    { "productId": "betta-koi", "quantity": 1 },
    { "productId": "guppy-mosaic", "quantity": 2 }
  ]
}
```
- **Proses Backend**:
  1. Validasi format nama, email, dan alamat pengiriman.
  2. Pengecekan stok terkini di database SQLite.
  3. Menyimpan data pelanggan ke tabel `customers`.
  4. Membuat faktur pemesanan di tabel `orders`.
  5. Menyimpan detail item di tabel `order_items`.
  6. Mengurangi stok produk di tabel `products`.
  7. Seluruh operasi dibungkus dalam `BEGIN IMMEDIATE ... COMMIT` (Rollback jika gagal).

---

## 🗄️ Skema Database Relasional

Skema tersimpan pada file [`src/schema.sql`](./src/schema.sql), terdiri dari 4 tabel:

1. **`products`**: Menyimpan katalog ikan hias, stok, harga, dan deskripsi.
2. **`customers`**: Menyimpan informasi pembeli (email unik, nama, alamat).
3. **`orders`**: Menyimpan nomor pesanan, relasi ID pembeli, status, dan total belanja.
4. **`order_items`**: Menyimpan rincian item tiap pesanan, harga satuan, dan subtotal.

---

## 📂 Struktur Proyek

```text
web teori/
├── data/
│   └── lautkecil.sqlite     # Database SQLite lokal (dibuat otomatis)
├── public/                  # Aset frontend (Client-side)
│   ├── css/
│   │   └── style.css        # Seluruh styling tema & responsive design
│   ├── js/
│   │   └── app.js           # Logika interaktif frontend & konsumsi API
│   └── index.html           # Tampilan utama web e-commerce & dokumentasi modal
├── src/                     # Backend core & Database logic
│   ├── database.js          # Koneksi SQLite, inisialisasi, & transaksi atomik
│   └── schema.sql           # Definisi skema tabel relasional & indeks DDL
├── .gitignore               # Daftar berkas yang diabaikan oleh Git
├── package.json             # Konfigurasi proyek & skrip npm
├── README.md                # Dokumentasi lengkap proyek
└── server.js                # Entry point HTTP Server bawaan Node.js & REST API
```
