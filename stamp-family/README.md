# Buku Keluarga

Aplikasi keluarga berbasis **Go + HTMX + SQLite** dengan app shell PWA dan penyimpanan lokal offline-first. Selain koleksi stamp dan hadiah, keluarga dapat membuat jurnal harian seperti postingan media sosial (teks, gambar, beberapa foto/video), melihat agenda dan tugas bersama dalam kalender bulanan, berbagi kenangan, memberi reaksi/komentar, membuat tantangan, dan melihat rangkuman memori tujuh hari terakhir.

## Fitur utama

- **Jurnal harian offline-first:** tulis atau gambar kenangan berdasarkan tanggal. Catatan bersama masuk antrean perangkat saat offline dan disinkronkan ketika tersambung kembali.
- **Postingan foto dan video:** satu jurnal dapat memuat hingga enam lampiran. Foto dikompres di perangkat; video MP4/WebM maksimal 4 MB per file. Lampiran hanya disajikan ke anggota keluarga yang berhak; server publik harus memakai HTTPS.
- **Kanvas jurnal:** warna pena, ukuran kuas, penghapus, urungkan, dan latar putih, titik-titik, garis, atau gradasi lembut.
- **Ruang mewarnai:** galeri gambar anak, kuas, spidol, pensil, ember cat, penghapus, palet warna, urungkan, unduh PNG, dan simpan langsung sebagai jurnal pribadi atau bersama.
- **Privasi dan kebersamaan:** tiap catatan dapat dibagikan kepada keluarga atau disimpan pribadi. Catatan pribadi tetap di IndexedDB perangkat dan tidak pernah dikirim ke server. Catatan bersama mendukung reaksi dan komentar keluarga.
- **Prompt harian opsional:** ide menulis berubah per tanggal, dapat dipakai untuk memulai cerita, atau dilewati.
- **Tantangan keluarga:** anggota dapat membuat ajakan bertanggal; jawaban berupa tulisan/gambar ditautkan ke tantangan dan tampil di galeri kenangan.
- **Kalender keluarga:** buat kegiatan atau tugas pada tanggal dan jam tertentu, lalu tugaskan ke satu akun anggota atau seluruh keluarga. Tampilan kalender bulanan menampilkan agenda berdasarkan tanggal.
- **Tampilan grid playful:** navigasi utama menggunakan kartu-kartu berwarna dengan tata letak responsif.
- **Memori mingguan:** ringkasan otomatis jumlah kenangan dan hari yang terisi dalam tujuh hari terakhir.
- **Penghargaan:** profil anak, alasan/desain stamp, koleksi, hadiah, dan penukaran tetap tersedia.

## Jalankan

Memerlukan Go 1.26+.

```sh
cd /workspace/stamp-family
go run . create-admin -family "Nama Keluarga" -username admin
# Catat password awal yang dicetak satu kali.
go run .
```

Buka `http://localhost:8080`, masuk dengan akun admin, lalu tambahkan anak, alasan, desain stamp, dan hadiah di tab **Pengaturan**. Admin dapat membuat akun anggota atau admin tambahan; setiap akun terikat ke tepat satu keluarga.

Opsi CLI:

```sh
go run . help
go run . create-admin -family "Nama Keluarga" -username admin
STAMP_DB=/lokasi/data.db STAMP_ADDR=:8080 go run .
```

Secara default database berada di `stamp-family.db` pada direktori kerja. `COOKIE_SECURE=true` perlu dipakai bila server berada di balik HTTPS. Untuk server publik, gunakan reverse proxy HTTPS; binary ini tidak menyediakan TLS.

## Tes otomatis

Tes Go mencakup sinkronisasi idempoten, isolasi keluarga, validasi gambar/media, penugasan kalender lintas keluarga, dan aturan stamp/hadiah:

```sh
go test ./...
```

Suite Playwright di repo menguji login, semua menu pada lebar ponsel, navigasi bawah, alur jurnal/kanvas/mewarnai, ember cat dan unduhan, privasi karya pribadi, sinkronisasi offline, kalender, tantangan, komentar/reaksi, stamp/hadiah, isolasi keluarga, otorisasi, validasi request, perlindungan same-origin, dan escaping XSS. Harness menjalankan server dengan database sementara terpisah, lalu membersihkan database dan binary uji setelah suite selesai; `preview-demo.db` tidak dipakai.

```sh
npm install
npx playwright install chromium
npm test
# alias: npm run test:e2e
```

## Arsitektur dan privasi

- **Go** menangani halaman, login, sesi, validasi dan sinkronisasi. **HTMX** digunakan untuk form login; JavaScript kecil mengelola app shell, IndexedDB, antrean offline, dan tampilan.
- **SQLite** adalah sumber data server. Semua query dan mutasi keluarga dicakup ke `family_id` milik sesi. Migrasi skema menambah tabel media serta kolom kalender tanpa menghapus data lama.
- **IndexedDB** menyimpan snapshot keluarga yang sudah dimuat dan antrean operasi. Operasi dikirim berurutan; ID unik membuat pengiriman ulang idempoten. Server mengirim snapshot kanonis sesudah sinkronisasi.
- Jurnal pribadi tidak masuk antrean jaringan. Jurnal bersama, media, komentar, reaksi, aktivitas kalender, serta jawaban tantangan disinkronkan dengan cakupan satu keluarga. Data file media dikirim terpisah dari operasi sinkronisasi kecil dan dapat antre offline.
- Foto jurnal dikompres maksimal 700 KiB; video MP4/WebM maksimal 4 MiB per file; satu jurnal maksimal enam lampiran dan total 6 MiB. Signature file diperiksa server, dan endpoint media mensyaratkan sesi serta keanggotaan keluarga. Gambar kanvas lama tetap maksimal 128 KiB. Stamp adalah catatan peristiwa; penukaran diperiksa di transaksi server untuk mencegah saldo negatif.
- Password memakai bcrypt, token sesi acak disimpan dalam bentuk hash, dan cookie sesi `HttpOnly`/`SameSite=Lax`.

Login pertama dan pemuatan data keluarga pertama harus dilakukan online. Setelah data tersimpan pada browser/perangkat, app shell dapat dibuka offline. Antrean yang menunggu akan dikirim kembali ketika perangkat tersambung dan sesi masih berlaku. Perubahan dari perangkat lain baru terlihat setelah sinkronisasi.

## Batasan

Belum ada edit/hapus data, reset password, pencabutan akun, pemulihan akun, MFA, pengiriman undangan email, paginasi, backup otomatis, atau antarmuka penyelesaian konflik. Catatan pribadi hanya ada pada perangkat tempat catatan dibuat. Username unik secara global. Ini tetap MVP dan belum layak dianggap siap produksi tanpa rate limit, backup, pemantauan, dan hardening deployment.

Untuk backup, hentikan penulisan atau gunakan mekanisme backup SQLite yang konsisten; salin database bersama berkas `-wal`/`-shm` hanya sebagai satu snapshot konsisten. Untuk beberapa instance/server atau beban lebih besar, pertimbangkan PostgreSQL dan strategi konflik yang eksplisit.
