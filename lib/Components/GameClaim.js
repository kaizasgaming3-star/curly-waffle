/*
 * Penyimpan KODE KLAIM untuk game kartu HTML (tictactoe, pou).
 *
 * Kenapa perlu: kartu HTML jalan di sandbox WhatsApp dan sama sekali tidak bisa
 * menghubungi bot (lihat catatan di RichHtml.js). Jadi hasil main tidak mungkin
 * dilaporkan sendiri oleh kartu. Polanya: server menyiapkan kode acak, kartu cuma
 * MEMPERLIHATKAN kode itu kalau syaratnya tercapai, lalu pemain mengetik ulang
 * kodenya ke bot untuk menukarnya jadi hadiah.
 *
 * File ini sengaja ditaruh di lib/, bukan di dalam plugin. Watcher.js memuat ulang
 * berkas plugin dengan cache-buster (`?update=`) setiap kali berubah - kalau
 * penyimpannya ada di dalam plugin, semua kode yang menggantung ikut hilang tiap
 * plugin tersentuh. Module di lib/ dipakai bersama dan hanya dimuat sekali.
 *
 * Disimpan di memori saja (hangus kalau bot restart) - ini hadiah main-main,
 * bukan data yang perlu awet.
 */

const Claims = new Map()

// Kode berlaku 30 menit. Cukup lama untuk sekali main, cukup pendek supaya kode
// lama tidak menumpuk di memori.
export const CLAIM_TTL = 30 * 60 * 1000

const compose = (kind, key) => `${kind}:${key}`

/** Buang semua kode yang sudah lewat masa berlakunya. */
export const pruneClaim = () => {
   const now = Date.now()
   for (const [key, value] of Claims)
      if (!value || value.expires <= now)
         Claims.delete(key)
}

/**
 * Simpan satu kode klaim.
 * @param {string} kind jenis game ('ttt', 'pou', 'pouCoin'). Dipisah supaya kode
 *        dari satu game tidak bisa dipakai mengklaim hadiah game lain.
 * @param {string} key  pemilik kode, biasanya m.sender.
 */
export const setClaim = (kind, key, data) => {
   pruneClaim()
   Claims.set(compose(kind, key), {
      ...data,
      expires: Date.now() + CLAIM_TTL
   })
}

export const getClaim = (kind, key) => {
   pruneClaim()
   return Claims.get(compose(kind, key)) ?? null
}

export const deleteClaim = (kind, key) =>
   Claims.delete(compose(kind, key))

/**
 * Papan peringkat 5 besar untuk panel di dalam kartu.
 *
 * Memakai `limit` sebagai nilai peringkat, bukan field skor tersendiri, supaya
 * game kartu ikut ekonomi yang sama dengan game kuis di bot ini.
 */
export const buildCardLeaderboard = (db, meJid) => {
   try {
      return [...new Set(db.users.values())]
         .filter(user => user?.jid && !user.banned)
         .sort((a, b) => (b.limit ?? 0) - (a.limit ?? 0))
         .slice(0, 5)
         .map(user => ({
            name: user.name,
            number: user.jid.split('@')[0],
            score: user.limit ?? 0,
            isMe: user.jid === meJid
         }))
   }
   catch {
      return []
   }
}
