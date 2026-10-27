import { execSync } from 'child_process'
import { existsSync, mkdirSync, statSync, unlinkSync } from 'fs'
import path from 'path'

const tempDir = path.resolve('temp')
if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true })

const testImg = path.join(tempDir, 'test_sticker_input.jpg')
const testWebp = path.join(tempDir, 'test_sticker_output.webp')

// Create a tiny test JPEG via ffmpeg
try {
  execSync(`ffmpeg -y -loglevel error -f lavfi -i color=blue:512x512:d=1 -frames:v 1 "${testImg}"`)
  console.log('✅ Test JPEG created:', testImg)
} catch(e) {
  console.error('❌ Cannot create test JPEG:', e.message)
  process.exit(1)
}

// Now convert to webp sticker (same args as IMAGE_TO_WEBP in Constants.js)
try {
  execSync(`ffmpeg -y -loglevel error -i "${testImg}" -an -sn -vf "scale=512:512:force_original_aspect_ratio=decrease:flags=neighbor,pad=512:512:-1:-1:color=0x00000000,format=rgba" -c:v libwebp -q:v 50 -lossless 0 -compression_level 0 -map_metadata -1 -f webp "${testWebp}"`)
  console.log('✅ WebP sticker created:', testWebp, '| Size:', statSync(testWebp).size, 'bytes')
} catch(e) {
  console.error('❌ FFmpeg webp conversion failed:', e.stderr?.toString() || e.message)
}

// Cleanup
try { unlinkSync(testImg) } catch(_) {}
try { unlinkSync(testWebp) } catch(_) {}

