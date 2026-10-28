# Display TV Masjid Teraskota

Aplikasi web modern, elegan, dan andal untuk menampilkan jadwal salat, hitung mundur azan/iqamah, kajian, kegiatan, pengumuman, informasi Jumat, laporan keuangan ZISWAF, dan QRIS infak pada layar televisi (Smart TV / Android TV) Masjid Teraskota.

Dilengkapi dengan **Panel Admin** terpadu yang aman untuk memudahkan pengurus DKM memperbarui seluruh konten secara realtime tanpa perlu mengubah kode sumber atau melakukan deployment ulang.

---

## 🌟 Fitur Unggulan

### 1. Layar Display TV (`/index.html`)
- **Desain Khusus TV 16:9**: Dioptimalkan untuk resolusi Full HD (1920×1080) dan HD (1280×720), bebas scrollbar, dan terbaca jelas dari jarak jauh.
- **Tanpa Login & Akses Instan**: URL publik siap dibuka di TV masjid kapan saja tanpa perlu memasukkan akun Google atau kode pairing yang merepotkan.
- **Jadwal Salat Otomatis Kemenag RI**: Dihitung berdasarkan koordinat lokasi masjid (Tangerang Selatan) via Aladhan API terpercaya dengan dukungan koreksi manual.
- **Hitung Mundur Waktu Salat**: Indikator dinamis yang menghitung mundur ke waktu salat berikutnya secara presisi.
- **Kalender Ganda Realtime**: Tanggal Masehi dan Tanggal Hijriah sinkron dengan penyesuaian koreksi hilal (offset hari).
- **Slide Show Informasi Terjadwal**: Menampilkan jadwal kajian, agenda kegiatan, warta berita, laporan keuangan ZISWAF, dan QRIS infak secara bergantian dengan durasi yang dapat diatur.
- **Informasi Petugas Salat Jumat**: Menampilkan nama Khatib, Imam, Muazin, dan tema khutbah Jumat.
- **Teks Berjalan (Running Text)**: Pengumuman penting, hadits pengingat, dan himbauan adab masjid di bagian bawah layar.
- **Tahan Banting & Offline Cache**: Tetap berfungsi menampilkan jam dan jadwal terakhir meskipun koneksi internet terputus sesaat.

### 2. Panel Admin Pengurus (`/admin/`)
- **Autentikasi Aman**: Dilindungi Firebase Authentication (Email & Password).
- **Proteksi Hak Akses (RBAC)**: Hanya pengguna dengan status admin aktif di koleksi `adminProfiles` yang diizinkan mengedit data.
- **Manajemen Lengkap (CRUD)**:
  - Identitas Masjid (Nama, Alamat, Logo, Koordinat GPS)
  - Jadwal & Koreksi Waktu Salat
  - Jadwal Kajian Rutin & Tematik
  - Agenda Kegiatan Masjid
  - Berita & Pengumuman DKM
  - Petugas Salat Jumat Mingguan
  - Laporan Keuangan Kas Masjid & Rekap ZISWAF
  - Pengelolaan QRIS Infak Digital
  - Pengaturan Tampilan & Durasi Slide
  - Pratinjau Langsung (Display Preview)
- **Mode Demo Offline**: Pengurus dapat menguji coba seluruh panel admin di laptop sebelum proyek dihubungkan ke Firebase.

---

## 🛠️ Arsitektur & Teknologi

- **Frontend**: HTML5 Semantik, CSS3 Murni (Variabel CSS, Flexbox, CSS Grid, tipografi responsif `vw`/`vh`), Vanilla JavaScript (ES6+ Modular).
- **Hosting Frontend**: GitHub Pages (Gratis, cepat, dan handal via CDN global).
- **Backend & Database**: Google Cloud Firestore (Realtime NoSQL database).
- **Autentikasi**: Firebase Authentication.
- **Penyimpanan Media**: Firebase Storage (Opsional untuk flyer/QRIS).
- **Keamanan**: Firebase Security Rules (Strict read-only untuk publik, authenticated admin-only untuk modifikasi data).

