import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { isMimeImage, isMimeVideo, isMimeGif } from '../../lib/Utilities.js'

const execAsync = promisify(exec)

function parseOptions(args = []) {
   const options = {
      crop: false,
      resize: null,
      circle: false,
      rounded: false,
      packname: null,
      author: null
   }

   const remainingArgs = []

   for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      if (arg === '--crop' || arg === '-c') {
         options.crop = true
      } else if (arg === '--resize' || arg === '-r') {
         if (args[i + 1] && /^\d+x\d+$/i.test(args[i + 1])) {
            options.resize = args[i + 1]
            i++
         }
      } else if (arg === '--circle') {
         options.circle = true
      } else if (arg === '--rounded') {
         options.rounded = true
      } else {
         remainingArgs.push(arg)
      }
   }

   if (remainingArgs.length > 0) {
      const text = remainingArgs.join(' ')
      if (text.includes('|')) {
         const parts = text.split('|')
         options.packname = parts[0]?.trim() || null
         options.author = parts[1]?.trim() || null
      } else {
         options.packname = remainingArgs[0] || null
         options.author = remainingArgs.slice(1).join(' ') || null
      }
   }

   return options
}

async function processImage(inputPath, outputPath, options) {
   const filters = []

   if (options.resize) {
      const [width, height] = options.resize.split('x').map(Number)
      filters.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease`)
      filters.push(`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`)
   }

   if (options.crop) {
      filters.push(`crop='min(iw,ih)':'min(iw,ih)'`)
      filters.push(`scale=512:512`)
   }

   if (options.circle) {
      filters.push(`format=rgba`)
      filters.push(`geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(gt(pow(X-W/2,2)+pow(Y-H/2,2),pow(min(W,H)/2,2)),0,255)'`)
   }

   if (options.rounded) {
      const radius = 50
      filters.push(`format=rgba`)
      filters.push(`geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(X,${radius})*lt(Y,${radius})*gt(pow(${radius}-X,2)+pow(${radius}-Y,2),pow(${radius},2)),0,if(gt(X,W-${radius})*lt(Y,${radius})*gt(pow(X-W+${radius},2)+pow(${radius}-Y,2),pow(${radius},2)),0,if(lt(X,${radius})*gt(Y,H-${radius})*gt(pow(${radius}-X,2)+pow(Y-H+${radius},2),pow(${radius},2)),0,if(gt(X,W-${radius})*gt(Y,H-${radius})*gt(pow(X-W+${radius},2)+pow(Y-H+${radius},2),pow(${radius},2)),0,255))))'`)
   }

   if (filters.length === 0) {
      fs.copyFileSync(inputPath, outputPath)
      return
   }

   const filterStr = filters.join(',')
   await execAsync(`ffmpeg -i "${inputPath}" -vf "${filterStr}" -y "${outputPath}"`)
}

async function processVideo(inputPath, outputPath, options) {
   const filters = []

   if (options.resize) {
      const [width, height] = options.resize.split('x').map(Number)
      filters.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease`)
      filters.push(`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`)
   }

   if (options.crop) {
      filters.push(`crop='min(iw,ih)':'min(iw,ih)'`)
      filters.push(`scale=512:512`)
   }

   if (filters.length === 0) {
      fs.copyFileSync(inputPath, outputPath)
      return
   }

   const filterStr = filters.join(',')
   await execAsync(`ffmpeg -i "${inputPath}" -vf "${filterStr}" -c:a copy -y "${outputPath}"`)
}

export default {
   command: 'sticker',
   hidden: ['s', 'stiker', 'stickergif', 'svid'],
   category: 'maker',
   async run(m, { sock, args, isPrefix }) {
      const q = m.quoted ? m.quoted : m
      const mimetype = q.msg?.mimetype || ''

      const isImage = isMimeImage(mimetype)
      const isVideo = isMimeVideo(mimetype) || isMimeGif(mimetype)

      if (!isImage && !isVideo) {
         return m.reply(
            `🖼️ *sᴛɪᴄᴋᴇʀ ᴍᴀᴋᴇʀ*\n\n` +
            `Kirim/reply gambar atau video dengan caption:\n` +
            `\`${isPrefix}s\`\n\n` +
            `*ᴏᴘsɪ:*\n` +
            `> \`--crop\` - Crop jadi kotak\n` +
            `> \`--resize WxH\` - Resize ke ukuran tertentu\n` +
            `> \`--circle\` - Bentuk bulatan (circle)\n` +
            `> \`--rounded\` - Sudut melengkung (rounded)\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> \`${isPrefix}s --crop\`\n` +
            `> \`${isPrefix}s --resize 256x256\`\n` +
            `> \`${isPrefix}s --circle\`\n` +
            `> \`${isPrefix}s PackName Author\`\n` +
            `> \`${isPrefix}s PackName|Author\``
         )
      }

      await m.react('🕕')

      const options = parseOptions(args || [])

      try {
         let buffer = await q.download()
         if (!buffer || buffer.length === 0) {
            await m.react('❌')
            return m.reply('❌ Gagal muat turun media. Sila cuba lagi.')
         }

         const tempDir = path.join(process.cwd(), 'temp')
         if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true })
         }

         // Check video duration
         if (isVideo) {
            const tempVideo = path.join(tempDir, `dur_${Date.now()}.mp4`)
            fs.writeFileSync(tempVideo, buffer)

            try {
               const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tempVideo}"`)
               const duration = parseFloat(stdout.trim())

               if (duration > 10) {
                  await m.react('☢')
                  if (fs.existsSync(tempVideo)) fs.unlinkSync(tempVideo)
                  return m.reply(`❌ Video terlalu panjang!\n\n> Durasi: ${duration.toFixed(1)} saat\n> Maksimum: 10 saat`)
               }
            } catch (_) {}

            if (fs.existsSync(tempVideo)) fs.unlinkSync(tempVideo)
         }

         const hasProcessing = options.crop || options.resize || options.circle || options.rounded

         if (hasProcessing) {
            const ext = isVideo ? 'mp4' : 'png'
            const inputPath = path.join(tempDir, `s_in_${Date.now()}.${ext}`)
            const outputPath = path.join(tempDir, `s_out_${Date.now()}.${ext}`)

            fs.writeFileSync(inputPath, buffer)

            try {
               if (isImage) {
                  await processImage(inputPath, outputPath, options)
               } else if (isVideo) {
                  await processVideo(inputPath, outputPath, options)
               }

               if (fs.existsSync(outputPath)) {
                  buffer = fs.readFileSync(outputPath)
               }
            } catch (err) {
               console.error('[Sticker Processing Error]', err)
            } finally {
               if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
               if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
            }
         }

         const packname = options.packname || global.stickerPackName || 'Denia-MD'
         const author = options.author || global.stickerPackPublisher || 'Bot'

         await sock.sendMedia(m.chat, buffer, '', m, {
            sticker: true,
            stickerPackName: packname,
            stickerPackPublisher: author
         })

         await m.react('✅')
      } catch (error) {
         console.error('[Sticker Error]', error)
         await m.react('❌')
         m.reply('❌ Gagal menghasilkan stiker: ' + (error.message || 'Ralat sistem'))
      }
   },
   limit: 1
}