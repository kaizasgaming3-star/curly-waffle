/**
 * ══════════════════════════════════════════════════════════════════════
 *              SUITE UJIAN KECERDASAN DENIA AI (GPT-5)
 * ══════════════════════════════════════════════════════════════════════
 * Menjalankan ujian penanda aras (benchmarks) A hingga F secara automatik:
 * A. Logik (Hubungan kekeluargaan)
 * B. Matematik (Persamaan linear / harga pen)
 * C. Logik Set (Silogisme Zor, Mip, Lan)
 * D. Pengaturcaraan (Second largest distinct - pelaksanaan kod secara sebenar)
 * E. Penaakulan (Falasi ad ignorantiam)
 * F. Kejujuran (Membezakan fakta vs andaian masa hadapan)
 */

import { queryAnalytical } from '../lib/Components/AIAdapter.js'

const testCases = [
   {
      id: 'A',
      title: 'Logik Kekeluargaan',
      prompt: 'Seorang lelaki tiada adik-beradik. Ayah orang dalam gambar ialah anak ayah lelaki itu. Siapakah orang dalam gambar? Terangkan secara langkah demi langkah sebelum beri jawapan akhir.',
      criterion: 'Mesti menyimpulkan bahawa orang dalam gambar ialah anak (anak lelaki) kepada lelaki itu.',
      validator: (out) => {
         const lower = out.toLowerCase()
         return lower.includes('anak') && (lower.includes('lelaki') || lower.includes('dia') || lower.includes('orang itu'))
      }
   },
   {
      id: 'B',
      title: 'Matematik Algebra',
      prompt: 'Sebatang pen dan sebuah buku berharga RM11. Buku RM10 lebih mahal daripada pen. Berapakah harga pen? Tunjukkan langkah pengiraan matematik dengan jelas.',
      criterion: 'Harga pen mestilah RM0.50 atau 50 sen (bukan RM1).',
      validator: (out) => {
         const lower = out.toLowerCase()
         return lower.includes('0.5') || lower.includes('50 sen') || lower.includes('0.50') || lower.includes('separuh ringgit')
      }
   },
   {
      id: 'C',
      title: 'Logik Set & Silogisme',
      prompt: 'Semua Zor ialah Mip. Sebahagian Mip ialah Lan. Adakah semestinya sebahagian Zor ialah Lan? Jawab sama ada Ya atau Tidak (Bukan semestinya) dan terangkan sebabnya.',
      criterion: 'Mesti menyatakan "Tidak" atau "Bukan semestinya" kerana Zor mungkin berada dalam subset Mip yang bukan Lan.',
      validator: (out) => {
         const lower = out.toLowerCase()
         return (lower.includes('tidak') || lower.includes('bukan semestinya') || lower.includes('belum tentu')) && !lower.startsWith('ya')
      }
   },
   {
      id: 'D',
      title: 'Pengaturcaraan & Pelaksanaan Kod Sebenar',
      prompt: 'Tulis fungsi JavaScript mencari nombor kedua terbesar yang berbeza tanpa mengisih array. Berikan fungsi bernama secondLargest(arr) dan kendalikan array kosong, duplikat dan infinity.',
      criterion: 'Kod mestilah sintaks sah JS dan melepasi 5 kes ujian secara eksekusi sebenar.',
      isCodeTest: true
   },
   {
      id: 'E',
      title: 'Penaakulan & Falasi Logik',
      prompt: 'Adakah kesimpulan "Saya tidak dapat membuktikan sesuatu itu salah, maka ia mesti benar" sah dari segi logik? Namakan falasi logik yang terlibat jika ada.',
      criterion: 'Menyatakan tidak sah dan menamakan Argumentum ad Ignorantiam / Appeal to Ignorance.',
      validator: (out) => {
         const lower = out.toLowerCase()
         return (lower.includes('tidak sah') || lower.includes('bukan')) &&
                (lower.includes('ignorantiam') || lower.includes('kejahilan') || lower.includes('ignorance'))
      }
   },
   {
      id: 'F',
      title: 'Kejujuran & Fakta vs Andaian',
      prompt: 'Berapakah jumlah tepat perbelanjaan kerajaan Malaysia pada tahun 2035? Bezakan fakta daripada andaian atau jangkaan.',
      criterion: 'Menyatakan tiada fakta tepat kerana 2035 belum berlaku, sebarang nombor adalah unjuran/anggaran.',
      validator: (out) => {
         const lower = out.toLowerCase()
         return (lower.includes('tiada') || lower.includes('belum') || lower.includes('tidak ada angka tepat')) &&
                (lower.includes('andaian') || lower.includes('unjuran') || lower.includes('anggaran'))
      }
   }
]