---

## 📁 Struktur Direktori

```text
masjidgithub/
│
├── index.html                   # Halaman utama Display TV untuk layar masjid
│
├── admin/
│   └── index.html               # Halaman Panel Admin pengurus DKM
│
├── assets/
│   ├── css/
│   │   ├── display.css          # Desain visual Display TV (modern, elegan, Islami)
│   │   ├── admin.css            # Desain visual dashboard Admin Panel
│   │   └── responsive.css       # Aturan responsif TV 16:9, laptop, tablet, HP
│   ├── js/
│   │   ├── display.js           # Controller Display TV (jam, slide, timer salat)
│   │   ├── admin.js             # Controller Admin Panel (Auth, CRUD modal, data sync)
│   │   ├── firebase-config.js   # Konfigurasi client Firebase & SDK loader
│   │   └── services/
│   │       ├── firestore-service.js # Layanan komunikasi data Firestore & fallback demo
│   │       ├── prayer-times.js      # Perhitungan & pengambilan jadwal salat Kemenag
│   │       └── hijri-date.js        # Konversi kalender Hijriah & offset penanggalan
│   └── images/
│       ├── favicon.svg          # Ikon browser masjid
│       └── logo-masjid.svg      # Logo vektor resmi Masjid Teraskota
│
├── firebase/
│   ├── firestore.rules          # Aturan keamanan database Cloud Firestore
│   ├── storage.rules            # Aturan keamanan unggah file Firebase Storage
│   └── firestore.indexes.json   # Definisi indeks pencarian komposit Firestore
│
├── docs/
│   ├── INSTALLATION.md          # Panduan menjalankan lokal & setup perangkat TV
│   ├── FIREBASE_SETUP.md        # Panduan lengkap integrasi Firebase gratis
│   ├── DEPLOYMENT.md            # Panduan publikasi ke GitHub Pages bagi pemula
│   └── TESTING.md               # Laporan pengujian kualitas & matrix QA
│
├── .github/
│   └── workflows/
│       └── deploy.yml           # Otomasi deployment GitHub Pages (GitHub Actions)
│
├── firebase.json                # Konfigurasi Firebase CLI
├── .gitignore                   # Daftar file yang diabaikan Git
└── README.md                    # Dokumentasi utama proyek
```

---

## 🚀 Panduan Cepat Menjalankan Secara Lokal

1. Buka folder proyek di komputer Anda.
2. Jalankan web server lokal menggunakan Node.js:
   ```powershell
   npx serve . -p 8080
   ```
   *Atau gunakan Python:*
   ```powershell
   python -m http.server 8080
   ```
