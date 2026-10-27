/**
 * ══════════════════════════════════════════════════════════════════════
 *                    DENIA AI ADAPTER (GPT-5 ENHANCED)
 * ══════════════════════════════════════════════════════════════════════
 * Modul perantara pintar untuk menghubungkan bot Denia dengan enjin AI.
 * Menyokong Prexzy AI (Model: gpt-5), fallback bertingkat, pengendalian
 * ralat selamat, semakan kualiti output, dan mod nyahpepijat kod.
 */

import fs from 'fs'
import path from 'path'

// Muat pemboleh ubah persekitaran jika fail .env wujud
try {
   const envPath = path.resolve(process.cwd(), '.env')
   if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(envPath)
   }
} catch (_) {}

export const AI_CONFIG = {
   provider: process.env.AI_PROVIDER || 'prexzy',
   model: process.env.AI_MODEL || 'gpt-5',
   baseUrl: process.env.AI_BASE_URL || 'https://prexzyapis.com/ai/aiwriter-chat',
   apiKey: process.env.AI_API_KEY || '',
   timeout: parseInt(process.env.AI_TIMEOUT, 10) || 25000,
   maxRetries: parseInt(process.env.AI_MAX_RETRIES, 10) || 2,
   maxTokens: parseInt(process.env.AI_MAX_OUTPUT_TOKENS, 10) || 2048
}

// Senarai pembekal sandaran (fallback providers) sekiranya model utama gagal
const FALLBACK_ENDPOINTS = [
   {
      name: 'Prexzy-GPT5-POST',
      call: async (prompt, model, timeout) => {
         const res = await fetch('https://prexzyapis.com/ai/aiwriter-chat', {
            method: 'POST',
            signal: AbortSignal.timeout(timeout),
            headers: {
               'Content-Type': 'application/json',
               'Accept': 'application/json',
               'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DeniaBot/2.0'
            },
            body: JSON.stringify({ prompt, model })
         })
         if (!res.ok) throw new Error(`HTTP ${res.status}`)
         const data = await res.json()
         const text = data?.result?.text?.[0] || data?.result?.text || data?.result || data?.answer
         return typeof text === 'string' ? text.trim() : null
      }
   },
   {
      name: 'Prexzy-Gemini',
      call: async (prompt, _, timeout) => {
         const res = await fetch(`https://prexzyapis.com/ai/gemini?prompt=${encodeURIComponent(prompt)}`, {
            signal: AbortSignal.timeout(timeout),
            headers: { 'Accept': 'application/json', 'User-Agent': 'DeniaBot/2.0' }
         })
         if (!res.ok) throw new Error(`HTTP ${res.status}`)
         const data = await res.json()
         const text = data?.response || data?.result || data?.answer
         return typeof text === 'string' ? text.trim() : null
      }
   },
   {
      name: 'Prexzy-AskGPT5',
      call: async (prompt, _, timeout) => {
         const res = await fetch(`https://prexzyapis.com/ai/askgpt5?prompt=${encodeURIComponent(prompt)}`, {
            signal: AbortSignal.timeout(timeout),
            headers: { 'Accept': 'application/json', 'User-Agent': 'DeniaBot/2.0' }
         })
         if (!res.ok) throw new Error(`HTTP ${res.status}`)
         const data = await res.json()
         const text = data?.response || data?.result || data?.answer
         return typeof text === 'string' ? text.trim() : null
      }
   },
   {
      name: 'Prexzy-Qwen',
      call: async (prompt, _, timeout) => {
         const res = await fetch(`https://prexzyapis.com/ai/qwen?prompt=${encodeURIComponent(prompt)}`, {
            signal: AbortSignal.timeout(timeout),
            headers: { 'Accept': 'application/json', 'User-Agent': 'DeniaBot/2.0' }
         })
         if (!res.ok) throw new Error(`HTTP ${res.status}`)
         const data = await res.json()
         const text = data?.response || data?.result || data?.answer
         return typeof text === 'string' ? text.trim() : null
      }
   },
   {
      name: 'Prexzy-CH',
      call: async (prompt, _, timeout) => {
         const res = await fetch(`https://prexzyapis.com/ai/ch?q=${encodeURIComponent(prompt)}`, {
            signal: AbortSignal.timeout(timeout),
            headers: { 'Accept': 'application/json', 'User-Agent': 'DeniaBot/2.0' }
         })
         if (!res.ok) throw new Error(`HTTP ${res.status}`)
         const data = await res.json()
         const text = data?.response || data?.result || data?.answer
         return typeof text === 'string' ? text.trim() : null
      }
   }
]

/**
 * Panggilan teras ke enjin Prexzy AI (Model: gpt-5)
 */
