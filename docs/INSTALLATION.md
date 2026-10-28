# Panduan Menjalankan dan Menguji Secara Lokal - Display TV Masjid Teraskota

Dokumen ini menjelaskan cara menjalankan aplikasi Display TV Masjid Teraskota di komputer lokal (Windows/macOS/Linux) tanpa harus menunggu publikasi online, serta rekomendasi setup fisik pada TV Masjid.

---

## Daftar Isi
1. [Prasyarat Lokal](#1-prasyarat-lokal)
2. [Menjalankan Web Server Lokal](#2-menjalankan-web-server-lokal)
3. [Mode Demo (Tanpa Firebase)](#3-mode-demo-tanpa-firebase)
4. [Menghubungkan ke Firebase Lokal](#4-menghubungkan-ke-firebase-lokal)
5. [Setup Fisik pada Televisi Masjid](#5-setup-fisik-pada-televisi-masjid)

---

## 1. Prasyarat Lokal

Aplikasi dibangun murni menggunakan standard web: HTML5, CSS3, dan Vanilla JavaScript (ES Modules / modern JS).
Untuk menghindari kendala CORS saat browser membaca asset lokal, jalankan aplikasi menggunakan web server lokal sederhana.

Pilihan web server:
- **Node.js** (jika terinstal): `npx serve .` atau `npx http-server .`
- **Python 3** (jika terinstal): `python -m http.server 8080`
- **Ekstensi VS Code**: *Live Server*

---

## 2. Menjalankan Web Server Lokal

### Menggunakan Node.js (Rekomendasi)
Buka terminal PowerShell pada folder `d:\project\masjidgithub`:
```powershell
npx serve . -p 8080
```
Lalu buka di browser:
- Display TV: [http://localhost:8080/](http://localhost:8080/)
- Panel Admin: [http://localhost:8080/admin/](http://localhost:8080/admin/)

### Menggunakan Python 3
```powershell
python -m http.server 8080
```

---

## 3. Mode Demo (Tanpa Firebase)

Aplikasi memiliki fitur **Auto Fallback ke Mode Demo**:
Jika Anda belum mengisi kredensial Firebase di `assets/js/firebase-config.js`:
- Halaman Display TV akan tetap berjalan sempurna dengan data demo realistis (jadwal salat Tangerang Selatan dari Aladhan API, slide kajian, informasi Jumat, running text, dan QRIS contoh).
- Halaman Admin dapat diakses dengan tombol **"Masuk dengan Mode Demo"** tanpa perlu login Firebase, memungkinkan Anda menguji tampilan panel admin, form CRUD, dan pratinjau langsung.

---

## 4. Menghubungkan ke Firebase Lokal

1. Ikuti langkah di [FIREBASE_SETUP.md](./FIREBASE_SETUP.md).
2. Isi file `assets/js/firebase-config.js` dengan konfigurasi web app dari Firebase Console Anda.
3. Muat ulang halaman lokal di browser. Aplikasi akan otomatis beralih dari Mode Demo ke Mode Online Firestore.

---

## 5. Setup Fisik pada Televisi Masjid

### Rekomendasi Perangkat Keras:
1. **Smart TV dengan Built-in Web Browser** (Samsung Tizen, LG webOS, Android TV / Google TV).
2. **TV Biasa (HDMI) + Media Dongle**:
   - Google Chromecast with Google TV
   - Xiaomi Mi TV Stick / Mi Box S
   - Raspberry Pi 4 dengan Raspberry Pi OS / Chromium Kiosk

### Langkah Pengaturan Browser di Layar TV:
1. Buka browser pada TV/Dongle.
2. Ketikkan URL publik Display TV Anda (misal: `https://USERNAME.github.io/masjid-teraskota-tv/`).
3. Tekan tombol **F11** pada keyboard nirkabel atau pilih menu browser **"Full Screen Mode"** (Layar Penuh).
4. Sembunyikan bilah alamat (URL bar) agar tampilan bersih seperti siaran TV profesional.
5. Atur rasio aspek TV ke **16:9** atau **Just Scan / Fit to Screen** untuk mencegah overscan (tepi layar terpotong).
6. Nonaktifkan fitur *Auto Sleep / Screen Saver* pada menu sistem TV agar layar menyala terus sepanjang waktu operasional masjid.