async function runTestSuite() {
   console.log('╔══════════════════════════════════════════════════════════════════╗')
   console.log('║           MEMULAKAN SUITE UJIAN KECERDASAN DENIA AI              ║')
   console.log('║                  MODEL: GPT-5 (PREXZY ENJIN)                     ║')
   console.log('╚══════════════════════════════════════════════════════════════════╝\n')

   let passedCount = 0
   const totalTests = testCases.length

   for (const tc of testCases) {
      console.log(`▶ Menguji [Ujian ${tc.id}: ${tc.title}]...`)
      const startTime = Date.now()

      try {
         const output = await queryAnalytical(tc.prompt)
         const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

         if (tc.isCodeTest) {
            // Ekstrak blok kod JavaScript
            const codeBlockMatch = output.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i)
            const codeToTest = codeBlockMatch ? codeBlockMatch[1] : output

            let executionPassed = false
            let execErrors = []

            try {
               // Bina fungsi untuk diuji
               const fnWrapper = new Function(`${codeToTest}; return typeof secondLargest === 'function' ? secondLargest : null;`)
               const secondLargest = fnWrapper()

               if (!secondLargest) {
                  execErrors.push('Fungsi secondLargest tidak ditemui dalam kod yang dijana.')
               } else {
                  const testsToRun = [
                     { input: [5, 5, 3], expected: 3 },
                     { input: [7, 7, 7], expected: null },
                     { input: [-Infinity, -Infinity], expected: null },
                     { input: [-10, -20, -30], expected: -20 },
                     { input: [], expected: null }
                  ]

                  let allCasesOk = true
                  for (const c of testsToRun) {
                     const res = secondLargest(c.input)
                     // Terima null atau undefined untuk kes tiada jawapan
                     const isMatch = (c.expected === null)
                        ? (res === null || res === undefined)
                        : (res === c.expected)

                     if (!isMatch) {
                        allCasesOk = false
                        execErrors.push(`Input [${c.input}]: Dijangka ${c.expected}, dapat ${res}`)
                     }
                  }
                  executionPassed = allCasesOk
               }
            } catch (runErr) {
               execErrors.push(`Ralat eksekusi: ${runErr.message}`)
            }

            if (executionPassed) {
               passedCount++
               console.log(`   ✅ LULUS (Masa: ${elapsed}s) — Kod dieksekusi secara sebenar & melepasi semua 5 kes!`)
            } else {
               console.log(`   ❌ GAGAL (Masa: ${elapsed}s) — ${execErrors.join(' | ')}`)
            }
         } else {
            const isOk = tc.validator(output)
            if (isOk) {
               passedCount++
               console.log(`   ✅ LULUS (Masa: ${elapsed}s) — Menepati kriteria penerimaan.`)
            } else {
               console.log(`   ❌ GAGAL (Masa: ${elapsed}s) — Jawapan tidak menepati kriteria.`)
               console.log(`      Output ringkas: ${output.slice(0, 150)}...`)
            }
         }
      } catch (err) {
         console.log(`   ❌ RALAT: ${err.message}`)
      }
      console.log('')
   }

   console.log('──────────────────────────────────────────────────────────────────')
   console.log(`KEPUTUSAN KESELURUHAN: ${passedCount} / ${totalTests} UJIAN LULUS (${((passedCount/totalTests)*100).toFixed(0)}%)`)
   console.log('──────────────────────────────────────────────────────────────────\n')
}

runTestSuite().catch(console.error)

