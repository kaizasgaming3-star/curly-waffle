/**
 * Panduan Penggunaan dan Pemasangan DENIA-MD
 * Digunakan untuk melihat langkah pemasangan di Hosting & Termux
 */

export default {
   command: ['carapakai', 'panduan', 'howtouse', 'deployguide'],
   category: 'other',
   async run(m) {
      const text = `📖 *PANDUAN MENJALANKAN DENIA-MD*

🌐 *A. DI BOT-HOSTING.NET / PANEL:*
1. Muat naik fail *DeniaMD.zip* ke panel hosting dan ekstrak.
2. Pastikan versi pelayan (Egg/Image) menggunakan *Node.js 20 atau 22*.
3. Buka tab *Console / Terminal*, jalankan:
   \`npm install --omit=dev\`
4. Tekan butang *Start* (atau jalankan \`npm start\`).
5. Imbas QR atau masukkan kod Pairing yang dipaparkan di konsol.

📱 *B. DI TERMUX ANDROID:*
1. Pasang pakej asas (jika belum):
   \`pkg update -y && pkg install nodejs-lts ffmpeg -y\`
2. Ekstrak fail zip ke dalam folder:
   \`unzip DeniaMD.zip -d DeniaMD\`
   \`cd DeniaMD\`
3. Pasang dependency bot:
   \`npm install --omit=dev\`
4. Jalankan bot:
   \`npm start\`

⚠️ *Peringatan Penting:*
- Jangan padam folder *packages/* kerana pakej Baileys berada di dalamnya secara tempatan (offline).
- Untuk peranti Android/Termux, pastikan Node.js adalah versi LTS (Node 20+).`

      m.reply(text)
   }
}

