# Dokumen Pengujian Kualitas & Validasi (QA Testing Report)
## Website Display TV Masjid Teraskota

Dokumen ini mencatat hasil pengujian komprehensif terhadap seluruh modul kode, antarmuka visual, fungsionalitas logika, serta penanganan kondisi tak terduga (offline / error fallback).

---

## 1. Matriks Hasil Pengujian

| Kategori Pengujian | Komponen yang Diuji | Hasil | Catatan Teknis |
| :--- | :--- | :---: | :--- |
| **Sintaks & Parsing** | HTML5 (Display & Admin) | **LULUS** | Validasi struktur tag, semantik HTML5, meta tag viewport & SEO lengkap. |
| **Sintaks & Parsing** | CSS3 (display, admin, responsive) | **LULUS** | Tidak ada parsing error, variabel CSS rapi, fallback font terdefinisi. |
| **Sintaks & Parsing** | JavaScript (ES6+ Controllers & Services)| **LULUS** | Seluruh file JS lulus parsing Node.js v24 tanpa error sintaks. |
| **Path & Import Asset** | Relative path pada Display & Admin | **LULUS** | Menggunakan `./assets/` dan `../assets/`. Kompatibel dengan root domain dan subfolder GitHub Pages. |
| **Tampilan Resolusi** | Layar TV Full HD (1920 × 1080) | **LULUS** | Grid proporsional, rasio 16:9, tipografi terukur via `vw`/`vh`, tidak ada overflow atau scrollbar. |
| **Tampilan Resolusi** | Layar TV HD (1280 × 720) | **LULUS** | Terbaca jelas dari jarak jauh, countdown salat tetap fokus dan proporsional. |
| **Tampilan Resolusi** | Layar Laptop (1366 × 768 / 1440 × 900) | **LULUS** | Layout fleksibel, panel waktu salat dan slide tertata rapi. |
| **Tampilan Resolusi** | Perangkat Tablet & Handphone | **LULUS** | Tampilan responsive vertikal/mobile; Panel admin sangat nyaman diakses via HP. |
| **Jam & Kalender** | Jam Digital Realtime (WIB) | **LULUS** | Diperbarui setiap 1000ms, sinkron dengan zona waktu Asia/Jakarta, interval diisolasi mencegah memory leak. |
| **Jam & Kalender** | Tanggal Masehi & Tanggal Hijriah | **LULUS** | Tanggal Masehi lokal Indonesia; Hijriah via Aladhan API + fallback lokal `islamic-umalqura` + offset koreksi. |
| **Jadwal Salat** | Perhitungan Jadwal Kemenag RI | **LULUS** | Menggunakan Aladhan API method 20 (Kemenag RI), koordinat default Tangsel, penanda waktu salat berikutnya & hitung mundur. |
| **Slide Show** | Pergantian Slide Otomatis & Transisi | **LULUS** | Transisi CSS opacity halus, timer dapat dikonfigurasi via settings, tidak ada flicker atau layar kosong. |
| **Penanganan Fallback** | Fallback Gambar Rusak | **LULUS** | Event handler `onerror` otomatis menyembunyikan gambar rusak atau menampilkan placeholder SVG elegan. |
| **Penanganan Fallback** | Jaringan Terputus (Offline) | **LULUS** | Menampilkan badge status koneksi halus (tidak mengganggu jamaah), mempertahankan data terakhir dari cache localStorage/Firestore. |
| **Admin Panel** | Login & Proteksi Halaman | **LULUS** | Dilindungi Firebase Auth; Tersedia Mode Demo untuk pengujian lokal tanpa kredensial cloud. |
| **Admin Panel** | CRUD Konten (Kajian, Kegiatan, dll) | **LULUS** | Form modal dinamis, pencegahan klik ganda (`isSubmitting`), konfirmasi sebelum delete, toast notification. |
| **Cloud Firestore** | Security Rules & Live Sync | **PENDING** | Aturan keamanan sudah siap di `firebase/firestore.rules`. Menunggu input Project ID & aktivasi Firebase oleh pengurus. |
| **Cloud Storage** | Upload Foto Flyer & QRIS | **PENDING** | Aturan upload sudah siap di `firebase/storage.rules`. Menunggu aktivasi Storage di Firebase Console. |

---

## 2. Rincian Pengujian Khusus

### A. Pengujian Resolusi TV (16:9 1920×1080 dan 1280×720)
- **Metode**: Container utama menggunakan rasio aspek terkunci `16:9` dengan `max-width: 100vw; max-height: 100vh;` serta `overflow: hidden;`.
- **Hasil**: Tampilan tidak pernah menghasilkan scrollbar horizontal maupun vertikal pada browser TV. Tulisan jam dan hitung mundur salat memiliki kontras tinggi yang jelas terbaca dari saf belakang masjid.

### B. Pengujian Jam dan Interval Memory Leak
- **Metode**: Pengujian siklus inisialisasi berulang pada `display.js`.
- **Hasil**: Setiap kali fungsi inisialisasi dipanggil ulang, interval sebelumnya (`clockInterval`, `slideInterval`, `prayerInterval`) dibersihkan secara eksplisit (`clearInterval`). Tidak terjadi penumpukan interval atau beban memori berlebih.

### C. Pengujian Data Kosong
- **Metode**: Menguji Display TV ketika seluruh koleksi slide kosong.
- **Hasil**: Sistem menampilkan slide default bernuansa Islami (Logo, Nama Masjid Teraskota, dan ucapan selamat datang ramah jamaah) sehingga layar TV tidak pernah kosong melompong.

### D. Pengujian Fallback Koneksi Offline
- **Metode**: Memutus koneksi internet setelah halaman dimuat.
- **Hasil**:
  1. Jam digital tetap berdetak normal karena berjalan lokal.
  2. Jadwal salat hari ini tetap tersimpan dan ditampilkan dari cache `localStorage`.
  3. Indikator kecil berwarna amber *"Mode Offline"* muncul di sudut atas tanpa menutupi informasi ibadah.
