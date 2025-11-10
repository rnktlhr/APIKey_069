// === Import modul bawaan & eksternal ===
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2');

// === Inisialisasi Express ===
const app = express();
const port = 3000;

// === Middleware ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// === Koneksi ke MySQL dengan Pool ===
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  port: 3308, // ubah sesuai konfigurasi MySQL kamu
  password: 'Luhur2004_', // isi jika ada password
  database: 'apikey_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// === Tes koneksi database ===
db.getConnection((err, conn) => {
  if (err) {
    console.error('Gagal koneksi ke database:', err.message);
  } else {
    console.log('Terhubung ke MySQL');
    conn.release();
  }
});

// === Rute utama ===
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// === Rute POST: Membuat API Key Baru ===
app.post('/api/create-key', (req, res) => {
  const keyLength = 32;

  // Buat API key aman dengan crypto
  const randomBytes = crypto.randomBytes(Math.ceil(keyLength * 0.75));
  let apiKey = randomBytes.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
    .substring(0, keyLength);

  // Simpan ke database
  const sql = 'INSERT INTO api_keys (api_key, status) VALUES (?, "active")';
  db.query(sql, [apiKey], (err, result) => {
    if (err) {
      console.error('Gagal menyimpan API key:', err.message);
      return res.status(500).json({ status: 'error', message: 'Gagal menyimpan API key' });
    }

    res.json({
      status: 'success',
      apiKey: apiKey,
      createdAt: new Date().toISOString()
    });
  });
});


// === Rute GET: Menampilkan Semua API Key ===
app.get('/api/keys', (req, res) => {
  const sql = 'SELECT * FROM api_keys ORDER BY id DESC';
  db.query(sql, (err, rows) => {
    if (err) {
      return res.status(500).json({ status: 'error', message: 'Gagal mengambil data' });
    }
    res.json(rows);
  });
});


// === Rute POST: Validasi API Key ===
app.post('/api/validate-key', (req, res) => {
  const { apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({
      status: 'error',
      message: 'API key harus dikirim dalam body request.'
    });
  }

  const sql = 'SELECT * FROM api_keys WHERE api_key = ? AND status = "active" LIMIT 1';
  db.query(sql, [apiKey], (err, rows) => {
    if (err) {
      console.error('Error saat memeriksa API key:', err.message);
      return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan server.' });
    }

    if (rows.length === 0) {
      return res.status(401).json({
        status: 'invalid',
        message: 'API key tidak valid atau sudah dicabut.'
      });
    }

    res.json({
      status: 'valid',
      message: 'API key valid dan aktif.',
      createdAt: rows[0].created_at
    });
  });
});


// === Rute PUT: Revoke (Cabut) API Key ===
app.put('/api/revoke-key', (req, res) => {
  const { apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({ status: 'error', message: 'API key wajib dikirim.' });
  }

  const sql = 'UPDATE api_keys SET status = "revoked" WHERE api_key = ?';
  db.query(sql, [apiKey], (err, result) => {
    if (err) {
      console.error('Gagal mencabut API key:', err.message);
      return res.status(500).json({ status: 'error', message: 'Kesalahan server.' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'API key tidak ditemukan.' });
    }

    res.json({ status: 'success', message: 'API key berhasil dicabut.' });
  });
});


// === Jalankan server ===
app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});