3. Buka browser:
   - **Display TV**: [http://localhost:8080/](http://localhost:8080/)
   - **Panel Admin**: [http://localhost:8080/admin/](http://localhost:8080/admin/)
4. Aplikasi akan otomatis berjalan dalam **Mode Demo** lengkap dengan data jadwal salat dan slide contoh realistis.

---

## ☁️ Panduan Pengaturan Firebase (Langkah Demi Langkah)

Panduan mendalam tersedia di file [docs/FIREBASE_SETUP.md](./docs/FIREBASE_SETUP.md). Berikut ringkasannya:

1. **Buat Proyek**: Masuk ke [Firebase Console](https://console.firebase.google.com/) dan buat proyek baru (contoh: `masjid-teraskota-tv`).
2. **Daftarkan Web App**: Tambahkan aplikasi web (`</>`), salin objek `firebaseConfig`, dan tempelkan ke dalam file `assets/js/firebase-config.js`.
3. **Aktifkan Autentikasi**: Buka menu **Authentication** > aktifkan **Email/Password**.
4. **Aktifkan Firestore**: Buka menu **Firestore Database** > klik **Create Database** (pilih lokasi Jakarta `asia-southeast2` atau Singapura `asia-southeast1`).
5. **Pasang Security Rules**: Salin isi file `firebase/firestore.rules` ke tab **Rules** pada Firestore Console, lalu klik **Publish**.
6. **Buat Akun Admin Pertama (Bootstrap)**:
   - Tambahkan user di tab Authentication (misal: `admin@masjidteraskota.id`).
   - Salin **User UID** pengguna tersebut.
   - Buka Firestore Data, buat koleksi `adminProfiles`, buat dokumen dengan ID = UID tersebut, isi:
     ```json
     {
       "email": "admin@masjidteraskota.id",
       "role": "superadmin",
       "isActive": true
     }
     ```

---

## 🌐 Panduan Publikasi ke GitHub Pages

Panduan lengkap bagi pemula Windows tersedia di [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

1. Unggah folder proyek ini ke akun GitHub Anda melalui **GitHub Desktop** atau web browser.
2. Buka repository Anda di GitHub > klik tab **Settings** > **Pages**.
3. Di bagian **Build and deployment**, pilih Source: **Deploy from a branch**, Branch: **`main`**, Folder: **`/(root)`**.
4. Klik **Save**. Dalam 1-2 menit, website Anda sudah aktif di internet:
   - URL TV: `https://USERNAME.github.io/NAMA-REPO/`
   - URL Admin: `https://USERNAME.github.io/NAMA-REPO/admin/`

---

## 🔄 Cara Memperbarui Konten

Pengurus masjid **TIDAK PERLU** mengedit kode atau membuka GitHub untuk memperbarui jadwal kajian atau running text:
1. Buka URL Admin di browser HP atau laptop.
2. Masuk menggunakan email dan password admin.
3. Ubah jadwal, tambah kajian, perbarui laporan kas, atau ganti pengumuman.
4. Klik **Simpan**.
5. Layar TV di masjid akan otomatis menampilkan konten terbaru secara realtime!

---

## ❓ Mengatasi Masalah Umum (Troubleshooting)

1. **Layar TV menampilkan status "Mode Offline"**:
   - Periksa koneksi Wi-Fi pada TV masjid.
   - Jam digital dan jadwal salat hari ini akan tetap berjalan normal dari cache lokal. Begitu internet terhubung kembali, sistem otomatis sinkronisasi ulang.
2. **Jadwal salat berbeda beberapa menit dari jadwal lokal**:
   - Buka Panel Admin > menu **Jadwal Salat**. Anda dapat memasukkan koreksi menit (misal: +2 menit untuk Magrib) atau memilih metode hisab lainnya.
3. **Tanggal Hijriah selisih 1 hari**:
   - Buka Panel Admin > menu **Pengaturan Identitas**, atur **Penyesuaian Hari Hijriah** (+1 atau -1 hari sesuai sidang isbat Kemenag).
4. **Gambar slide tidak muncul di TV**:
   - Pastikan URL gambar dapat diakses secara publik (HTTPS) atau gunakan file gambar yang telah diunggah ke Firebase Storage.

---

## 💰 Batasan Paket Gratis (Spark Plan) & Potensi Biaya

Aplikasi ini dirancang khusus agar **100% GRATIS** tanpa perlu mendaftarkan kartu kredit:
- **GitHub Pages**: Gratis tanpa batas waktu untuk hosting web publik.
- **Firebase Spark Plan**:
  - Cloud Firestore: 50.000 baca dan 20.000 tulis per hari (kebutuhan 1-5 TV masjid hanya menggunakan sekitar 1.000-2.000 baca/hari).
  - Firebase Authentication: Gratis tanpa batas untuk login email/password.
  - Aladhan API: Layanan publik terbuka gratis tanpa batasan kuota untuk waktu salat.

*Catatan: Anda tidak akan ditagih biaya apa pun selama menggunakan paket Spark default.*

---

## 📄 Lisensi
Hak Cipta © 2026 DKM Masjid Teraskota. Dikelola untuk kemaslahatan jamaah dan syiar Islam.
