# Panduan Deploy Online ke Vercel (100% Bebas Error)

Sistem **Display TV & Panel Admin Masjid Teraskota** telah dikonfigurasi dan disiapkan secara lengkap untuk hosting di **Vercel**. Seluruh konfigurasi routing (`vercel.json`), penanganan static files, dan cache headers sudah aktif.

---

## 🚀 Pilihan 1: Deploy via GitHub (Sangat Disarankan)

Metode ini paling bagus karena setiap ada update/perubahan kode, Vercel akan otomatis meng-update web online Anda.

### Langkah-langkah:
1. **Buat Repository Baru di GitHub**:
   - Buka [github.com/new](https://github.com/new).
   - Beri nama repository, misalnya: `masjid-teraskota`.
   - Pilih **Public** atau **Private**, lalu klik **Create repository**.

2. **Hubungkan & Push dari Komputer**:
   Buka terminal di folder project (`d:\project\masjidgithub`), jalankan:
   ```bash
   git branch -M main
   git remote add origin https://github.com/USERNAME_ANDA/masjid-teraskota.git
   git push -u origin main
   ```
   *(Ganti `USERNAME_ANDA` dengan username GitHub Anda).*

3. **Deploy di Vercel**:
   - Buka [vercel.com](https://vercel.com) dan login (bisa login dengan akun GitHub).
   - Di dashboard Vercel, klik tombol **"Add New..."** lalu pilih **"Project"**.
   - Pilih repository `masjid-teraskota` yang baru dibuat, lalu klik **Import**.
   - Pada bagian konfigurasi:
     - **Framework Preset**: biarkan **Other** (karena murni HTML/CSS/JS statis).
     - **Root Directory**: `./` (biarkan default).
   - Klik tombol **"Deploy"**.

4. **Selesai!**
   Dalam waktu ~15 detik, website Anda sudah online dengan URL resmi, misalnya:
   - **Display TV:** `https://masjid-teraskota.vercel.app/`
   - **Panel Admin:** `https://masjid-teraskota.vercel.app/admin`

---

## ⚡ Pilihan 2: Deploy Langsung via Terminal (Vercel CLI)

Jika Anda tidak ingin upload ke GitHub terlebih dahulu, Anda bisa langsung deploy dari terminal komputer:

1. Buka PowerShell di folder project:
   ```bash
   npx vercel
   ```
2. Tekan Enter untuk menyetujui login Vercel di browser.
3. Jawab pertanyaan di terminal:
   - *Set up and deploy?* &rarr; ketik `y` lalu Enter.
   - *Which scope?* &rarr; tekan Enter.
   - *Link to existing project?* &rarr; ketik `n` lalu Enter.
   - *What's your project's name?* &rarr; tekan Enter (atau beri nama `masjid-teraskota`).
   - *In which directory is your code located?* &rarr; tekan Enter (`./`).
   - *Want to modify these settings?* &rarr; ketik `n` lalu Enter.
4. Setelah preview selesai, luncurkan ke Production:
   ```bash
   npx vercel --prod
   ```
5. URL Production langsung muncul di terminal!

---

## 🔒 Konfigurasi Domain Kustom (Opsional)
Jika masjid memiliki domain sendiri (misal: `tv.masjidteraskota.id`):
1. Masuk ke Project Anda di Vercel &rarr; **Settings** &rarr; **Domains**.
2. Masukkan nama domain Anda.
3. Arahkan DNS CNAME di penyedia domain Anda ke `cname.vercel-dns.com`.
4. SSL/HTTPS gratis otomatis aktif dari Vercel.

