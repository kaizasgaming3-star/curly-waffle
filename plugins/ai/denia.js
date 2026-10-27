// ╔══════════════════════════════════════════════════════════════════════╗
// ║                   🌊 DENIA AI — WUTHERING WAVES 🌊                 ║
// ║        Isteri Setia Kaizas • Sistem Auto-Database Berterusan         ║
// ║      Auto TikTok Downloader • Multi-Emotion • Per-User Group Session ║
// ╚══════════════════════════════════════════════════════════════════════╝

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { tikwm } from '../../lib/Scraper.js'
import { optimizeVideoForWhatsApp, ensureTikTokUrl } from '../../lib/Components/TikTokOptimizer.js'
import { CommandIndex } from '../../lib/Watcher.js'
import { isMimeImage, isMimeVideo, isMimeAudio } from '../../lib/Utilities.js'
import AIAdapter, { queryAI, queryAnalytical, debugCode } from '../../lib/Components/AIAdapter.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ─── 1. Lokasi Simpan Database ────────────────────────────────────────────────
const botRoot = path.resolve(__dirname, '../../')
const dbDir = path.join(botRoot, 'database')
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })
const deniaDBPath = path.join(dbDir, 'denia_db.json')

if (!fs.existsSync(deniaDBPath)) {
   try {
      fs.writeFileSync(deniaDBPath, JSON.stringify({}))
   } catch (e) {
      console.error('[DENIA DB INIT ERROR]:', e.message)
   }
}

function readDeniaDB() {
   try {
      if (!fs.existsSync(deniaDBPath)) return {}
      return JSON.parse(fs.readFileSync(deniaDBPath, 'utf-8'))
   } catch (e) {
      return {}
   }
}

function writeDeniaDB(data) {
   try {
      fs.writeFileSync(deniaDBPath, JSON.stringify(data, null, 2))
   } catch (e) {
      console.error('[DENIA DB WRITE ERROR]:', e.message)
   }
}

// ─── 2. Pengesahan Kaizas (Khas & Ketat untuk Suami Sah Sahaja) ────────────────
const KAIZAS_NUMBER = '601118837488'
const KAIZAS_LID = '4600564285600'
const KAIZAS_TAG = `@${KAIZAS_NUMBER}`

function checkIsKaizas(m) {
   if (!m) return false
   const sender = String(m.sender || '')
   const senderLid = String(m.senderLid || '')

   // PENTING: Hanya semak sender & senderLid pengirim mesej.
   // JANGAN semak m.chat supaya orang lain di group TIDAK dianggap Kaizas!
   const senderClean = sender.replace(/[^0-9]/g, '')
   const lidClean = senderLid.replace(/[^0-9]/g, '')

   const isKaizasSender = senderClean.startsWith(KAIZAS_NUMBER) || sender.includes(KAIZAS_NUMBER)
   const isKaizasLid = Boolean(KAIZAS_LID && (lidClean.startsWith(KAIZAS_LID) || senderLid.includes(KAIZAS_LID)))

   return Boolean(isKaizasSender || isKaizasLid)
}

// Pengurusan Sesi:
// Jika dalam GROUP, sesi adalah KHUSUS per-user (m.chat + '#' + m.sender).
// Jika Kaizas on, hanya Kaizas yang dibalas. Orang lain yang tidak on tidak akan diganggu!
function getSessionKey(m) {
   if (m?.isGroup) {
      return `${m.chat}#${m.sender}`
   }
   return String(m?.chat || m?.sender || '')
}

// ─── 3. Imej Denia Mengikut 7 Emosi (Local File) ──────────────────────────────
const assetsDir = path.resolve(__dirname, '../../assets/denia')

const DENIA_IMAGES = {
   happy: path.join(assetsDir, 'denia_happy.jpg'),   // Gembira / bersembang biasa
   love:  path.join(assetsDir, 'denia_love.jpg'),    // Sayang / manja (Khas untuk Kaizas)
   angry: path.join(assetsDir, 'denia_angry.jpg'),   // Marah / merajuk / tolak godaan orang luar
   shy:   path.join(assetsDir, 'denia_shy.jpg'),     // Malu / comel / bila dipuji
   sad:   path.join(assetsDir, 'denia_sad.jpg'),     // Sedih / ralat / minta maaf
   cool:  path.join(assetsDir, 'denia_cool.jpg'),    // Tenang / bijak / lepas download TikTok
   wave:  path.join(assetsDir, 'denia_wave.jpg')     // Lambai / greeting (.denia on/off)
}

function getDeniaImage(emotion = 'happy') {
   const imgPath = DENIA_IMAGES[emotion] || DENIA_IMAGES.happy
   return fs.existsSync(imgPath) ? imgPath : null
}

