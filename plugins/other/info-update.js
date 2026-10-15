import fs from 'fs'
import path from 'path'
import { fetchThumbnail, frame, greeting } from '../../lib/Utilities.js'

const updatesDbPath = path.resolve('database/updates.json')

function getCustomUpdates() {
   try {
      if (!fs.existsSync(updatesDbPath)) return []
      return JSON.parse(fs.readFileSync(updatesDbPath, 'utf8'))
   } catch {
      return []
   }
}

function saveCustomUpdates(data) {
   try {
      const dir = path.dirname(updatesDbPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(updatesDbPath, JSON.stringify(data, null, 2), 'utf8')
   } catch (err) {
      console.error('[Updates DB Error]:', err.message)
   }
}

export default {
   command: ['infoupdate', 'update', 'changelog', 'patchnotes', 'news'],
   category: 'other',
   async run(m, {
      isPrefix,
      command,
      text,
      isOwner
   }) {
      try {
         const args = (text || '').trim().split(/\s+/)
         const action = args[0]?.toLowerCase()

         // Owner action to append custom update
         if (isOwner && action === 'add' && args.slice(1).length > 0) {
            const newNote = args.slice(1).join(' ')
            const existing = getCustomUpdates()
            const now = new Date()
            const dateStr = now.toLocaleDateString('ms-MY', { day: '2-digit', month: '2-digit', year: 'numeric' })
            existing.unshift({
               date: dateStr,
               note: newNote
            })
            saveCustomUpdates(existing.slice(0, 20))
            return m.reply(`✅ Berjaya menambah info update baru:\n> ${newNote}`)
         }

         if (isOwner && action === 'clear') {
            saveCustomUpdates([])
            return m.reply('🗑️ Senarai custom update telah dikosongkan.')
         }

         const customUpdates = getCustomUpdates()

         let customText = ''
         if (customUpdates.length > 0) {
            customText = '\n\n' + frame('NOTA KEMASKINI TAMBAHAN', customUpdates.map(u => `• [${u.date}] ${u.note}`))
         }

         const header = `📢 *INFO UPDATE TERBARU BOT DENIA* 📢\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🏷️ *Versi*: v2.5.2 (Latest Release)\n` +
            `📅 *Tarikh*: Oktober 2026\n` +
            `👑 *Owner*: Kaizas (カイザ)`

         const fiturBaru = frame('FITUR BAHARU', [
            '🎬 .t2mp4 / .text2mp4 — Buat video animasi teks bergerak terus ke format MP4 (Text to MP4).',
            '🌊 Integrasi Penuh Denia AI — Denia AI boleh menggunakan semua fitur bot secara automatik dalam chat.',
            '🎭 Sistem 7 Emosi Denia — Visual ekspresi dinamik mengikut nada perbualan (Happy, Love, Shy, Sad, Cool, dll).',
            '💍 Mod Suami Sah (Kaizas) — Layanan manja & mesra eksklusif hanya untuk Kaizas, tegas menolak godaan luar.',
            '🔒 Sokongan Akaun LID — Serasi sepenuhnya dengan kemas kini sistem privasi ID WhatsApp moden.'
         ])

         const penambahbaikan = frame('PEMBAIKAN & PENALAAN', [
            '⚡ Enjin Pembuat Stiker (.stiker) diperkukuh, muat turun lebih lancar dan pantas.',
            '👥 Penalaan Fitur Pengurusan Group (.kick, .add) lebih stabil.',
            '🛡️ Pemeliharaan Sesi Sambungan — Mengelakkan bot terputus atau perlu daftar semula.'
         ])

         const ownerGuide = isOwner
            ? `\n\n💡 *Tips Owner*: Taip ```${isPrefix + command} add <teks>``` untuk menambah nota kemas kini baharu secara pantas.`
            : ''

         const fullMessage = `${header}\n\n${fiturBaru}\n\n${penambahbaikan}${customText}${ownerGuide}\n\n*Denia AI • Resonator Wuthering Waves 🌸*`

         await m.reply(fullMessage.trim(), {
            thumbnail: await fetchThumbnail(),
            largeThumbnail: true
         })
      }
      catch (error) {
         console.error('[InfoUpdate Error]:', error)
         m.reply('❌ Ralat memaparkan info update: ' + error.message)
      }
   }
}
