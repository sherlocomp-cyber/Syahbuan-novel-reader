# Pembaca Novel: proyek APK

Isi folder: `www/index.html` (aplikasi), `.github/workflows/build-apk.yml` (build otomatis di GitHub),
`edge-tts-worker.js` (jembatan suara Microsoft Edge), `debug.keystore` (kunci tanda tangan tetap, bila ada), `package.json`, `capacitor.config.json`.

## Bagian 1. Jadikan APK lewat GitHub
1. Buat repo baru di https://github.com/new (mis. `pembaca-novel`), biarkan kosong, klik Create repository.
2. Unggah proyek, pilih salah satu cara:
   - **Cara A (komputer):** ekstrak ZIP. Di halaman repo klik Add file > Upload files, seret SEMUA isi folder (termasuk folder `.github` dan `www`), lalu Commit changes.
   - **Cara B (HP, tanpa ekstrak):** (a) Add file > Create new file, ketik nama `.github/workflows/build-apk.yml`, tempel isi file `build-apk.yml` dari ZIP, Commit. (b) Add file > Upload files, pilih `pembaca-novel-apk.zip` apa adanya, Commit. Workflow akan mengekstraknya sendiri.
3. Buka tab **Actions**. Bila muncul tombol "I understand my workflows, go ahead and enable them", klik. Proses "Build APK" berjalan otomatis 3 sampai 6 menit; centang hijau berarti selesai. Bila belum jalan, pilih Build APK > Run workflow.
4. Unduh APK: di halaman repo, panel kanan **Releases** > Build terbaru > `app-debug.apk`. (Alternatif: Actions > run terbaru > Artifacts.)
5. Pasang di HP: buka APK, izinkan "Pasang dari sumber ini", bila ada peringatan Play Protect pilih "Tetap pasang".
6. Update aplikasi: ubah `www/index.html` di GitHub (ikon pensil) atau unggah ulang, lalu commit. Build baru dibuat otomatis dan bisa dipasang menimpa versi lama selama `debug.keystore` tetap dipakai.

## Bagian 2. Suara Microsoft Edge (Cloudflare Worker)
Aplikasi tidak bisa menyambung langsung ke layanan Edge TTS (butuh header khusus), jadi dipakai Cloudflare Worker gratis (batas gratis 100.000 permintaan per hari, cukup untuk membaca).
1. Buka https://dash.cloudflare.com, daftar atau masuk (gratis, cukup email).
2. Menu kiri: **Workers & Pages** > **Create application** > **Create Worker**.
3. Isi nama `edge-tts`, klik **Deploy** (kode contoh "Hello World" boleh dibiarkan dulu).
4. Setelah muncul "Congratulations", klik **Edit code**.
5. Di editor, pilih semua kode (Ctrl+A, di HP tekan lama lalu Select all) dan hapus.
6. Buka `edge-tts-worker.js`, salin seluruh isinya, tempel ke editor.
7. Klik **Deploy** di kanan atas, lalu **Save and deploy** bila diminta.
8. Salin alamat Worker, bentuknya `https://edge-tts.NAMAMU.workers.dev`.
9. Tes di browser: buka alamat itu ditambah `/?text=Halo apa kabar&voice=id-ID-ArdiNeural`. Harus terdengar suara atau terunduh file mp3.
10. Di aplikasi: mulai TTS (ikon speaker) > ikon pengaturan suara > Mesin suara: Microsoft Edge (online) > tempel alamat Worker (tanpa `/?text=...`) > pilih suara (Ardi atau Gadis untuk bahasa Indonesia).
11. Opsional: isi `EDGE_URL_DEFAULT` di `www/index.html` dengan alamat Worker, commit, agar tidak perlu mengetik lagi.

Masalah umum:
- Halaman "Error 1101": kode tertempel tidak lengkap. Ulangi langkah 5 sampai 7.
- Tes menampilkan "Gagal terhubung ke Edge TTS (403)": layanan Edge menolak permintaan, biasanya karena versi token berubah. Coba lagi nanti.
- Suara tidak keluar di aplikasi: pastikan alamat Worker benar dan HP online. Aplikasi otomatis memakai suara perangkat bila Edge gagal.
- Suara Edge adalah layanan tidak resmi dan bisa berubah sewaktu-waktu.

## Bagian 3. TTS bawaan dan kontrol di notifikasi
Folder `native/` berisi plugin Android (TTS bawaan perangkat + notifikasi pemutar dengan tombol Sebelumnya, Putar/Jeda, Berikutnya, Berhenti). Workflow memasangnya otomatis lewat `native/apply.sh`. Saat pertama kali TTS dimulai, izinkan notifikasi. Agar pembacaan tidak terhenti di latar belakang, matikan penghematan baterai untuk aplikasi ini.

## Pemecahan masalah
- **Build merah:** buka run yang gagal, lihat langkah yang berwarna merah, lalu kirim tangkapan layarnya.
- **Gagal pasang karena "paket bertentangan":** hapus aplikasi lama dulu (tanda tangan berbeda), lalu pasang lagi.
- **Tombol Pilih file ebook tidak merespons:** pastikan memakai APK hasil build ini, bukan tab browser.