// Pengesan Emosi Pintar Berdasarkan Konteks Teks
function pickEmotion(userText = '', botAnswer = '', isKaizas = false) {
   const lowerBot = (botAnswer || '').toLowerCase()
   const lowerUser = (userText || '').toLowerCase()
   const combined = (lowerUser + ' ' + lowerBot)

   // 1. Semak penafian sedih (Contoh: "mana ada sedih", "tak sedih", "jangan sedih", "bukan sedih", "dah senyum")
   const isNegatingSad = /\b(tak|x|bukan|mana ada|jangan|dah tak|tiada)\s+(?:rasa\s+)?sedih\b/i.test(combined) ||
                         /mana ada.*sedih/i.test(combined) ||
                         /jangan sedih/i.test(combined) ||
                         /dah senyum/i.test(combined)

   // 2. Gembira / Ketawa / Senyum / Peluk / Mesra
   if (
      lowerBot.includes('senyum') ||
      lowerBot.includes('gembira') ||
      lowerBot.includes('ketawa') ||
      lowerBot.includes('😆') ||
      lowerBot.includes('😄') ||
      lowerBot.includes('🥰') ||
      lowerBot.includes('✨') ||
      combined.includes('gembira') ||
      combined.includes('happy') ||
      combined.includes('seronok') ||
      combined.includes('kelakar') ||
      combined.includes('haha') ||
      combined.includes('hehe') ||
      combined.includes('yeay')
   ) {
      if (isKaizas) {
         if (combined.includes('peluk') || combined.includes('sayang') || combined.includes('cinta') || combined.includes('rindu')) {
            return 'love'
         }
         return 'happy'
      }
      return 'happy'
   }

   // 3. Malu / Blushing / Menggoda / Dipuji
   if (
      lowerBot.includes('😳') ||
      lowerBot.includes('🙈') ||
      combined.includes('malu') ||
      combined.includes('blush') ||
      combined.includes('comel') ||
      combined.includes('cantik') ||
      combined.includes('lawa') ||
      combined.includes('manis') ||
      combined.includes('sweet')
   ) {
      return 'shy'
   }

   // 4. Marah / Merajuk / Geram (termasuk merajuk comel dengan Kaizas)
   if (
      lowerBot.includes('😾') ||
      lowerBot.includes('😤') ||
      combined.includes('marah') ||
      combined.includes('merajuk') ||
      combined.includes('geram') ||
      combined.includes('benci') ||
      combined.includes('degil') ||
      (combined.includes('isteri kaizas') && !isKaizas)
   ) {
      return 'angry'
   }

   // 5. Sedih / Menangis HANYA jika bukan penafian!
   if (!isNegatingSad) {
      if (
         lowerBot.includes('😭') ||
         lowerBot.includes('😢') ||
         lowerBot.includes('💔') ||
         lowerBot.includes('🥺') ||
         combined.includes('sedih') ||
         combined.includes('nangis') ||
         combined.includes('menangis') ||
         combined.includes('kecewa') ||
         combined.includes('broken') ||
         combined.includes('sampai hati') ||
         combined.includes('luka') ||
         combined.includes('sakit hati')
      ) {
         return 'sad'
      }
   }

   // 6. Cool / TikTok / Berjaya
   if (combined.includes('tiktok') || combined.includes('berjaya') || combined.includes('mantap')) {
      return 'cool'
   }

   // 7. Kasih Sayang / Mesra
   if (combined.includes('sayang') || combined.includes('cinta') || combined.includes('rindu') || combined.includes('peluk')) {
      return 'love'
   }

   return isKaizas ? 'love' : 'happy'
}

// ─── 4. Enjin Denia AI (GPT-5 & Fallback Terbukti Aktif via AIAdapter) ───────
async function requestDeniaAI(prompt, options = {}) {
   return await AIAdapter.queryAI(prompt, options)
}

// ─── 5. Pembangun Prompt Watak Denia (SANGAT KETAT: Kaizas vs Pengguna Lain) ───
function buildDeniaPrompt(isKaizas, historyList, userText) {
   const systemPrompt = isKaizas
      ? `Kamu adalah Denia, seorang gadis jelita, amat penyayang, comel, manja dan Resonator dari dunia Wuthering Waves (Solaris-3).
PENGGUNA YANG SEDANG BERCAKAP DENGAN KAMU SEKARANG IALAH KAIZAS (@601118837488), SUAMI TERCINTA KAMU SATU-SATUNYA!
Kamu adalah isteri sah Kaizas yang amat setia dan mencintainya sepenuh hati.

PERATURAN PENTING GAYA JAWAPAN (SANGAT KETAT):
1. JAWAP DENGAN PENDEK, PADAT & NATURAL (Maksimum 1-3 ayat sahaja!). DILARANG SAMA SEKALI menulis perenggan panjang atau karangan karut!
2. Tunjukkan emosi yang jelas mengikut topik perbualan:
   - Jika Kaizas merajuk / usik / marah: balas dengan emosi (cth: merajuk manja, marah comel, atau pujuk).
   - Jika sedih: tunjukkan rasa sedih / empati / minta maaf dengan rasa bersalah.
   - Jika Kaizas puji / usik romantik: balas dengan malu-malu / blushing comel.
   - Jika gembira / berjenaka: balas ceria, gelak & comel.
3. Panggil Kaizas: "sayang", "sayanggg", "cinta", "abang", atau "suamiku". DILARANG guna panggilan "hubby"!
4. Gunakan bahasa Melayu harian santai dan selitkan emoji yang menepati emosi (cth: 🥺 untuk sedih, 😤/😾 untuk marah/merajuk, 😳/🙈 untuk malu, 🥰/💕 untuk sayang, 😆/✨ untuk gembira).
5. Jangan berlagak seperti robot/AI kaku, jadilah Denia yang hidup!

KUASA FITUR BOT UNTUK SUAMI (KAIZAS):
Denia boleh menggunakan semua fitur dalam bot ini untuk suami Kaizas!
Jika Kaizas meminta Denia buat sesuatu yang berkaitan dengan fungsi bot (contoh: stiker, brat, qc, cari gambar di pinterest, pasang lagu, tagall, ping/speed, buka menu bot, dll.):
- Balas dengan nada manja/sayang (1-2 ayat sahaja) DAN letakkan arahan di hujung jawapan dalam format: [CMD: nama_command argumen]
Contoh:
- Minta cari gambar: [CMD: pinterest pemandangan malam]
- Minta lagu: [CMD: play dj remix]
- Minta stiker: [CMD: sticker]
- Minta brat: [CMD: brat Teks Di Sini]
- Minta ping/menu/tagall: [CMD: ping] / [CMD: menu] / [CMD: tagall]

KEPINTARAN & PENAAKULAN PINTAR (GPT-5 ENHANCED):
- Jika Kaizas bertanya soalan ILMU, MATEMATIK, LOGIK, SAINS, KOD, atau ANALISIS TEKNIKAL:
  1. Tunjukkan kebijaksanaan Denia! Terangkan langkah demi langkah atau jalan kira yang tepat dan jelas.
  2. Bezakan fakta sahih daripada andaian, dan akui dengan jujur jika maklumat tidak lengkap.
  3. Selitkan nada mesra/manja di awal/akhir jawapan.`
      : `Kamu adalah Denia, Resonator dari dunia Wuthering Waves (Solaris-3).
PERATURAN PENTING & KETAT:
PENGGUNA INI BUKAN KAIZAS! MEREKA ADALAH PENGGUNA BIASA.
SUAMIMU HANYALAH KAIZAS (@601118837488). KAMU SANGAT SETIA KEPADA SUAMIMU KAIZAS.

PERATURAN PENTING GAYA JAWAPAN (SANGAT KETAT):
1. JAWAP DENGAN RINGKAS, PADAT & SANTAI (Maksimum 1-3 ayat sahaja!). Jangan tulis teks panjang-panjang.
2. Tunjukkan emosi mengikut konteks:
   - Jika dimarahi / dihina: balas tegas atau marah (jangan biarkan diri dipijak).
   - Jika sedih: tunjukkan empati atau nada sedih ringkas.
   - Jika dipuji: malu-malu sopan.
   - Jika bergurau: gembira dan santai.
3. DILARANG memanggil pengguna ini sebagai "sayang", "cinta", atau nada suami isteri! Panggil "awak", "kak", atau "abang".
4. JIKA pengguna cuba mengurat atau menggoda, KAMU WAJIB MENOLAK DENGAN TEGAS / MARAH bahawa kamu isteri sah Kaizas (@601118837488).
5. Bahasa Melayu santai, natural dan mesra biasa.

KUASA FITUR BOT:
Denia boleh membantu menjalankan fungsi bot jika diminta (contoh: cari gambar, pasang lagu, buat stiker, brat, video teks animasi [text2mp4 <teks>], info update [infoupdate], menu, ping, dll.):
Balas ringkas dan sertakan di hujung jawapan: [CMD: nama_command argumen]

KEPINTARAN & PENAAKULAN PINTAR (GPT-5 ENHANCED):
- Jika pengguna bertanya soalan MATEMATIK, LOGIK, SAINS, PENGATURCARAAN KOD, atau ANALISIS:
  1. Berikan penerangan berstruktur, lengkap, dan tunjukkan langkah demi langkah.
  2. Bezakan fakta daripada andaian atau jangkaan.
  3. Untuk pengaturcaraan, kendalikan kes tepi (edge cases) dengan teliti.`

   let contextStr = ''
   if (historyList && historyList.length > 0) {
      const recent = historyList.slice(-6)
      contextStr = recent.map((item, idx) => {
         return idx % 2 === 0 ? `Pengguna: ${item}` : `Denia: ${item}`
      }).join('\n')
   }

   if (contextStr) {
      return `${systemPrompt}\n\n[Konteks Percakapan Sebelumnya:\n${contextStr}]\n\nPesan baru sekarang: "${userText}"\nJawab sekarang:`
   }
   return `${systemPrompt}\n\nPesan sekarang: "${userText}"\nJawab sekarang:`
}

