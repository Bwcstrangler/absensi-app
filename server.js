const express = require('express');
const Database = require('better-sqlite3');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const db = new Database('absensi.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT, username TEXT UNIQUE, password TEXT, role TEXT
  );
  CREATE TABLE IF NOT EXISTS absensi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, nama TEXT, tanggal TEXT,
    jam_masuk TEXT, jam_pulang TEXT, status TEXT, keterangan TEXT
  );
`);
try { db.exec(`ALTER TABLE absensi ADD COLUMN jam_pulang TEXT`); } catch(e) {}

const cekAdmin = db.prepare("SELECT * FROM users WHERE username=?").get('bennyfirdaus');
if(!cekAdmin){
  db.prepare("INSERT INTO users (nama, username, password, role) VALUES (?,?,?,?)").run('Benny Firdaus', 'bennyfirdaus', 'admin123', 'admin');
  db.prepare("INSERT INTO users (nama, username, password, role) VALUES (?,?,?,?)").run('Budi Santoso', 'budi', '123456', 'user');
}

app.post('/api/register', (req, res) => {
  const { nama, username, password } = req.body;
  if(!nama || !username || !password) return res.json({ success: false, message: 'Semua field wajib diisi' });
  try {
    db.prepare("INSERT INTO users (nama, username, password, role) VALUES (?,?,?,'user')").run(nama, username, password);
    res.json({ success: true, message: 'Akun berhasil dibuat, silakan login!' });
  } catch (e) {
    res.json({ success: false, message: 'Username sudah dipakai, coba yang lain' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE username=? AND password=?").get(username, password);
  if(!user) return res.json({ success: false, message: 'Username / password salah' });
  res.json({ success: true, user: { id: user.id, nama: user.nama, role: user.role } });
});

app.post('/api/absen-masuk', (req, res) => {
  const { user_id, nama, status, keterangan } = req.body;
  const now = new Date();
  const tanggal = now.toISOString().slice(0,10);
  const jam = now.toLocaleTimeString('id-ID');
  const sudah = db.prepare("SELECT * FROM absensi WHERE user_id=? AND tanggal=?").get(user_id, tanggal);
  if(sudah) return res.json({ success: false, message: 'Kamu sudah absen hari ini: ' + sudah.status + ' jam ' + sudah.jam_masuk });
  const isOff = status === 'Off';
  const jamMasuk = isOff ? '-' : jam;
  const jamPulang = isOff ? '-' : null;
  db.prepare("INSERT INTO absensi (user_id, nama, tanggal, jam_masuk, jam_pulang, status, keterangan) VALUES (?,?,?,?,?,?,?)").run(user_id, nama, tanggal, jamMasuk, jamPulang, status, keterangan || '-');
  res.json({ success: true, message: isOff ? 'Status OFF berhasil disimpan, selamat libur!' : 'Absen MASUK berhasil jam ' + jam });
});

app.post('/api/absen-pulang', (req, res) => {
  const { user_id } = req.body;
  const now = new Date();
  const tanggal = now.toISOString().slice(0,10);
  const jam = now.toLocaleTimeString('id-ID');
  const data = db.prepare("SELECT * FROM absensi WHERE user_id=? AND tanggal=?").get(user_id, tanggal);
  if(!data) return res.json({ success: false, message: 'Kamu belum absen masuk hari ini!' });
  if(data.status === 'Off') return res.json({ success: false, message: 'Hari ini kamu OFF, gak perlu absen pulang' });
  if(data.jam_pulang) return res.json({ success: false, message: 'Kamu sudah absen pulang jam ' + data.jam_pulang });
  db.prepare("UPDATE absensi SET jam_pulang=? WHERE id=?").run(jam, data.id);
  res.json({ success: true, message: 'Absen PULANG berhasil jam ' + jam });
});

app.get('/api/status-hari-ini/:user_id', (req, res) => {
  const tanggal = new Date().toISOString().slice(0,10);
  const data = db.prepare("SELECT * FROM absensi WHERE user_id=? AND tanggal=?").get(req.params.user_id, tanggal);
  res.json(data || {});
});

app.post('/api/absen', (req, res) => {
  req.url = '/api/absen-masuk';
  app.handle(req, res);
});

app.get('/api/rekap', (req, res) => {
  const data = db.prepare("SELECT * FROM absensi ORDER BY tanggal DESC").all();
  res.json(data);
});

app.get('/api/export/excel', async (req, res) => {
  const data = db.prepare("SELECT * FROM absensi ORDER BY tanggal DESC").all();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Rekap Absensi');
  sheet.columns = [
    { header: 'Tanggal', key: 'tanggal', width: 15 },
    { header: 'Nama', key: 'nama', width: 25 },
    { header: 'Jam Masuk', key: 'jam_masuk', width: 15 },
    { header: 'Jam Pulang', key: 'jam_pulang', width: 15 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Keterangan', key: 'keterangan', width: 30 },
  ];
  sheet.addRows(data);
  sheet.getRow(1).font = { bold: true };
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=rekap-absensi.xlsx');
  await workbook.xlsx.write(res);
  res.end();
});

app.get('/api/export/pdf', (req, res) => {
  const data = db.prepare("SELECT * FROM absensi ORDER BY tanggal DESC").all();
  const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=rekap-absensi.pdf');
  doc.pipe(res);
  doc.fontSize(16).text('Rekap Absensi', { align: 'center' });
  doc.moveDown();
  data.forEach((d, i) => {
    doc.fontSize(11).text(`${i+1}. ${d.tanggal} | ${d.nama} | Masuk: ${d.jam_masuk || '-'} | Pulang: ${d.jam_pulang || '-'} | ${d.status} | ${d.keterangan}`);
  });
  doc.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server jalan di port ' + PORT));