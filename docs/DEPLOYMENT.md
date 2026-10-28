# Panduan Publikasi ke GitHub Pages - Display TV Masjid Teraskota

Dokumen ini memandu Anda menerbitkan website Display TV Masjid Teraskota ke internet secara gratis menggunakan **GitHub Pages**. Panduan ini dirancang agar sangat mudah diikuti oleh pemula di lingkungan Windows.

---

## Daftar Isi
1. [Prasyarat](#1-prasyarat)
2. [Metode 1: Publikasi Menggunakan GitHub Desktop (Direkomendasikan Pemula)](#2-metode-1-publikasi-menggunakan-github-desktop-direkomendasikan-pemula)
3. [Metode 2: Publikasi Melalui Browser (Unggah File Langsung)](#3-metode-2-publikasi-melalui-browser-unggah-file-langsung)
4. [Metode 3: Publikasi Menggunakan Git Terminal](#4-metode-3-publikasi-menggunakan-git-terminal)
5. [Mengaktifkan Fitur GitHub Pages di Repository](#5-mengaktifkan-fitur-github-pages-di-repository)
6. [Struktur URL Website](#6-struktur-url-website)
7. [Pemeriksaan Kompatibilitas Path (Project URL)](#7-pemeriksaan-kompatibilitas-path-project-url)
8. [Cara Memperbarui Website di Masa Depan](#8-cara-memperbarui-website-di-masa-depan)

---

## 1. Prasyarat

- Akun di [GitHub.com](https://github.com/) (gratis).
- File proyek di komputer Anda (folder `masjidgithub`).
- File `assets/js/firebase-config.js` sudah diisi dengan konfigurasi Firebase Anda (lihat [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)).

---

## 2. Metode 1: Publikasi Menggunakan GitHub Desktop (Direkomendasikan Pemula)

1. Unduh dan pasang aplikasi gratis [GitHub Desktop](https://desktop.github.com/).
2. Masuk (Sign in) dengan akun GitHub Anda di GitHub Desktop.
3. Klik menu **File** > **Add Local Repository**.
4. Klik tombol **Choose...** lalu pilih folder proyek Anda: `d:\project\masjidgithub`.
5. Jika muncul pesan *"This directory does not appear to be a Git repository"*, klik link bertuliskan **"create a repository"**, lalu klik **Create Repository**.
6. Klik tombol **Publish repository** di toolbar bagian atas.
   - Name: `masjid-teraskota-tv` (atau nama repositori yang Anda sukai).
   - Pastikan tanda centang **"Keep this code private"** dinonaktifkan (uncheck) jika menggunakan akun GitHub gratis agar fitur GitHub Pages dapat aktif tanpa biaya.
   - Klik **Publish repository**.
7. Tunggu hingga proses unggah selesai. Lanjut ke [Langkah 5](#5-mengaktifkan-fitur-github-pages-di-repository).

---

## 3. Metode 2: Publikasi Melalui Browser (Unggah File Langsung)

1. Buka [GitHub.com](https://github.com/) dan login.
2. Klik tombol **New** (ikon plus `+` di kanan atas) untuk membuat repository baru.
3. Masukkan Repository name: `masjid-teraskota-tv`.
4. Pilih opsi **Public**.
5. Centang **"Add a README file"** lalu klik **Create repository**.
6. Pada halaman repositori yang baru dibuat, klik **Add file** > **Upload files**.
7. Seret (drag and drop) seluruh file dan folder dari folder proyek `masjidgithub` ke jendela browser.
8. Tulis pesan ringkas pada commit (contoh: `Initial release`), lalu klik tombol hijau **Commit changes**.

---

## 4. Metode 3: Publikasi Menggunakan Git Terminal

Bagi pengguna yang terbiasa dengan perintah terminal PowerShell:

```powershell
cd d:\project\masjidgithub
git init
git add .
git commit -m "feat: complete masjid display tv and admin application"
git branch -M main
git remote add origin https://github.com/USERNAME/masjid-teraskota-tv.git
git push -u origin main
```
*(Ganti `USERNAME` dengan nama pengguna GitHub Anda)*

---

## 5. Mengaktifkan Fitur GitHub Pages di Repository

Setelah kode terunggah ke GitHub:

1. Buka halaman repository Anda di GitHub melalui browser (contoh: `https://github.com/USERNAME/masjid-teraskota-tv`).
2. Klik tab **Settings** di menu atas repositori.
3. Pada bilah navigasi kiri, cari bagian **Code and automation**, lalu klik **Pages**.
4. Di bagian **Build and deployment**:
   - **Source:** Pilih **Deploy from a branch**.
   - **Branch:** Pilih branch `main` dan folder `/ (root)`.
   - Klik tombol **Save**.
5. Tunggu sekitar 1 hingga 3 menit. Muat ulang (refresh) halaman Settings > Pages tersebut.
6. Anda akan melihat kotak bertuliskan:
   > *"Your site is live at `https://USERNAME.github.io/masjid-teraskota-tv/`"*

---

## 6. Struktur URL Website

Setelah GitHub Pages aktif, Anda memiliki 2 alamat utama:

| Tujuan | URL | Keterangan |
| :--- | :--- | :--- |
| **Layar Display TV** | `https://USERNAME.github.io/masjid-teraskota-tv/` | Buka di Smart TV / Browser TV masjid. Tidak memerlukan login, langsung fullscreen & realtime. |
| **Panel Admin** | `https://USERNAME.github.io/masjid-teraskota-tv/admin/` | Buka di Laptop atau HP pengurus DKM untuk mengelola konten dan jadwal. |

---

## 7. Pemeriksaan Kompatibilitas Path (Project URL)

Seluruh file HTML, CSS, dan JavaScript di proyek ini dirancang menggunakan **relative path**:
- Halaman Display TV (`index.html`) memanggil asset melalui `./assets/...`.
- Halaman Admin (`admin/index.html`) memanggil asset melalui `../assets/...`.

Hal ini menjamin bahwa aplikasi **100% aman dan berjalan mulus** baik saat diakses di root domain maupun subfolder GitHub Pages (`https://USERNAME.github.io/PROJECT-NAME/`).

---

## 8. Cara Memperbarui Website di Masa Depan

### A. Memperbarui Konten (Jadwal, Kajian, Pengumuman, Running Text, Gambar)
**TIDAK PERLU** menyentuh kode GitHub atau deploy ulang!
Cukup buka alamat Panel Admin di browser:
`https://USERNAME.github.io/masjid-teraskota-tv/admin/`
Masuk dengan akun admin Anda, ubah data yang diinginkan, dan klik Simpan. Layar TV akan otomatis menerima data terbaru via Cloud Firestore secara realtime.

### B. Memperbarui Kode Tampilan / Fitur
Jika Anda memodifikasi file HTML/CSS/JS di komputer:
1. Simpan perubahan.
2. Buka GitHub Desktop, Anda akan melihat daftar file yang diubah.
3. Masukkan ringkasan perubahan di pojok kiri bawah (contoh: *Update warna jam*).
4. Klik **Commit to main**, lalu klik **Push origin**.
5. GitHub Pages akan otomatis memperbarui website dalam 1-2 menit.