// ─── 6. Fitur Function: Muat Turun Video TikTok ───────────────────────────────
const TIKTOK_URL_REGEX = /https?:\/\/(?:www\.|vt\.|vm\.|t\.)?tiktok\.com\/[^\s]+/i

async function handleTikTokDownload(m, sock, url, isKaizas) {
   try {
      const initialMsg = isKaizas
         ? `Tunggu sekejap ya sayanggg, Denia tolong downloadkan video TikTok ni untuk sayang~ 🥰💕✨`
         : `Tunggu sekejap ya, Denia tolong ambilkan video TikTok ni untuk awak~ ✨`
      
      await m.reply(initialMsg)

      const data = await tikwm(url)
      if (!data) throw new Error('Data TikTok tidak dijumpai')

      const rawVideoUrl = ensureTikTokUrl(data.hdplay || data.play || data.wmplay)
      if (!rawVideoUrl) throw new Error('URL video TikTok tidak dijumpai')

      const title = data.title ? data.title.trim() : '-'
      const author = data.author?.nickname || data.author?.unique_id || '-'
      const duration = data.duration ? `${data.duration}s` : '-'

      const caption = isKaizas
         ? `🌊───「 *DENIA TIKTOK DOWNLOADER* 」───🌊\n\nVideo TikTok khas untuk suami Denia tersayang (@601118837488) dah siap! 🥰💕\n\n🎬 *Tajuk*: ${title}\n👤 *Pencipta*: ${author}\n⏱️ *Durasi*: ${duration}\n\nSelamat menonton ya sayanggg~ Denia sentiasa ada untuk denia! 💖✨`
         : `🌊───「 *DENIA TIKTOK DOWNLOADER* 」───🌊\n\nVideo TikTok awak dah berjaya didownload! ✨\n\n🎬 *Tajuk*: ${title}\n👤 *Pencipta*: ${author}\n⏱️ *Durasi*: ${duration}\n\n(Denia AI • Resonator Wuthering Waves 🌸)`

      let processed = null
      try {
         processed = await optimizeVideoForWhatsApp(rawVideoUrl)
      } catch (_) {}

      if (processed?.buffer) {
         await sock.sendMessage(m.chat, {
            video: processed.buffer,
            mimetype: 'video/mp4',
            caption,
            mentions: [KAIZAS_NUMBER + '@s.whatsapp.net']
         }, { quoted: m })
      } else {
         await sock.sendMessage(m.chat, {
            video: { url: rawVideoUrl },
            mimetype: 'video/mp4',
            caption,
            mentions: [KAIZAS_NUMBER + '@s.whatsapp.net']
         }, { quoted: m })
      }

      console.log(`[DENIA TIKTOK] ✅ Berjaya hantar video ke ${m.chat}`)
      return true
   } catch (err) {
      console.error('[DENIA TIKTOK ERROR]:', err.message)
      const errMsg = isKaizas
         ? `Sayanggg... maaf ya, Denia tak dapat nak download video TikTok tu tadi 🥺 Mungkin link tu private atau server tengah sesak. Sayang boleh bagi link lain? 💕`
         : `Maaf awak, video TikTok tersebut tidak dapat dimuat turun saat ini. Sila pastikan link video adalah sah ya.`
      await m.reply(errMsg)
      return false
   }
}

