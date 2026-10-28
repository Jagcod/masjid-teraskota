# Panduan Konfigurasi Firebase - Display TV Masjid Teraskota

Dokumen ini memandu Anda langkah demi langkah dalam menyiapkan Firebase (Authentication, Cloud Firestore, Security Rules, dan Akun Admin Pertama) tanpa biaya langganan (menggunakan paket gratis Spark Plan).

---

## Daftar Isi
1. [Membuat Proyek Firebase](#1-membuat-proyek-firebase)
2. [Mendaftarkan Aplikasi Web & Mengambil Konfigurasi](#2-mendaftarkan-aplikasi-web--mengambil-konfigurasi)
3. [Mengaktifkan Firebase Authentication](#3-mengaktifkan-firebase-authentication)
4. [Mengaktifkan Cloud Firestore Database](#4-mengaktifkan-cloud-firestore-database)
5. [Menerapkan Firestore Security Rules](#5-menerapkan-firestore-security-rules)
6. [Membuat Akun Admin Pertama (Bootstrap Admin)](#6-membuat-akun-admin-pertama-bootstrap-admin)
7. [Mengaktifkan Firebase Storage (Opsional)](#7-mengaktifkan-firebase-storage-opsional)
8. [Batasan Paket Gratis (Spark Plan)](#8-batasan-paket-gratis-spark-plan)

---

## 1. Membuat Proyek Firebase

1. Buka browser dan kunjungi [Firebase Console](https://console.firebase.google.com/).
2. Masuk menggunakan akun Google Anda.
3. Klik tombol **"Add project"** (Tambah proyek).
4. Beri nama proyek, contoh: `masjid-teraskota-tv`.
5. Google Analytics: Boleh dimatikan atau diaktifkan sesuai kebutuhan, lalu klik **"Create project"**.
6. Tunggu hingga proses pembuatan selesai, lalu klik **"Continue"**.

---

## 2. Mendaftarkan Aplikasi Web & Mengambil Konfigurasi

1. Pada halaman ringkasan proyek (Project Overview), klik ikon web **`</>`** untuk menambahkan web app.
2. Masukkan nama aplikasi, contoh: `Display TV Web`.
3. Centang opsi *"Also set up Firebase Hosting"* jika Anda ingin opsi hosting cadangan (opsional), lalu klik **"Register app"**.
4. Anda akan melihat kode `firebaseConfig` seperti contoh berikut:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSyD-xxxxxxxxxxxxxxxxxxxxx",
     authDomain: "masjid-teraskota-tv.firebaseapp.com",
     projectId: "masjid-teraskota-tv",
     storageBucket: "masjid-teraskota-tv.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:xxxxxxxxxxxxxxxx"
   };
   ```
5. Buka file `assets/js/firebase-config.js` di editor Anda, lalu gantikan nilai placeholder di dalam `FIREBASE_CONFIG` dengan nilai dari Firebase Console Anda:
   ```javascript
   const FIREBASE_CONFIG = {
       apiKey: "AIzaSyD-xxxxxxxxxxxxxxxxxxxxx",
       authDomain: "masjid-teraskota-tv.firebaseapp.com",
       projectId: "masjid-teraskota-tv",
       storageBucket: "masjid-teraskota-tv.appspot.com",
       messagingSenderId: "123456789012",
       appId: "1:123456789012:web:xxxxxxxxxxxxxxxx"
   };
   ```
6. Simpan file tersebut.

> **Catatan Keamanan:** Nilai apiKey dan config web Firebase dirancang untuk client-side dan aman berada di repository publik. Keamanan data sesungguhnya diatur oleh **Firebase Authentication** dan **Security Rules** yang dikonfigurasi di langkah berikutnya.

---

## 3. Mengaktifkan Firebase Authentication

1. Di menu sebelah kiri Firebase Console, klik **Build** > **Authentication**.
2. Klik tombol **"Get started"**.
3. Di tab **Sign-in method**, pilih **"Email/Password"**.
4. Aktifkan opsi pertama: **Enable** (Email/Password). Opsi *Email link (passwordless)* biarkan nonaktif.
5. Klik **"Save"**.

---

## 4. Mengaktifkan Cloud Firestore Database

1. Di menu sebelah kiri, klik **Build** > **Firestore Database**.
2. Klik tombol **"Create database"**.
3. Pilih lokasi database: pilih `asia-southeast2` (Jakarta) jika tersedia, atau `asia-southeast1` (Singapura) untuk latensi terbaik dari Indonesia.
4. Pada pemilihan aturan awal, pilih **"Start in production mode"** (jangan test mode agar tidak terbuka untuk umum).
5. Klik **"Create"** dan tunggu hingga database aktif.

---

## 5. Menerapkan Firestore Security Rules

Agar Display TV dapat membaca jadwal, kajian, dan pengumuman secara publik tanpa login, namun **hanya admin terdaftar yang dapat mengubah data**:

1. Masuk ke **Firestore Database** > pilih tab **"Rules"**.
2. Hapus aturan bawaan, lalu salin dan tempelkan seluruh isi file `firebase/firestore.rules`:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       function isAuthenticated() {
         return request.auth != null;
       }
       function isAdmin() {
         return isAuthenticated() && (
           exists(/databases/$(database)/documents/adminProfiles/$(request.auth.uid)) &&
           get(/databases/$(database)/documents/adminProfiles/$(request.auth.uid)).data.isActive == true
         );
       }

       match /settings/{docId} { allow read: if true; allow write: if isAdmin(); }
       match /prayerSchedules/{docId} { allow read: if true; allow write: if isAdmin(); }
       match /kajian/{docId} { allow read: if true; allow write: if isAdmin(); }
       match /activities/{docId} { allow read: if true; allow write: if isAdmin(); }
       match /news/{docId} { allow read: if true; allow write: if isAdmin(); }
       match /announcements/{docId} { allow read: if true; allow write: if isAdmin(); }
       match /fridaySchedules/{docId} { allow read: if true; allow write: if isAdmin(); }
       match /financeReports/{docId} { allow read: if true; allow write: if isAdmin(); }
       match /qris/{docId} { allow read: if true; allow write: if isAdmin(); }
       match /displaySlides/{docId} { allow read: if true; allow write: if isAdmin(); }

       match /adminProfiles/{userId} {
         allow read: if isAuthenticated() && (request.auth.uid == userId || isAdmin());
         allow write: if isAdmin();
       }

       match /{document=**} { allow read, write: if false; }
     }
   }
   ```
3. Klik tombol **"Publish"**.

---

## 6. Membuat Akun Admin Pertama (Bootstrap Admin)

Langkah ini penting agar Anda memiliki akun yang diakui sebagai admin oleh Security Rules:

### Langkah A: Buat Pengguna di Authentication
1. Di Firebase Console, buka **Authentication** > tab **Users**.
2. Klik tombol **"Add user"**.
3. Masukkan Email (contoh: `admin@masjidteraskota.id`) dan Password yang kuat.
4. Klik **"Add user"**.
5. Setelah berhasil, cari user tersebut di daftar dan **Salin User UID** (UID berupa deretan huruf dan angka unik, contoh: `4kL9xY2mN8pQ...`).

### Langkah B: Daftarkan UID di Koleksi `adminProfiles`
1. Buka **Firestore Database** > tab **Data**.
2. Klik **"Start collection"**.
3. Masukkan Collection ID: `adminProfiles` lalu klik **Next**.
4. Pada **Document ID**, masukkan **UID yang disalin dari langkah A**. *(PENTING: Jangan gunakan Auto-ID)*.
5. Tambahkan field-field berikut:
   - Field: `email` | Type: `string` | Value: `admin@masjidteraskota.id`
   - Field: `role` | Type: `string` | Value: `superadmin`
   - Field: `isActive` | Type: `boolean` | Value: `true`
   - Field: `createdAt` | Type: `timestamp` | Value: pilih waktu sekarang
6. Klik **"Save"**.

Sekarang akun tersebut sudah resmi menjadi Admin yang dapat login ke `/admin/` dan memiliki hak tulis penuh.

---

## 7. Mengaktifkan Firebase Storage (Opsional)

Jika Anda ingin mengunggah gambar flyer atau kode QRIS langsung ke cloud storage:
1. Di Firebase Console, buka **Build** > **Storage**.
2. Klik **"Get started"**.
3. Pilih lokasi storage yang sama dengan Firestore (`asia-southeast2` atau `asia-southeast1`).
4. Buka tab **Rules** pada Storage, lalu salin dan tempel isi dari file `firebase/storage.rules`.
5. Klik **"Publish"**.

*Jika Storage tidak diaktifkan, panel admin tetap dapat digunakan dengan memasukkan URL gambar eksternal secara langsung.*

---

## 8. Batasan Paket Gratis (Spark Plan)

Proyek ini 100% dapat berjalan pada paket gratis Firebase tanpa kartu kredit:
- **Cloud Firestore:**
  - 50.000 baca/hari
  - 20.000 tulis/hari
  - 1 GB total penyimpanan data
  *(Sangat mencukupi untuk puluhan TV Display masjid)*
- **Firebase Authentication:**
  - Tanpa batas untuk email/password
- **Firebase Storage (jika aktif):**
  - 5 GB penyimpanan
  - 1 GB transfer unduhan/hari