async function callPrimaryAPI(prompt, model, timeout) {
   const url = `https://prexzyapis.com/ai/aiwriter-chat?prompt=${encodeURIComponent(prompt)}&model=${encodeURIComponent(model)}`
   const res = await fetch(url, {
      signal: AbortSignal.timeout(timeout),
      headers: {
         'Accept': 'application/json',
         'User-Agent': 'Mozilla/5.0 (compatible; DeniaBot/2.0)'
      }
   })

   if (!res.ok) {
      throw new Error(`API utama mengembalikan status HTTP ${res.status}`)
   }

   const data = await res.json()
   const textArray = data?.result?.text
   let answer = Array.isArray(textArray) ? textArray.join('\n') : textArray || data?.result || data?.answer

   if (typeof answer === 'string' && answer.trim().length > 0) {
      return answer.trim()
   }

   throw new Error('Format respons API utama tidak mengandungi teks jawapan yang sah')
}

/**
 * Semakan kualiti jawapan (Sanity Check)
 */
export function sanitizeAndVerifyOutput(rawOutput) {
   if (!rawOutput || typeof rawOutput !== 'string') {
      return { ok: false, cleanText: '' }
   }

   let clean = rawOutput.trim()

   // Bersihkan token pelik atau markup yang tidak lengkap
   clean = clean.replace(/<\|endoftext\|>/gi, '').trim()

   // Semak jika output terlalu pendek atau mengandungi kod ralat mentah
   if (clean.length < 2) {
      return { ok: false, cleanText: clean }
   }

   return { ok: true, cleanText: clean }
}

/**
 * Hantar permintaan kepada AI dengan sokongan Retry & Fallback berperingkat
 */
export async function queryAI(prompt, options = {}) {
   const model = options.model || AI_CONFIG.model
   const timeout = options.timeout || AI_CONFIG.timeout
   const maxRetries = options.maxRetries ?? AI_CONFIG.maxRetries

   let lastError = null

   // 1. Cuba Endpoint Utama (dengan cubaan semula terhad)
   for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
         const rawAns = await callPrimaryAPI(prompt, model, timeout)
         const verified = sanitizeAndVerifyOutput(rawAns)
         if (verified.ok) {
            return verified.cleanText
         }
      } catch (err) {
         lastError = err
         if (attempt < maxRetries) {
            // Jeda 500ms sebelum mencuba semula
            await new Promise(r => setTimeout(r, 500))
         }
      }
   }

   console.warn(`[AI ADAPTER] API utama gagal (${lastError?.message}), mengaktifkan fallback bertingkat...`)

   // 2. Fallback Bertingkat ke endpoint sokongan
   for (const fallback of FALLBACK_ENDPOINTS) {
      try {
         const rawAns = await fallback.call(prompt, model, timeout)
         const verified = sanitizeAndVerifyOutput(rawAns)
         if (verified.ok) {
            console.log(`[AI ADAPTER] ✅ Berjaya menerima jawapan melalui fallback: ${fallback.name}`)
            return verified.cleanText
         }
      } catch (fbErr) {
         lastError = fbErr
      }
   }

   throw new Error(`Semua enjin AI gagal memberikan respons. Ralat terakhir: ${lastError?.message || 'Tiada sambungan'}`)
}

/**
 * Mod Soalan Analitikal / Matematik / Sains / Logik Pintar
 */
export async function queryAnalytical(question, options = {}) {
   const enhancedPrompt =
`[ARAHAN ANALISIS PINTAR]
Sila selesaikan soalan berikut dengan penaakulan mendalam dan tepat:
1. Baca keseluruhan soalan dengan teliti sebelum membuat kesimpulan.
2. Tunjukkan langkah demi langkah penyelesaian atau jalan kira algebra/matematik yang jelas.
3. Bezakan fakta yang disahkan daripada andaian atau jangkaan masa hadapan.
4. Jangan mereka-reka fakta atau angka jika maklumat tidak lengkap (nyatakan kekurangan data secara jujur).
5. Buat semakan kendiri pada jawapan akhir anda untuk memastikan tiada kesilapan logik atau falasi.
6. Jawab dalam Bahasa Melayu yang tersusun, kemas dan mudah difahami.

SOALAN:
${question}`

   return await queryAI(enhancedPrompt, options)
}

/**
 * Mod Semakan Kod & Nyahpepijat (Code Debugging)
 */
export async function debugCode(codeSnippet, options = {}) {
   const debugPrompt =
`[ARAHAN NYAHPEPIJAT KOD (CODE DEBUGGER)]
Sila analisis dan semak kod pengaturcaraan berikut secara teliti:
1. Semak ralat sintaks, ralat logik (runtime error), dan kes tepi (cth: array kosong, nombor negatif, infinity, duplikat, null/undefined).
2. Nyatakan masalah yang ditemui secara spesifik dan terangkan puncanya.
3. Berikan versi kod yang telah dibaiki dengan komen penjelasan yang berguna.
4. Sediakan contoh ujian input dan output yang dijangkakan bagi mengesahkan pembaikan.
5. Nyatakan jika analisis dibuat secara statik/pemerhatian kod.

KOD / MASALAH:
${codeSnippet}`

   return await queryAI(debugPrompt, options)
}

export default {
   queryAI,
   queryAnalytical,
   debugCode,
   sanitizeAndVerifyOutput,
   AI_CONFIG
}