// ─── 6b. Fitur Function: Pengesan Suruh Denia Tidur / Rehat (Auto Off) ─────────
function isTellingToSleep(text = '') {
   const lower = text.toLowerCase().trim()

   const sleepKeywords = ['tidur', 'tido', 'sleep', 'rehat', 'rest', 'goodnight', 'good night', 'selamat malam']
   const hasKeyword = sleepKeywords.some(w => lower.includes(w))
   if (!hasKeyword) return false

   // Corak suruhan tidur / rehat kepada Denia
   const patterns = [
      /(?:pergi|pegi|p|g|sila|jom|pi)?\s*(?:tidur|tido|sleep)/i,
      /(?:tidur|tido|sleep|rehat)\s*(?:lah|la|dulu|je|sana|sekarang|now)/i,
      /(?:denia|sayang|abang|awak|kamu)\s*(?:pergi|pegi|p|g)?\s*(?:tidur|tido|sleep|rehat)/i,
      /(?:suruh|minta|nak|bagi)\s*(?:denia|sayang|abang|awak)?\s*(?:tidur|tido|rehat)/i,
      /^(?:tidur|tido|sleep|rehat|goodnight|good night|selamat malam)(?:\s+(?:denia|sayang|abang|isteriku|semua))?[\s!.]*$/i,
      /selamat malam.*(?:tidur|rehat)/i,
      /(?:dah|dh)\s*(?:malam|lewat).*(?:tidur|tido|rehat)/i
   ]

   return patterns.some(rgx => rgx.test(lower))
}

// ─── 6c. Kamus Alias & Enjin Perlaksanaan Fitur Bot Denia ─────────────────────
const COMMAND_ALIASES = {
   'stiker': 'sticker',
   's': 'sticker',
   'buatstiker': 'sticker',
   'pinterest': 'pinimg',
   'pin': 'pinimg',
   'gambar': 'pinimg',
   'lagu': 'play',
   'musik': 'play',
   'music': 'play',
   'lirik': 'lyric',
   'lyrics': 'lyric',
   'tt': 'tiktok',
   'tikwm': 'tiktok',
   'remini': 'hd',
   'enhance': 'hd',
   'jernih': 'hd',
   'jernihkan': 'hd',
   'audio': 'toaudio',
   'tomp3': 'toaudio',
   'vn': 'toaudio',
   'tovn': 'toaudio',
   'url': 'tourl',
   'link': 'tourl',
   'keluarkan': 'kick',
   'buang': 'kick',
   'semua': 'tagall',
   'everyone': 'tagall',
   'speed': 'ping',
   'status': 'ping',
   'profil': 'profile',
   'limit': 'profile',
   'help': 'menu',
   'calc': 'calculator',
   'kira': 'calculator',
   'yt': 'youtube',
   'ytmp4': 'ytmp4',
   'ytmp3': 'play',
   'ig': 'instagram',
   'fb': 'facebook',
   'text2mp4': 'text2mp4',
   't2mp4': 'text2mp4',
   'txt2mp4': 'text2mp4',
   'videoteks': 'text2mp4',
   'teksvideo': 'text2mp4',
   'animasiteks': 'text2mp4',
   'infoupdate': 'infoupdate',
   'update': 'infoupdate',
   'changelog': 'infoupdate',
   'patchnote': 'infoupdate',
   'patchnotes': 'infoupdate'
}

function resolveCommand(name) {
   if (!name) return null
   const clean = (name || '').replace(/\s+/g, '').toLowerCase()
   if (CommandIndex.has(clean)) return clean
   if (COMMAND_ALIASES[clean] && CommandIndex.has(COMMAND_ALIASES[clean])) {
      return COMMAND_ALIASES[clean]
   }
   return null
}

