# 🖥️ DENIA-MD • PC Agent Bridge (Cloudflare Edition)

PC Agent ialah mikroservis tempatan yang berjalan pada PC anda untuk membolehkan Web Dashboard di **Cloudflare Pages** berkomunikasi dan mengawal bot WhatsApp DENIA-MD tanpa mendedahkan port atau IP komputer anda terus kepada internet awam.

---

## 🔒 Prinsip Keselamatan Utama
1. **Tiada Port Terdedah Terus**:
   - PC Agent mendengar pada `127.0.0.1:4000` secara tempatan.
   - **JANGAN sesekali membuat Port Forwarding pada router anda.**
   - Sambungan keluar diuruskan secara selamat oleh **Cloudflare Tunnel (`cloudflared`)**.
2. **Tiada Command Shell Bebas**:
   - PC Agent hanya menerima 3 arahan khusus yang telah disahkan: `start`, `stop`, dan `restart` untuk proses `node index.js`.
   - Sebarang kod atau arahan luaran disekat secara langsung.
3. **Pengesahan Bearer Token**:
   - Setiap permintaan daripada Web Dashboard Cloudflare wajib menyertakan pengepala:
     `Authorization: Bearer <AGENT_SECRET_TOKEN>`

---

## ⚙️ Pemasangan & Persediaan

### 1. Masuk ke Folder PC Agent
```bash
cd pc-agent
```

### 2. Sediakan Kredensial Selamat (.env)
Salin `.env.example` ke `.env`:
```bash
cp .env.example .env
```
Isikan nilai token keselamatan unik anda:
```env
AGENT_PORT=4000
AGENT_HOST=127.0.0.1
AGENT_SECRET_TOKEN=masukkan_token_rahsia_panjang_anda_di_sini
```

### 3. Jalankan PC Agent
```bash
node agent.js
```
Konsol akan memaparkan:
```text
===============================================
🚀 DENIA-MD PC AGENT SEDIA
📡 URL Tempatan: http://127.0.0.1:4000
🔒 Keselamatan : Dilindungi Bearer Token
===============================================
```

---

## 🌐 Menghubungkan ke Cloudflare Pages (Melalui Cloudflare Tunnel)

Untuk menyambungkan PC Agent anda ke Cloudflare Pages dengan domain custom anda:
1. Pasang `cloudflared` pada PC anda (arahan: `winget install Cloudflare.cloudflared`).
2. Sambungkan tunnel rasmi ke subdomain domain anda (contoh: `agent.DOMAIN_SAYA`).
3. Tetapkan `PC_AGENT_URL` di tetapan Cloudflare Pages kepada: `https://agent.DOMAIN_SAYA`.
4. Rujuk panduan lengkap di folder `cloudflared/` atau `PANDUAN_MIGRASI_CLOUDFLARE.md`.
