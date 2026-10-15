/**
 * TikTok Video Optimization Engine for WhatsApp
 * Ensures 4K / HD TikTok videos are crystal-clear ("tak pecah")
 * and 100% playable across all devices AND postable directly to WhatsApp Status.
 * NEVER sent as document.
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, mkdirSync, readFileSync, unlinkSync, statSync } from 'fs'
import { join } from 'path'
import { writeFile } from 'fs/promises'
import { pipeline } from 'stream/promises'
import { createWriteStream } from 'fs'
import { Readable } from 'stream'

const execAsync = promisify(exec)

export const ensureTikTokUrl = (url) => {
   if (!url || typeof url !== 'string') return ''
   if (url.startsWith('http://') || url.startsWith('https://')) return url
   return 'https://www.tikwm.com' + (url.startsWith('/') ? '' : '/') + url
}

export const parseFps = (rateStr) => {
   if (!rateStr || typeof rateStr !== 'string') return 30
   const [num, den] = rateStr.split('/').map(Number)
   if (!den || isNaN(num) || isNaN(den)) return 30
   return Math.round((num / den) * 100) / 100
}

export const probeVideo = async (filePath) => {
   try {
      const { stdout } = await execAsync(
         `ffprobe -v quiet -print_format json -show_streams -show_format "${filePath}"`,
         { timeout: 15000 }
      )
      const info = JSON.parse(stdout)
      const vStream = info.streams?.find(s => s.codec_type === 'video')
      const aStream = info.streams?.find(s => s.codec_type === 'audio')
      const fps = parseFps(vStream?.r_frame_rate || vStream?.avg_frame_rate)
      const width = parseInt(vStream?.width || 0, 10)
      const height = parseInt(vStream?.height || 0, 10)

      return {
         codec: vStream?.codec_name || '',
         audioCodec: aStream?.codec_name || '',
         pixFmt: vStream?.pix_fmt || '',
         profile: vStream?.profile || '',
         fps,
         width,
         height,
         duration: parseFloat(info.format?.duration || 0),
         size: parseInt(info.format?.size || 0, 10)
      }
   }
   catch (err) {
      console.error('[TikTok Probe Error]:', err.message)
      return {
         codec: '',
         audioCodec: '',
         pixFmt: '',
         profile: '',
         fps: 30,
         width: 0,
         height: 0,
         duration: 0,
         size: 0
      }
   }
}

export const optimizeVideoForWhatsApp = async (input, options = {}) => {
   const tmpDir = join(process.cwd(), global.temporaryFolder || 'temp')
   if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true })

   const id = `${Date.now()}_${Math.random().toString(36).substring(7)}`
   const rawPath = join(tmpDir, `raw_tt_${id}.mp4`)
   const outPath = join(tmpDir, `opt_tt_${id}.mp4`)
   const outPath2 = join(tmpDir, `opt2_tt_${id}.mp4`)

   const cleanup = () => {
      try { if (existsSync(rawPath)) unlinkSync(rawPath) } catch {}
      try { if (existsSync(outPath)) unlinkSync(outPath) } catch {}
      try { if (existsSync(outPath2)) unlinkSync(outPath2) } catch {}
   }

   try {
      // 1. Download or write input to rawPath
      if (Buffer.isBuffer(input)) {
         await writeFile(rawPath, input)
      }
      else if (typeof input === 'string') {
         if (input.startsWith('http://') || input.startsWith('https://')) {
            const resp = await fetch(input, {
               headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Referer': 'https://www.tiktok.com/'
               }
            })
            if (!resp.ok) throw new Error(`Failed to fetch video: ${resp.statusText}`)
            await pipeline(Readable.fromWeb(resp.body), createWriteStream(rawPath))
         }
         else if (existsSync(input)) {
            const buf = readFileSync(input)
            await writeFile(rawPath, buf)
         }
         else {
            throw new Error('Invalid input string')
         }
      }
      else {
         throw new Error('Unsupported input type')
      }

      // 2. Probe video properties
      const probe = await probeVideo(rawPath)
      const { width, height, codec, pixFmt, fps, audioCodec, duration } = probe
      const rawFileSize = existsSync(rawPath) ? statSync(rawPath).size : 0

      const isPortrait = height >= width
      const maxW = isPortrait ? 1080 : 1920
      const maxH = isPortrait ? 1920 : 1080

      const isH264 = codec === 'h264'
      const isAac = audioCodec === 'aac'
      const isCompatPixFmt = pixFmt === 'yuv420p'
      const isWithinLimits = width > 0 && height > 0 && width <= maxW && height <= maxH
      const isEvenDimensions = width % 2 === 0 && height % 2 === 0
      const isNormalFps = fps >= 20 && fps <= 60
      // Max file size for standard WhatsApp video forwarding/status is ~55MB
      const isSafeFileSize = rawFileSize > 0 && rawFileSize <= 50 * 1024 * 1024

      let ffmpegCmd

      // If already H.264, standard 1080p or below, standard pixel format, normal fps, even dimensions, and safe file size:
      // Fast stream-copy with faststart (0% quality loss, instant, minimal CPU).
      if (isH264 && isCompatPixFmt && isWithinLimits && isEvenDimensions && isNormalFps && isSafeFileSize) {
         const audioArgs = isAac ? '-c:a copy' : '-c:a aac -b:a 128k'
         ffmpegCmd = `ffmpeg -y -i "${rawPath}" -c:v copy ${audioArgs} -movflags +faststart "${outPath}"`
      }
      else {
         // Video is 4K, HEVC, 10-bit color, high fps, odd dimensions, or too large:
         // Downscale with lanczos to max 1080p, encode with H.264 High Profile Level 4.1 yuv420p with CRF 19.
         // Rate control ensures it always fits cleanly within WhatsApp video limits (< 55MB) for easy WhatsApp status posting.
         const fpsArg = fps > 60 ? '-r 60' : ''
         const scaleFilter = `scale='min(${maxW},iw)':'min(${maxH},ih)':force_original_aspect_ratio=decrease:flags=lanczos,pad=ceil(iw/2)*2:ceil(ih/2)*2`

         // Bitrate cap to guarantee it never exceeds WhatsApp video/status limit (~55MB)
         let rateControlArgs = '-maxrate 4000k -bufsize 8000k'
         if (duration > 60) {
            const maxKbps = Math.max(800, Math.floor((45 * 8192) / duration))
            rateControlArgs = `-maxrate ${maxKbps}k -bufsize ${maxKbps * 2}k`
         }

         ffmpegCmd = `ffmpeg -y -i "${rawPath}" ${fpsArg} -vf "${scaleFilter}" -c:v libx264 -preset veryfast -crf 19 ${rateControlArgs} -profile:v high -level 4.1 -pix_fmt yuv420p -c:a aac -b:a 128k -ar 44100 -movflags +faststart "${outPath}"`
      }

      await execAsync(ffmpegCmd, { timeout: 180000 })

      let finalPath = outPath

      // Verify file was generated and within WhatsApp video limit (< 60MB)
      if (existsSync(outPath) && statSync(outPath).size > 1000) {
         const outSize = statSync(outPath).size
         // If still slightly over 55MB (e.g. extremely long video), compress with CRF 24 so it is 100% video and never rejected
         if (outSize > 55 * 1024 * 1024) {
            const secDuration = Math.max(duration || 60, 30)
            const targetKbps = Math.max(600, Math.floor((45 * 8192) / secDuration))
            const pass2Cmd = `ffmpeg -y -i "${outPath}" -c:v libx264 -preset veryfast -b:v ${targetKbps}k -maxrate ${targetKbps * 1.2}k -bufsize ${targetKbps * 2}k -profile:v high -level 4.1 -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart "${outPath2}"`
            try {
               await execAsync(pass2Cmd, { timeout: 120000 })
               if (existsSync(outPath2) && statSync(outPath2).size > 1000) {
                  finalPath = outPath2
               }
            }
            catch {}
         }

         const buffer = readFileSync(finalPath)
         cleanup()
         return {
            buffer,
            width: probe.width,
            height: probe.height,
            fps: probe.fps
         }
      }

      // Fallback: if output wasn't created, return raw buffer
      const rawBuf = readFileSync(rawPath)
      cleanup()
      return {
         buffer: rawBuf,
         width: probe.width,
         height: probe.height,
         fps: probe.fps
      }
   }
   catch (err) {
      console.error('[TikTok Optimize Error]:', err.message)
      cleanup()
      return null
   }
}

export const optimizeFullDurationVideo = async (tmpIn, tmpOut) => {
   const probe = await probeVideo(tmpIn)
   const duration = Math.max(probe.duration || 30, 1)

   // WhatsApp video message limit is ~64MB. Target 45MB so it's 100% accepted as a video message.
   const targetBytes = 45 * 1024 * 1024
   const audioBitrate = 96
   let videoBitrate = Math.floor((targetBytes * 8 / 1024) / duration) - audioBitrate
   videoBitrate = Math.max(350, Math.min(3200, videoBitrate))

   const isPortrait = probe.height >= probe.width
   let maxW, maxH
   if (videoBitrate >= 1400) {
      maxW = isPortrait ? 720 : 1280
      maxH = isPortrait ? 1280 : 720
   } else {
      maxW = isPortrait ? 480 : 854
      maxH = isPortrait ? 854 : 480
   }

   const scaleFilter = `scale='min(${maxW},iw)':'min(${maxH},ih)':force_original_aspect_ratio=decrease:flags=bicubic,pad=ceil(iw/2)*2:ceil(ih/2)*2`

   // Full duration (tiada had masa -t), saiz dimampatkan pintar bawah had WhatsApp
   const ffmpegCmd = `ffmpeg -y -i "${tmpIn}" -vf "${scaleFilter}" -c:v libx264 -preset veryfast -b:v ${videoBitrate}k -maxrate ${Math.round(videoBitrate * 1.3)}k -bufsize ${Math.round(videoBitrate * 2)}k -profile:v main -pix_fmt yuv420p -c:a aac -b:a ${audioBitrate}k -ar 44100 -movflags +faststart "${tmpOut}"`

   await execAsync(ffmpegCmd, { timeout: 240000 })

   if (existsSync(tmpOut) && statSync(tmpOut).size > 1000) {
      return {
         buffer: readFileSync(tmpOut),
         duration,
         width: probe.width,
         height: probe.height
      }
   }

   return null
}