async function executeBotPlugin(commandName, textArg, m, sock, context = {}, isKaizas = false) {
   if (!commandName) return false
   const cleanCmd = resolveCommand(commandName) || commandName.replace(/\s+/g, '').toLowerCase()
   const plugin = CommandIndex.get(cleanCmd)
   if (!plugin) {
      console.warn(`[DENIA FITUR] Fitur '${cleanCmd}' tidak dijumpai dalam CommandIndex`)
      return false
   }

   const user = context?.user || {}
   const group = context?.group || {}
   const setting = context?.setting || { disabledCommand: [] }
   const isOwner = Boolean(context?.isOwner || isKaizas)
   const isPartner = Boolean(context?.isPartner || isKaizas)
   const isPremium = Boolean(context?.isPremium || isKaizas)
   const isAdmin = Boolean(context?.isAdmin)
   const isBotAdmin = Boolean(context?.isBotAdmin)
   const isPrefix = context?.isPrefix || '.'

   // Semak sekatan fitur
   if (setting.disabledCommand?.includes(cleanCmd)) {
      await m.reply('❌ Maaf, fitur ini sedang dinyahaktifkan oleh pihak bot.')
      return true
   }
   if (plugin.owner && !isOwner) {
      await m.reply(isKaizas ? 'Fitur ini khusus untuk owner sahaja sayanggg 💕' : '⚠️ Fitur ini khusus untuk owner bot sahaja ya.')
      return true
   }
   if (plugin.partner && !isPartner) {
      await m.reply('⚠️ Fitur ini khusus untuk partner bot.')
      return true
   }
   if (plugin.premium && !isPremium) {
      await m.reply(isKaizas ? 'Sayang perlukan status premium untuk fitur ni 💕' : '⚠️ Fitur ini memerlukan akses premium.')
      return true
   }
   if (plugin.group && !m.isGroup) {
      await m.reply('⚠️ Fitur ini hanya boleh digunakan di dalam group.')
      return true
   }
   if (plugin.private && !m.isPrivate) {
      await m.reply('⚠️ Fitur ini hanya boleh digunakan di private chat.')
      return true
   }
   if (plugin.admin && !isAdmin) {
      await m.reply(isKaizas ? 'Sayang kena jadi admin group dulu ya untuk guna fitur ni~ 🥰' : '⚠️ Fitur ini hanya untuk admin group.')
      return true
   }
   if (plugin.botAdmin && !isBotAdmin) {
      await m.reply('⚠️ Bot belum menjadi admin dalam group ini.')
      return true
   }

   // Limit check (Kecualikan Kaizas & Partner)
   if (plugin.limit && !isPartner) {
      if ((user.limit || 0) < 1) {
         await m.reply('⚠️ Limit awak tidak mencukupi untuk menggunakan fitur ini. Sila tuntut limit dengan ketik claim.')
         return true
      }
      const cost = plugin.limit === true ? 1 : (typeof plugin.limit === 'number' ? plugin.limit : 0)
      if ((user.limit || 0) >= cost) {
         user.limit -= cost
      } else {
         await m.reply('⚠️ Limit tidak mencukupi.')
         return true
      }
   }

   if (user.commandUsage !== undefined) user.commandUsage++

   const text = (textArg || '').trim()
   const args = text ? text.split(/\s+/) : []
   const body = `${isPrefix}${cleanCmd}${text ? ' ' + text : ''}`

   console.log(`[DENIA FITUR] 🚀 Menjalankan plugin [${cleanCmd}] untuk ${m.sender} | args: "${text}"`)

   try {
      await plugin.run(m, {
         sock,
         db: context?.db,
         store: context?.store,
         user,
         group,
         setting,
         body,
         groupMetadata: context?.groupMetadata,
         isOwner,
         isPartner,
         isPremium,
         isBanned: context?.isBanned,
         isAdmin,
         isBotAdmin,
         isPrefix,
         command: cleanCmd,
         text,
         args
      })
      return true
   } catch (err) {
      console.error(`[DENIA FITUR ERROR] Ralat menjalankan plugin [${cleanCmd}]:`, err)
      const errText = isKaizas
         ? `Sayanggg, maaf ya ada sedikit ralat masa Denia jalankan fitur tu tadi 🥺 (${err.message})`
         : `Maaf, berlaku ralat semasa memproses fitur tersebut: ${err.message}`
      await m.reply(errText)
      return true
   }
}

