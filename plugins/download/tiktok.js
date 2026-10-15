import { isJidNewsletter } from '@sairidev/baileys-new'
import { tikwm } from '../../lib/Scraper.js'
import { optimizeVideoForWhatsApp, ensureTikTokUrl } from '../../lib/Components/TikTokOptimizer.js'

export default {
   command: ['tiktok', 'tikwm', 'ttmp3', 'ttvn'],
   hidden: ['tt', 'ttmp4', 'ttwm'],
   category: 'download',
   async run(m, {
      sock,
      isPrefix,
      command,
      args
   }) {
      try {
         const targetUrl = args.find(arg => arg.includes('tiktok.com'))

         if (!targetUrl)
            return m.reply(`👉🏻 *Example*: ${isPrefix + command} https://vt.tiktok.com/ZSUYJLQfg/`)

         m.react('🕒')
         const data = await tikwm(targetUrl)
         const isNeedAudio = command === 'ttmp3' || command === 'ttvn'
         const isNeedWM = command === 'tikwm' || command === 'ttwm'
         const imageContent = data.images

         // 1. Audio only request
         if (isNeedAudio) {
            const musicUrl = ensureTikTokUrl(data.music || data.music_info?.play || data.music_info?.url)
            if (!musicUrl)
               return m.reply('❌ Audio not available for this TikTok.')

            return sock.sendMedia(m.chat, musicUrl, data.title || '', m, {
               audio: command === 'ttmp3',
               ptt: command === 'ttvn' || isJidNewsletter(m.chat)
            })
         }

         // 2. Photo slides album
         if (imageContent?.length > 1) {
            return sock.sendMessage(m.chat, {
               album: imageContent.map(imageUrl => ({
                  image: {
                     url: ensureTikTokUrl(imageUrl)
                  }
               }))
            }, {
               quoted: m
            })
         }

         // 3. Single photo
         if (imageContent?.length === 1 && !data.play && !data.hdplay) {
            return sock.sendMedia(m.chat, ensureTikTokUrl(imageContent[0]), data.title || '', m)
         }

         // 4. Video processing (HD / 4K optimization)
         // Prioritize HD stream (hdplay) for maximum clarity without watermark
         let rawVideoUrl = isNeedWM ?
            ensureTikTokUrl(data.wmplay) :
            ensureTikTokUrl(data.hdplay || data.play)

         if (!rawVideoUrl) {
            rawVideoUrl = ensureTikTokUrl(data.play || data.wmplay)
         }

         if (!rawVideoUrl)
            return m.reply('❌ Video URL not found.')

         // Build clean caption
         const title = data.title ? data.title.trim() : '-'
         const author = data.author?.nickname || data.author?.unique_id || '-'
         const duration = data.duration ? `${data.duration}s` : '-'
         const caption =
            `🎵 *TIKTOK DOWNLOADER (HD)*\n\n` +
            `• *Author*: ${author}\n` +
            `• *Caption*: ${title}\n` +
            `• *Duration*: ${duration}` +
            (data.music_info?.title ? `\n• *Music*: ${data.music_info.title} - ${data.music_info.author || ''}` : '')

         // Optimize video for WhatsApp:
         // 4K videos are converted to sharp 1080p H.264 (CRF 19, lanczos, yuv420p) with faststart
         // Guaranteed to be sent as VIDEO (never as document) so it can be posted directly to WhatsApp Status.
         const processed = await optimizeVideoForWhatsApp(rawVideoUrl)

         if (processed?.buffer) {
            await sock.sendMessage(m.chat, {
               video: processed.buffer,
               mimetype: 'video/mp4',
               caption
            }, { quoted: m })
         }
         else {
            // Fallback: send as video URL directly
            await sock.sendMessage(m.chat, {
               video: { url: rawVideoUrl },
               mimetype: 'video/mp4',
               caption
            }, { quoted: m })
         }
      }
      catch (error) {
         console.error(error)
         m.reply('❌ ' + error.message)
      }
   },
   limit: 1
}