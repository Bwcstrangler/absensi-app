let user = null;

async function login(){
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if(!data.success) return alert(data.message);
  user = data.user;
  document.getElementById('loginBox').style.display = 'none';
  document.getElementById('mainBox').style.display = 'block';
  document.getElementById('namaUser').innerText = user.nama;
  cekStatus();
  if(user.role === 'admin'){
    document.getElementById('adminArea').style.display = 'block';
    loadRekap();
  }
}

async function cekStatus(){
  const res = await fetch('/api/status-hari-ini/' + user.id);
  const d = await res.json();
  const btnMasuk = document.getElementById('btnMasuk');
  const btnPulang = document.getElementById('btnPulang');
  const info = document.getElementById('infoHariIni');
  if(d.jam_masuk && d.jam_pulang){
    btnMasuk.disabled = true; btnPulang.disabled = true;
    btnMasuk.innerText = '✅ Sudah Masuk ' + d.jam_masuk;
    btnPulang.innerText = '✅ Sudah Pulang ' + d.jam_pulang;
    info.innerText = 'Hari ini: Masuk ' + d.jam_masuk + ' | Pulang ' + d.jam_pulang;
  } else if(d.jam_masuk){
    btnMasuk.disabled = true; btnMasuk.innerText = '✅ Sudah Masuk ' + d.jam_masuk;
    btnPulang.disabled = false;
    info.innerText = 'Hari ini sudah masuk jam ' + d.jam_masuk + ', belum pulang.';
  } else {
    info.innerText = 'Kamu belum absen hari ini.';
  }
}

async function absenMasuk(){
  const res = await fetch('/api/absen-masuk', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      user_id: user.id, nama: user.nama,
      status: document.getElementById('status').value,
      keterangan: document.getElementById('keterangan').value
    })
  });
  const data = await res.json();
  alert(data.message);
  cekStatus();
  if(user.role === 'admin') loadRekap();
}

async function absenPulang(){
  const res = await fetch('/api/absen-pulang', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ user_id: user.id })
  });
  const data = await res.json();
  alert(data.message);
  cekStatus();
  if(user.role === 'admin') loadRekap();
}

async function loadRekap(){
  const res = await fetch('/api/rekap');
  const data = await res.json();
  let html = `<tr><th>Tanggal</th><th>Nama</th><th>Masuk</th><th>Pulang</th><th>Status</th><th>Ket</th></tr>`;
  data.forEach(d => {
    html += `<tr><td>${d.tanggal}</td><td>${d.nama}</td><td>${d.jam_masuk || '-'}</td><td>${d.jam_pulang || '-'}</td><td>${d.status}</td><td>${d.keterangan}</td></tr>`;
  });
  document.getElementById('tabelRekap').innerHTML = html;
}

function logout(){ location.reload(); }

async function register(){
  const nama = document.getElementById('regNama').value;
  const username = document.getElementById('regUsername').value;
  const password = document.getElementById('regPassword').value;
  const res = await fetch('/api/register', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ nama, username, password }) });
  const data = await res.json();
  alert(data.message);
}

function exportExcel(){
  let table = document.getElementById('tabelRekap').outerHTML;
  let blob = new Blob(['\ufeff' + table], {type: 'application/vnd.ms-excel'});
  let a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rekap-absensi.xls';
  a.click();
}

function exportPDF(){
  window.print();
}