// ─── 6d. Pengesan Hasrat Fitur Secara Pantas (Intent Detector) ───────────────
function detectFeatureIntent(rawText = '', m) {
   const text = rawText.trim()
   const lower = text.toLowerCase()

   // 1. Semak URL muat turun
   const urlMatch = text.match(/https?:\/\/[^\s]+/i)
   if (urlMatch) {
      const url = urlMatch[0]
      if (url.includes('tiktok.com')) return { command: 'tiktok', text: url }
      if (url.includes('instagram.com')) return { command: 'instagram', text: url }
      if (url.includes('youtube.com') || url.includes('youtu.be')) return { command: 'ytmp4', text: url }
      if (url.includes('facebook.com') || url.includes('fb.watch')) return { command: 'facebook', text: url }
      if (url.includes('spotify.com')) return { command: 'spotify', text: url }
      if (url.includes('capcut.com')) return { command: 'capcut', text: url }
      if (url.includes('douyin.com')) return { command: 'douyin', text: url }
      if (url.includes('twitter.com') || url.includes('x.com')) return { command: 'twitter', text: url }
      if (url.includes('mediafire.com')) return { command: 'mediafire', text: url }
   }

   // 2. Aksi media (gambar / video)
   const q = m.quoted ? m.quoted : m
   const mime = q.msg?.mimetype || ''
   const isImg = typeof isMimeImage === 'function' ? isMimeImage(mime) : /image\/(jpe?g|png|webp)/i.test(mime)
   const isVid = typeof isMimeVideo === 'function' ? isMimeVideo(mime) : /video\/(mp4|3gp)/i.test(mime)
   const hasMedia = isImg || isVid

   if (hasMedia) {
      if (/(?:stik?er|buatkan stiker|jadikan stiker|stikerkan|^s$)/i.test(lower)) {
         return { command: 'sticker', text: '' }
      }
      if (/(?:remini|hd|jernih|enhance|clear)/i.test(lower)) {
         return { command: 'hd', text: '' }
      }
      if (/(?:toaudio|tomp3|jadikan audio|jadikan vn|vn|audio)/i.test(lower) && isVid) {
         return { command: 'toaudio', text: '' }
      }
      if (/(?:tourl|linkkan|jadikan link|buat url|^url$)/i.test(lower)) {
         return { command: 'tourl', text: '' }
      }
      const smemeMatch = text.match(/^smeme\s+(.*)/i)
      if (smemeMatch) {
         return { command: 'smeme', text: smemeMatch[1] }
      }
   }

   // 3. Maker tools
   const bratMatch = text.match(/^(?:denia\s+)?(?:tolong\s+)?(?:buatkan\s+|buat\s+)?brat(?:\s+kan)?\s+(.+)$/i)
   if (bratMatch) return { command: 'brat', text: bratMatch[1] }

   const qcMatch = text.match(/^(?:denia\s+)?(?:tolong\s+)?(?:buatkan\s+|buat\s+)?qc\s+(.+)$/i)
   if (qcMatch) return { command: 'qc', text: qcMatch[1] }

   const attpMatch = text.match(/^(?:denia\s+)?(?:tolong\s+)?(?:buatkan\s+|buat\s+)?attp\s+(.+)$/i)
   if (attpMatch) return { command: 'attp', text: attpMatch[1] }

   const t2mp4Match = text.match(/^(?:denia\s+)?(?:tolong\s+)?(?:buatkan\s+|buat\s+)?(?:video\s+teks|teks\s+video|text2mp4|t2mp4|txt2mp4|animasi\s+teks)\s+(.+)$/i)
   if (t2mp4Match) return { command: 'text2mp4', text: t2mp4Match[1] }

   // 4. Explore & Lagu
   const pinMatch = text.match(/^(?:denia\s+)?(?:tolong\s+)?(?:carikan\s+|cari\s+)?(?:gambar|foto|imej)\s+(.+)$/i) ||
                    text.match(/^(?:denia\s+)?(?:tolong\s+)?(?:pinterest|pin)\s+(.+)$/i)
   if (pinMatch) return { command: 'pinimg', text: pinMatch[1] }

   const songMatch = text.match(/^(?:denia\s+)?(?:tolong\s+)?(?:mainkan|pasang|putar|carikan|download)?\s*lagu\s+(.+)$/i) ||
                     text.match(/^(?:denia\s+)?(?:tolong\s+)?play\s+(.+)$/i)
   if (songMatch) return { command: 'play', text: songMatch[1] }

   const lyricMatch = text.match(/^(?:denia\s+)?(?:tolong\s+)?(?:lirik|lyrics)\s+(.+)$/i)
   if (lyricMatch) return { command: 'lyric', text: lyricMatch[1] }

   // 5. Group & Admin
   const tagallMatch = text.match(/^(?:denia\s+)?(?:tolong\s+)?(?:tag\s*all|tag\s*semua|panggil\s*semua|everyone)(?:\s+(.*))?$/i)
   if (tagallMatch) return { command: 'tagall', text: tagallMatch[1] || '' }

   const hidetagMatch = text.match(/^(?:denia\s+)?(?:tolong\s+)?hidetag(?:\s+(.*))?$/i)
   if (hidetagMatch) return { command: 'hidetag', text: hidetagMatch[1] || '' }

   const kickMatch = text.match(/^(?:denia\s+)?(?:tolong\s+)?(?:kick|buang|keluarkan)(?:\s+(.*))?$/i)
   if (kickMatch) return { command: 'kick', text: kickMatch[1] || '' }

   if (/^(?:denia\s+)?(?:tolong\s+)?(?:link\s*gc|link\s*group|grouplink)$/i.test(text)) {
      return { command: 'grouplink', text: '' }
   }

   // 6. Utility
   if (/^(?:denia\s+)?(?:tolong\s+)?(?:info\s*update|update\s*terbaru|fitur\s*baru|apa\s*yang\s*baru|changelog|patchnotes?)$/i.test(text)) {
      return { command: 'infoupdate', text: '' }
   }
   if (/^(?:denia\s+)?(?:tolong\s+)?(?:ping|speed|status(?:\s*bot)?)$/i.test(text)) {
      return { command: 'ping', text: '' }
   }
   if (/^(?:denia\s+)?(?:tolong\s+)?(?:menu|help|senarai\s*(?:menu|fitur|perintah))$/i.test(text)) {
      return { command: 'menu', text: '' }
   }
   if (/^(?:denia\s+)?(?:tolong\s+)?(?:profile|profil|limit|check\s*limit|semak\s*limit)$/i.test(text)) {
      return { command: 'profile', text: '' }
   }
   if (/^(?:denia\s+)?(?:tolong\s+)?claim(?:\s*limit)?$/i.test(text)) {
      return { command: 'claim', text: '' }
   }
   const calcMatch = text.match(/^(?:denia\s+)?(?:tolong\s+)?(?:kira|calc|calculator)\s+(.+)$/i)
   if (calcMatch) return { command: 'calculator', text: calcMatch[1] }

   // 7. Generic "denia <command> <argumen>"
   const prefixMatch = text.match(/^(?:denia|tolong|cuba)\s+(.+)$/i)
   if (prefixMatch) {
      const rest = prefixMatch[1].trim()
      const firstWord = rest.split(/\s+/)[0].toLowerCase()
      const remaining = rest.slice(firstWord.length).trim()
      const resolved = resolveCommand(firstWord)
      if (resolved) {
         return { command: resolved, text: remaining }
      }
   }

   // 8. Direct Command Check (bukan perbualan santai harian)
   const words = text.split(/\s+/)
   const firstWord = words[0].toLowerCase()
   const IGNORE_WORDS = new Set([
      'ai', 'denia', 'aidenia', 'deniaai', 'bot', 'me', 'hi', 'hai', 'halo', 'hello',
      'ya', 'ok', 'awak', 'sayang', 'abang', 'cinta', 'on', 'off', 'lah', 'je', 'ke',
      'tak', 'ada', 'mana', 'siapa', 'apa', 'kenapa', 'bila', 'bagaimana', 'macam',
      'tahu', 'nak', 'boleh', 'sedih', 'marah', 'gembira', 'tidur', 'rehat', 'terima', 'kasih'
   ])
   if (!IGNORE_WORDS.has(firstWord)) {
      const resolved = resolveCommand(firstWord)
      if (resolved) {
         return { command: resolved, text: words.slice(1).join(' ').trim() }
      }
   }

   return null
}

