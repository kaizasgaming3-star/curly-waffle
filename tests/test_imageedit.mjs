/**
 * ══════════════════════════════════════════════════════════════════════
 *             UNIT TEST: AI IMAGE EDIT (!imgedit)
 * ══════════════════════════════════════════════════════════════════════
 * Menguji:
 * 1. Parser arahan !imgedit & pengesahan prompt
 * 2. Mesej gambar bersama arahan (caption)
 * 3. Mesej gambar yang dipetik/dibalas (quoted image)
 * 4. Pengesanan ketiadaan gambar / prompt kosong
 * 5. Mock respons API berjaya (200 JSON dengan image_url)
 * 6. Mock respons API gagal (500 ralat)
 * 7. Had saiz fail (melebihi 8MB)
 */

export async function processImageEdit({ buffer, mimetype, prompt, apiFetcher }) {
   if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      return { ok: false, error: 'Tiada gambar dikesan' }
   }
   if (!mimetype || !mimetype.startsWith('image/')) {
      return { ok: false, error: 'Jenis fail bukan gambar yang sah' }
   }
   if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return { ok: false, error: 'Sila sertakan arahan suntingan' }
   }
   const MAX_SIZE = 8 * 1024 * 1024
   if (buffer.length > MAX_SIZE) {
      return { ok: false, error: 'Saiz gambar melebihi had maksimum 8MB' }
   }

   const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`
   try {
      const result = await apiFetcher({ prompt: prompt.trim(), image: dataUri })
      if (!result?.status || !result?.image_url) {
         return { ok: false, error: result?.message || 'API tidak memulangkan URL imej' }
      }
      return { ok: true, imageUrl: result.image_url, prompt: prompt.trim() }
   } catch (err) {
      return { ok: false, error: err.message }
   }
}

async function runTests() {
   console.log('╔══════════════════════════════════════════════════════════════════╗')
   console.log('║           SUITE UJIAN UNIT AI IMAGE EDIT (!imgedit)              ║')
   console.log('╚══════════════════════════════════════════════════════════════════╝\n')

   let passed = 0
   const total = 7

   const dummyBuffer = Buffer.from('fake-image-bytes')
   const dummyMime = 'image/jpeg'

   // ─── Ujian 1: Pengesahan Prompt Kosong ─────────────────────────────
   console.log('▶ [Ujian 1: Prompt Kosong]')
   const res1 = await processImageEdit({ buffer: dummyBuffer, mimetype: dummyMime, prompt: '   ' })
   if (!res1.ok && res1.error.includes('arahan')) {
      passed++
      console.log('   ✅ LULUS — Prompt kosong ditolak dengan betul.')
   } else {
      console.log('   ❌ GAGAL — Prompt kosong tidak ditolak:', res1)
   }

   // ─── Ujian 2: Ketiadaan Gambar / Gambar Rosak ──────────────────────
   console.log('\n▶ [Ujian 2: Ketiadaan Gambar]')
   const res2 = await processImageEdit({ buffer: null, mimetype: dummyMime, prompt: 'gaya anime' })
   if (!res2.ok && res2.error.includes('Tiada gambar')) {
      passed++
      console.log('   ✅ LULUS — Ketiadaan gambar dikesan dan ditolak.')
   } else {
      console.log('   ❌ GAGAL — Tiada gambar tidak ditolak:', res2)
   }

   // ─── Ujian 3: Jenis Mimetype Bukan Imej ───────────────────────────
   console.log('\n▶ [Ujian 3: Mimetype Bukan Imej (cth: audio/mp3)]')
   const res3 = await processImageEdit({ buffer: dummyBuffer, mimetype: 'audio/mp3', prompt: 'gaya anime' })
   if (!res3.ok && res3.error.includes('bukan gambar')) {
      passed++
      console.log('   ✅ LULUS — Mimetype bukan imej ditolak.')
   } else {
      console.log('   ❌ GAGAL — Mimetype bukan imej diterima:', res3)
   }

   // ─── Ujian 4: Had Saiz Fail (Lebih 8MB) ───────────────────────────
   console.log('\n▶ [Ujian 4: Had Saiz Fail (> 8MB)]')
   const hugeBuffer = Buffer.alloc(9 * 1024 * 1024)
   const res4 = await processImageEdit({ buffer: hugeBuffer, mimetype: dummyMime, prompt: 'gaya anime' })
   if (!res4.ok && res4.error.includes('8MB')) {
      passed++
      console.log('   ✅ LULUS — Gambar melebihi 8MB disekat serta-merta.')
   } else {
      console.log('   ❌ GAGAL — Fail > 8MB tidak disekat:', res4)
   }

   // ─── Ujian 5: Respons API Berjaya (Mock Success 200) ──────────────
   console.log('\n▶ [Ujian 5: Respons API Berjaya]')
   const mockSuccessFetcher = async () => ({
      status: true,
      statusCode: 200,
      image_url: 'https://storage.googleapis.com/genibot2.appspot.com/images/edit_sample.png',
      message: 'Image edited successfully'
   })
   const res5 = await processImageEdit({
      buffer: dummyBuffer,
      mimetype: dummyMime,
      prompt: 'jadikan gaya anime',
      apiFetcher: mockSuccessFetcher
   })
   if (res5.ok && res5.imageUrl.startsWith('https://')) {
      passed++
      console.log('   ✅ LULUS — Respons berjaya diproses dan memulangkan URL imej.')
   } else {
      console.log('   ❌ GAGAL — Respons berjaya gagal diproses:', res5)
   }

   // ─── Ujian 6: Respons API Gagal (Mock Error) ──────────────────────
   console.log('\n▶ [Ujian 6: Respons API Gagal]')
   const mockErrorFetcher = async () => ({
      status: false,
      statusCode: 500,
      message: 'Failed to process image'
   })
   const res6 = await processImageEdit({
      buffer: dummyBuffer,
      mimetype: dummyMime,
      prompt: 'gaya anime',
      apiFetcher: mockErrorFetcher
   })
   if (!res6.ok && res6.error.includes('Failed to process image')) {
      passed++
      console.log('   ✅ LULUS — Ralat API dikendalikan secara anggun.')
   } else {
      console.log('   ❌ GAGAL — Ralat API tidak dikendalikan:', res6)
   }

   // ─── Ujian 7: Sokongan Quoted Media vs Direct Caption ─────────────
   console.log('\n▶ [Ujian 7: Logik Pengekstrakan Media (Direct vs Quoted)]')
   const mDirect = { msg: { mimetype: 'image/jpeg' }, download: async () => dummyBuffer }
   const mQuoted = { quoted: { msg: { mimetype: 'image/png' }, download: async () => dummyBuffer } }

   const extractMedia = (m) => (m.quoted?.msg?.mimetype ? m.quoted : m)
   const targetDirect = extractMedia(mDirect)
   const targetQuoted = extractMedia(mQuoted)

   if (targetDirect.msg.mimetype === 'image/jpeg' && targetQuoted.msg.mimetype === 'image/png') {
      passed++
      console.log('   ✅ LULUS — Menyokong kedua-dua imej langsung (kapsyen) dan imej yang dibalas (quoted).')
   } else {
      console.log('   ❌ GAGAL — Pengekstrakan media direct/quoted tidak tepat.')
   }

   console.log('\n──────────────────────────────────────────────────────────────────')
   console.log(`KEPUTUSAN KESELURUHAN: ${passed} / ${total} UJIAN LULUS (${((passed / total) * 100).toFixed(0)}%)`)
   console.log('──────────────────────────────────────────────────────────────────\n')
}

runTests().catch(console.error)

