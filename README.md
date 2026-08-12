# 🌟 Stamp Collector

A playful offline-first PWA for parents to reward children with collectible stamps.
Give stamps for good deeds, build a collection, trade them for rewards —
all without an account, without a cloud, and without an internet connection.

> Built with F#, Fable, Elmish, and Feliz. Because parenting apps don't have to be boring,
> and functional programming doesn't have to be intimidating.
---

Demo at : [stamp.rafs.my.id](https://stamp.rafs.my.id)

---

🇮🇩 [Baca dalam Bahasa Indonesia](#-stamp-collector-1) · 🇬🇧 English below

---

## Features

- 🎁 **Give stamps** — select a child, pick a reason, choose an emoji stamp, tap give — full-screen burst animation + synthesized chime plays on every award
- 🏆 **Collections** — each child has their own stamp album; tap any stamp to replay the award animation
- 🎖️ **Rewards** — set up prizes (a stamp cost + emoji + name), redeem when a child earns enough
- 🗂️ **Fully managed** — add/remove children, stamp designs, reasons, and rewards from a hamburger menu; nothing is hardcoded
- 🔄 **P2P sync[TBD]** — sync data between two parent devices directly over WebRTC; no data stored on the server
- 📵 **Offline-first** — everything works without internet; data lives in IndexedDB on each device
- 📱 **Installable PWA** — add to home screen on Android or iOS, feels like a native app

---

## Tech stack

| Layer | Technology |
|---|---|
| Language | F# |
| Frontend | [Fable](https://fable.io) + [Elmish](https://elmish.github.io) + [Feliz](https://zaid-ajaj.github.io/Feliz/) |
| Bundler | Vite + vite-plugin-pwa |
| Persistence | IndexedDB (via plain-JS wrapper) |
| P2P sync | WebRTC DataChannel + thin Giraffe signaling server |
| Backend (signal only) | F# / [Giraffe](https://github.com/giraffe-fsharp/Giraffe) on .NET 10 |
| Reverse proxy | Caddy |
| Sound | Web Audio API (fully synthesized, no audio files) |

---

## Project structure

```
stamp-collector/
├── stamp-app/               # Fable PWA client
│   ├── src/
│   │   ├── Types.fs         # Domain types + CRDT merge logic
│   │   ├── Icons.fs         # 60-emoji preset list (6 categories)
│   │   ├── Storage.fs       # IndexedDB persistence bindings
│   │   ├── Sound.fs         # Web Audio synthesis bindings
│   │   ├── WebRtc.fs        # WebRTC client bindings
│   │   ├── App.fs           # Elmish Model / Msg / init / update
│   │   ├── View.fs          # Feliz UI — all 8 screens
│   │   ├── Program.fs       # Elmish entry point
│   │   ├── sound.js         # Web Audio implementation (plain JS)
│   │   ├── storage.js       # IndexedDB implementation (plain JS)
│   │   ├── webrtc.js        # WebRTC + signaling client (plain JS)
│   │   └── timing.js        # Promise sleep helper
│   ├── StampApp.fsproj
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── stamp-signal/            # Giraffe signaling server (thin, no DB)
│   ├── src/
│   │   ├── Types.fs
│   │   ├── Store.fs
│   │   ├── Handlers.fs
│   │   └── Program.fs
│   ├── StampSignal.fsproj
│   └── stamp-signal.service
│
└── docs/
    ├── ARCHITECTURE.md
    └── screenshots/
```

---

## Getting started

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org)

### Run locally

```bash
cd stamp-app
dotnet tool restore   # install Fable CLI (once)
npm install
npm start             # http://localhost:5173
```

On first launch the app walks you through adding children, reasons, and stamps before the main screen appears.

### Run the signaling server (optional — only needed for P2P sync)

```bash
cd stamp-signal
dotnet run
# http://localhost:5050
```

Update `signalBaseUrl` in `stamp-app/src/App.fs` to `http://localhost:5050` for local dev.

---

## Deploying to a VPS

**1. Build the PWA**
```bash
cd stamp-app && npm run build
# → stamp-app/dist/
```

**2. Publish the signaling server**
```bash
cd stamp-signal
dotnet publish -c Release -o /opt/stamp-signal
```

**3. Caddy config**
```caddy
stamp.yourdomain.com {
    reverse_proxy /signal/* localhost:5050
    root * /var/www/stamp-app/dist
    file_server
    try_files {path} /index.html
}
```

**4. Enable the systemd service**
```bash
cp stamp-signal/stamp-signal.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now stamp-signal
```

**5. Update config before building for production**
- `stamp-app/src/App.fs` → `signalBaseUrl`
- `stamp-signal/src/Program.fs` → CORS `WithOrigins`

Full deploy guide: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## How P2P sync works

The signaling server only brokers the WebRTC handshake — it never sees stamp data.

1. Parent A → **☰ → Sync → Share a code** — 6-character code appears (e.g. `A7X3K2`)
2. Parent B → **☰ → Sync → Enter a code** — types the code, taps Connect
3. WebRTC data channel opens directly between the two devices
4. Both sides exchange AppData JSON and run a **CRDT set-union merge**
5. Both sides save the merged result to IndexedDB

---

## Design decisions

**Why F# + Fable?** Strong types catch bugs at compile time, Elmish makes state easy to reason about, and the output is a small, fast PWA (~150KB gzipped).

**Why synthesized sound?** Zero external dependencies, works offline, fully tunable. No audio files, no licenses, no network requests.

**Why a self-hosted signaling server?** The server is ~200 lines of F# with no database. It costs nothing beyond the VPS you already pay for and keeps all data under your control.

**Why soft delete?** P2P sync means two devices can diverge independently. Soft delete ensures deletions propagate correctly on the next sync instead of being overwritten.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT — see [LICENSE](LICENSE).

---
---

# 🌟 Stamp Collector

Aplikasi PWA offline-first yang menyenangkan untuk orang tua memberikan stamp (stempel) kepada anak-anak sebagai bentuk apresiasi.
Berikan stamp untuk perbuatan baik, bangun koleksi, dan tukarkan dengan hadiah —
semua tanpa akun, tanpa cloud, dan tanpa koneksi internet.

> Dibangun dengan F#, Fable, Elmish, dan Feliz. Karena aplikasi parenting tidak harus membosankan,
> dan functional programming tidak harus rumit.

---

## Fitur

- 🎁 **Berikan stamp** — pilih anak, pilih alasan, pilih emoji stamp, tekan berikan — animasi layar penuh + suara chime terdengar setiap kali stamp diberikan
- 🏆 **Koleksi** — setiap anak punya album stamp sendiri; ketuk stamp mana saja untuk memutar ulang animasi penghargaan
- 🎖️ **Hadiah** — buat daftar hadiah (jumlah stamp yang diperlukan + emoji + nama), tukarkan saat anak sudah cukup mengumpulkan stamp
- 🗂️ **Sepenuhnya dapat dikonfigurasi** — tambah/hapus anak, desain stamp, alasan, dan hadiah dari menu hamburger; tidak ada yang dikodekan langsung
- 🔄 **Sinkronisasi P2P** — sinkronkan data antara dua perangkat orang tua langsung via WebRTC; tidak ada data yang disimpan di server
- 📵 **Offline-first** — semua fitur berjalan tanpa internet; data tersimpan di IndexedDB pada masing-masing perangkat
- 📱 **PWA yang bisa diinstal** — tambahkan ke layar utama di Android atau iOS, terasa seperti aplikasi native

---

## Teknologi

| Layer | Teknologi |
|---|---|
| Bahasa | F# |
| Frontend | [Fable](https://fable.io) + [Elmish](https://elmish.github.io) + [Feliz](https://zaid-ajaj.github.io/Feliz/) |
| Bundler | Vite + vite-plugin-pwa |
| Penyimpanan | IndexedDB (via wrapper JS) |
| Sinkronisasi P2P | WebRTC DataChannel + server sinyal Giraffe yang ringan |
| Backend (sinyal saja) | F# / [Giraffe](https://github.com/giraffe-fsharp/Giraffe) di .NET 10 |
| Reverse proxy | Caddy |
| Suara | Web Audio API (disintetisasi, tanpa file audio) |

---

## Cara menjalankan

### Prasyarat

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org)

### Jalankan secara lokal

```bash
cd stamp-app
dotnet tool restore   # install Fable CLI (sekali saja)
npm install
npm start             # http://localhost:5173
```

Saat pertama kali dijalankan, aplikasi akan memandu kamu untuk menambahkan anak, alasan, dan stamp sebelum masuk ke layar utama.

### Jalankan server sinyal (opsional — hanya diperlukan untuk fitur sinkronisasi P2P)

```bash
cd stamp-signal
dotnet run
# http://localhost:5050
```

Perbarui `signalBaseUrl` di `stamp-app/src/App.fs` ke `http://localhost:5050` untuk development lokal.

---

## Deploy ke VPS

**1. Build PWA**
```bash
cd stamp-app && npm run build
# → stamp-app/dist/
```

**2. Publish server sinyal**
```bash
cd stamp-signal
dotnet publish -c Release -o /opt/stamp-signal
```

**3. Konfigurasi Caddy**
```caddy
stamp.domainmu.com {
    reverse_proxy /signal/* localhost:5050
    root * /var/www/stamp-app/dist
    file_server
    try_files {path} /index.html
}
```

**4. Aktifkan systemd service**
```bash
cp stamp-signal/stamp-signal.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now stamp-signal
```

**5. Perbarui konfigurasi sebelum build untuk production**
- `stamp-app/src/App.fs` → `signalBaseUrl`
- `stamp-signal/src/Program.fs` → CORS `WithOrigins`

Panduan deploy lengkap: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## Cara kerja sinkronisasi P2P [TBD]

Server sinyal hanya memfasilitasi handshake WebRTC — tidak pernah melihat data stamp kamu.

1. Orang tua A → **☰ → Sync → Share a code** — kode 6 karakter muncul (misal `A7X3K2`)
2. Orang tua B → **☰ → Sync → Enter a code** — ketik kode tersebut, tekan Connect
3. Data channel WebRTC terbuka langsung antara dua perangkat
4. Kedua sisi saling tukar AppData JSON dan menjalankan **CRDT set-union merge**
5. Kedua sisi menyimpan hasil merge ke IndexedDB masing-masing

---

## Keputusan desain

**Kenapa F# + Fable?** Type yang kuat menangkap bug saat kompilasi, Elmish membuat state mudah dipahami, dan hasilnya adalah PWA yang kecil dan cepat (~150KB gzipped).

**Kenapa suara disintetisasi?** Nol dependensi eksternal, bekerja offline, bisa disesuaikan sepenuhnya. Tidak ada file audio, tidak ada lisensi, tidak ada network request.

**Kenapa server sinyal self-hosted?** Server hanya ~200 baris F# tanpa database. Tidak ada biaya tambahan selain VPS yang sudah kamu miliki, dan semua data tetap di bawah kendalimu.

**Kenapa soft delete?** Sinkronisasi P2P berarti dua perangkat bisa berbeda secara independen. Soft delete memastikan penghapusan data ikut terpropagasi dengan benar saat sinkronisasi berikutnya, bukan tertimpa begitu saja.

---

## Kontribusi

Lihat [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Lisensi

MIT — lihat [LICENSE](LICENSE).