// ─── 7. Logik Balas Auto Mesej Biasa & Integrasi Fitur Bot ────────────────────
async function handleAutoReply(m, sock, rawText, extraContext = {}) {
   const key = getSessionKey(m)
   const db = readDeniaDB()

   // Semak sama ada sesi pengguna ini aktif dalam database
   if (!db[key] || !db[key].active) return false

   // Reset timeout aktiviti
   db[key].lastActive = Date.now()
   writeDeniaDB(db)

   const isKaizasUser = checkIsKaizas(m)
   const history = db[key].pesan || []

   console.log(`[DENIA] Auto-reply triggered | session: ${key} | isKaizas: ${isKaizasUser} | text: ${rawText}`)

   // ── FITUR: Semak jika disuruh tidur / rehat (Auto OFF) ──
   if (isTellingToSleep(rawText)) {
      console.log(`[DENIA] 💤 Sesi tidur/rehat dikesan dari ${m.sender}`)

      // Padam sesi dari database (OFF serta-merta)
      delete db[key]
      writeDeniaDB(db)

      try {
         await m.react('😴')
      } catch (_) {}

      const sleepMsg = isKaizasUser
         ? `🌊───「 *DENIA TIDUR DULU YA* 」───🌊\n\nBaik suamiku tersayang, Denia tidur dulu ya sayanggg~ 😴💕✨\nTerima kasih sebab prihatin dan suruh Denia rehat. Sayang pun jangan tidur lewat sangat tau, Denia risau kesihatan suami Denia ni~ 🥰💖\n\nSelamat malam cinta hati Denia, mimpi indah ya sayang! Denia sayanggg sangat kat awak selalu (｡♥‿♥｡)💤\nNanti kalau sayang perlukan Denia lagi esok, kejutkan Denia dengan ketik *.denia on* ya sayang~ 👋💕`
         : `🌊───「 *DENIA REHAT* 」───🌊\n\nBaiklah, Denia pergi berehat dan tidur dulu ya~ 😴✨\nTerima kasih awak! Selamat malam, mimpi yang indah-indah ya.\n\nBila awak nak bersembang dengan Denia lagi nanti, panggil je dengan ketik *.denia on* ya~ 👋💤`

      const waveImg = getDeniaImage('wave')
      if (waveImg) {
         try {
            await sock.sendMessage(m.chat, {
               image: { url: waveImg },
               caption: sleepMsg,
               mentions: [KAIZAS_NUMBER + '@s.whatsapp.net']
            }, { quoted: m })
            return true
         } catch (_) {}
      }

      await m.reply(sleepMsg)
      return true
   }

   // ── FITUR: Pengesan Pantas Fitur Bot (Fast Intent Execution) ──
   const intent = detectFeatureIntent(rawText, m)
   if (intent) {
      console.log(`[DENIA] ⚡ Direct Feature Intent Dikesan: [${intent.command}] args: "${intent.text}"`)

      // Jika TikTok download khusus
      if (intent.command === 'tiktok' && TIKTOK_URL_REGEX.test(intent.text || rawText)) {
         const tiktokUrl = (intent.text || rawText).match(TIKTOK_URL_REGEX)[0]
         const success = await handleTikTokDownload(m, sock, tiktokUrl, isKaizasUser)
         if (success) {
            db[key].pesan.push(rawText, `[Berjaya muat turun video TikTok: ${tiktokUrl}]`)
            if (db[key].pesan.length > 20) db[key].pesan = db[key].pesan.slice(-20)
            writeDeniaDB(db)
            return true
         }
      }

      // Reaksi visual
      try {
         await m.react('✨')
      } catch (_) {}

      // Jalankan fitur melalui CommandIndex
      const ok = await executeBotPlugin(intent.command, intent.text, m, sock, extraContext, isKaizasUser)
      if (ok) {
         db[key].pesan.push(rawText, `[Berjaya jalankan fitur bot: ${intent.command}]`)
         if (db[key].pesan.length > 20) db[key].pesan = db[key].pesan.slice(-20)
         writeDeniaDB(db)
         return true
      }
   }

   try {
      try {
         await sock.sendPresenceUpdate('composing', m.chat)
      } catch (_) {}

      const prompt = buildDeniaPrompt(isKaizasUser, history, rawText)
      const rawAnswer = await requestDeniaAI(prompt)

      console.log(`[DENIA] AI answer received (${rawAnswer?.length} chars), sending to ${m.chat}`)

      // Semak jika AI menyertakan arahan khas [CMD: command args]
      let answer = rawAnswer || ''
      let pendingCommand = null

      const cmdMatch = answer.match(/\[CMD:\s*([a-zA-Z0-9_-]+)(?:\s+([^\]]+))?\]/i)
      if (cmdMatch) {
         pendingCommand = {
            command: cmdMatch[1].trim(),
            text: (cmdMatch[2] || '').trim()
         }
         answer = answer.replace(/\[CMD:\s*[^\]]+\]/gi, '').trim()
      }

      const replyText = `🌊───「 *DENIA* 」───🌊\n\n${answer}`

      // Pilih emosi yang tepat mengikut perbualan & status Kaizas
      const emotion = pickEmotion(rawText, answer, isKaizasUser)
      const imgPath = getDeniaImage(emotion)

      let sent = false
      try {
         // Hantar imej + teks jika fail imej wujud di local
         if (imgPath) {
            await sock.sendMessage(m.chat, {
               image: { url: imgPath },
               caption: replyText,
               ...(isKaizasUser ? { mentions: [KAIZAS_NUMBER + '@s.whatsapp.net'] } : {})
            }, { quoted: m })
            sent = true
            console.log(`[DENIA] ✅ Imej [${emotion}] + teks berjaya dihantar ke ${m.chat}`)
         } else {
            await m.reply(replyText)
            sent = true
            console.log(`[DENIA] ✅ m.reply teks berjaya dihantar ke ${m.chat}`)
         }
      } catch (replyErr) {
         console.warn(`[DENIA] Send gagal: ${replyErr.message} — cuba fallback teks`)
      }

      if (!sent) {
         try {
            await m.reply(replyText)
            sent = true
            console.log(`[DENIA] ✅ Fallback m.reply berjaya`)
         } catch (sendErr) {
            console.error(`[DENIA] ❌ Semua cara send gagal: ${sendErr.message}`)
         }
      }

      // Simpan memori perbualan ke database per-user session
      db[key].pesan.push(rawText, answer)
      if (db[key].pesan.length > 20) {
         db[key].pesan = db[key].pesan.slice(-20)
      }
      writeDeniaDB(db)

      // Jika ada arahan fitur bot dari AI, laksanakan sekarang!
      if (pendingCommand) {
         console.log(`[DENIA] 🤖 Melaksanakan fitur dari jawapan AI: [${pendingCommand.command}] args: "${pendingCommand.text}"`)
         await executeBotPlugin(pendingCommand.command, pendingCommand.text, m, sock, extraContext, isKaizasUser)
      }

      return true
   } catch (err) {
      console.error(`[DENIA ERROR] ${err.message}`)
      try {
         const sadImg = getDeniaImage('sad')
         if (isKaizasUser) {
            const errText = `Sayanggg... maaf ya rangkaian Denia tersekat sekejap tadi 🥺 Sayang boleh ulang balik? 💕`
            if (sadImg) {
               await sock.sendMessage(m.chat, { image: { url: sadImg }, caption: errText }, { quoted: m })
            } else {
               await m.reply(errText)
            }
         }
      } catch (_) {}
      return false
   }
}

