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

export function getUpdateMessage() {
   const customUpdates = getCustomUpdates()
   let customText = ''
   if (customUpdates.length > 0) {
      customText = '\n\n' + frame('NOTA KEMASKINI TAMBAHAN', customUpdates.map(u => `• [${u.date}] ${u.note}`))
   }

   const header = `📢 *INFO UPDATE TERBARU BOT DENIA* 📢\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏷️ *Versi*: v2.8.0 (GPT-5 AI & Creative Media Release)\n` +
      `📅 *Tarikh*: 25 Oktober 2026\n` +
      `👑 *Owner*: Kaizas (カイザ)`

   const fiturBaru = frame('FITUR BAHARU', [
      '🎨 .imgedit — AI Image Edit! Hantar gambar + arahan untuk ubah gaya (anime, sinematik, tukar latar & lain-lain), atau reply gambar terus.',
      '🧠 .ai <soalan> — Tanya apa sahaja! AI GPT-5 jawab dengan langkah terperinci — matematik, logik, sains & analisis.',
      '🛠️ .aidebug <kod> — Semak & betulkan kod pengaturcaraan anda secara automatik oleh AI.',
      '✨ .amprem kini boleh guna dalam Group — Klaim Alight Motion Premium terus dari Group, lengkap panduan gambar 5 langkah.'
   ])

   const penambahbaikan = frame('PEMBAIKAN & KESELAMATAN', [
      '🤖 Denia AI naik taraf ke enjin GPT-5 — Lebih bijak, boleh selesaikan soalan kompleks & semak jawapan sendiri.',
      '🛡️ Keselamatan Owner dipertingkat — Tiada lagi celah pemalsuan ID; pengesahan menggunakan nombor tepat.',
      '🔒 Broadcast lebih selamat — Kunci serentak aktif untuk elak mesej berganda & pengasingan ralat bagi setiap penerima.',
      '🖼️ Panduan .amprem dengan gambar — Imej panduan rasmi dipaparkan di setiap langkah klaim.'
   ])

   return `${header}\n\n${fiturBaru}\n\n${penambahbaikan}${customText}\n\n*Denia Bot • Automated WhatsApp Assistant 🌸*`
}

export default {
   command: ['infoupdate', 'update', 'changelog', 'patchnotes', 'news'],
   category: 'other',
   async run(m, { db, isPrefix, command, text, isOwner }) {
      try {
         const args = (text || '').trim().split(/\s+/)
         const action = args[0]?.toLowerCase()

         // Owner action to toggle auto broadcast: .infoupdate auto on / off
         if (isOwner && (action === 'auto' || action === 'autoupdate')) {
            const opt = args[1]?.toLowerCase()
            const setting = db.getSetting()
            if (opt !== 'on' && opt !== 'off') {
               const status = setting.autoUpdateBroadcast !== false ? 'AKTIF (ON)' : 'DIMATIKAN (OFF)'
               return m.reply(`📢 *Auto Broadcast Info Update*\n\nStatus Semasa: *${status}*\n\n👉🏻 *Cara Penggunaan*:\n• \`\`\`${isPrefix + command} auto on\`\`\` (Aktifkan)\n• \`\`\`${isPrefix + command} auto off\`\`\` (Matikan)\n\n_Boleh juga guna arahan:_\n• \`\`\`${isPrefix}infoupdateauto on / off\`\`\``)
            }
            const isActivating = opt === 'on'
            setting.autoUpdateBroadcast = isActivating
            await db.writeToFile()
            return m.reply(`✅ Berjaya ${isActivating ? 'mengaktifkan' : 'mematikan'} auto broadcast info update ke semua group semasa bot bermula.`)
         }

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

         const fullMessage = getUpdateMessage()
         const ownerGuide = isOwner
            ? `\n\n💡 *Tips Owner*: Taip \`\`\`${isPrefix + command} add <teks>\`\`\` untuk menambah nota kemas kini baharu secara pantas.`
            : ''

         await m.reply((fullMessage + ownerGuide).trim(), {
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