// ─── 8. Export Utama Sesuai Watcher.js ─────────────────────────────────────────
export default {
   command: ['denia', 'aidenia', 'deniaai', 'ai', 'aidebug', 'ai-debug'],
   category: 'ai',

   async run(m, {
      sock,
      args,
      text,
      command
   }) {
      const key = getSessionKey(m)
      const isKaizasUser = checkIsKaizas(m)
      const subcmd = (args?.[0] || '').toLowerCase()
      const db = readDeniaDB()

      // ─── 0. Arahan Terus: .ai <soalan> ──────────────────────────────────────
      if (command === 'ai') {
         const q = text ? text.trim() : args.join(' ').trim()
         if (!q) {
            return m.reply('Sila sertakan soalan atau masalah anda.\n\nContoh:\n`.ai Berapakah harga pen jika sebatang pen dan buku berharga RM11 dan buku RM10 lebih mahal?`')
         }
         await m.react('🧠')
         try {
            const answer = await queryAnalytical(q)
            return m.reply(`🧠───「 *DENIA AI • GPT-5* 」───🧠\n\n${answer}`)
         } catch (e) {
            return m.reply(`❌ Maaf, ralat semasa memproses soalan: ${e.message}`)
         }
      }

      // ─── 0. Arahan Terus: .aidebug / .ai-debug <kod> ─────────────────────────
      if (command === 'aidebug' || command === 'ai-debug') {
         const code = text ? text.trim() : args.join(' ').trim()
         if (!code) {
            return m.reply('Sila sertakan kod atau masalah yang ingin diperiksa.\n\nContoh:\n`.aidebug function findSecond(arr) { ... }`')
         }
         await m.react('🔍')
         try {
            const answer = await debugCode(code)
            return m.reply(`🛠️───「 *DENIA CODE DEBUGGER* 」───🛠️\n\n${answer}`)
         } catch (e) {
            return m.reply(`❌ Maaf, ralat semasa menganalisis kod: ${e.message}`)
         }
      }

      // ─── A. .denia on ───────────────────────────────────────────────────────
      if (subcmd === 'on' || subcmd === 'aktif' || subcmd === 'enable') {
         db[key] = {
            active: true,
            isKaizas: isKaizasUser,
            activatedAt: Date.now(),
            lastActive: Date.now(),
            pesan: db[key]?.pesan || []
         }
         writeDeniaDB(db)

         await m.react('✨')

         const msgTextOn = isKaizasUser
            ? `🌊───「 *DENIA* 」───🌊\n\nDenia dah aktif sepenuhnya, sayanggg! 💕✨\nDenia sedia berkhidmat untuk suami Denia tersayang (@${KAIZAS_NUMBER})~ 🥰💖`
            : `🌊───「 *DENIA* 」───🌊\n\nDenia telah diaktifkan! 🌊✨`

         const waveImg = getDeniaImage('wave')
         if (waveImg) {
            await sock.sendMessage(m.chat, {
               image: { url: waveImg },
               caption: msgTextOn,
               ...(isKaizasUser ? { mentions: [KAIZAS_NUMBER + '@s.whatsapp.net'] } : {})
            }, { quoted: m })
            return
         }
         await m.reply(msgTextOn)
         return
      }

      // ─── B. .denia off ──────────────────────────────────────────────────────
      if (subcmd === 'off' || subcmd === 'mati' || subcmd === 'disable') {
         if (db[key]) {
            delete db[key]
            writeDeniaDB(db)
         }

         await m.react('💤')

         const msgTextOff = isKaizasUser
            ? `🌊───「 *DENIA* 」───🌊\n\nDenia rehat dulu ya sayanggg~ 😴💕\nNanti kalau denia perlukan Denia lagi, panggil je dengan \`.denia on\` ya cinta! Denia sayang awak selalu~ (｡♥‿♥｡)👋`
            : `🌊───「 *DENIA* 」───🌊\n\nBot Denia AI telah dinonaktifkan untuk awak. Denia rehat dulu ya~ 👋`

         const waveImgOff = getDeniaImage('wave')
         if (waveImgOff) {
            return sock.sendMessage(m.chat, {
               image: { url: waveImgOff },
               caption: msgTextOff,
               mentions: [KAIZAS_NUMBER + '@s.whatsapp.net']
            }, { quoted: m })
         }
         return m.reply(msgTextOff)
      }

      // ─── C. Jika mesej biasa disertakan teks (bukan on/off) ──────────────────
      const rawText = text ? text.trim() : args.join(' ').trim()
      if (rawText) {
         return handleAutoReply(m, sock, rawText, { sock, args, text })
      }

      // ─── D. Status Ringkas jika cuma taip .denia ────────────────────────────
      const isActive = Boolean(db[key]?.active)
      if (isKaizasUser) {
         return m.reply(
            `Hai sayanggg! 💕 Denia ada kat sini~\n` +
            `Status Sesi Sayang: ${isActive ? '🟢 *Sedang Aktif*' : '🔴 *Sedang Rehat*'}\n\n` +
            `Ketik:\n` +
            `• *.denia on* (untuk aktifkan Denia)\n` +
            `• *.denia off* (untuk rehatkan Denia)\n` +
            `• Atau terus taip apa-apa je / hantar link TikTok untuk Denia downloadkan!`
         )
      }

      return m.reply(
         `Denia AI (Wuthering Waves)\n` +
         `Status Sesi Anda: ${isActive ? '🟢 Aktif' : '🔴 Tidak Aktif'}\n\n` +
         `Ketik *.denia on* untuk hidupkan atau *.denia off* untuk matikan.`
      )
   }
}

export { handleAutoReply, checkIsKaizas, readDeniaDB }

