/*
 * Kurva LEVEL & XP untuk fitur ekonomi.
 *
 * Dipisah dari Economy.js karena tanggung jawabnya beda: Economy.js mengurus
 * uang dan barang, file ini mengurus progres pemain. Level bukan hiasan - tiap
 * naik level memberi coin, limit, dan energy, jadi leveling ikut menyuapi
 * ekonomi yang sama dan bukan angka kosong di profil.
 *
 * XP didapat otomatis dari setiap pesan lewat plugin event `plugins/group/_leveling.js`.
 */

import { SECOND } from '../Constants.js'
import { addCoin, MAX_ENERGY } from './Economy.js'

export const LEVELING = Object.freeze({
   /** XP per pesan. Kecil, karena pesan datang terus-menerus. */
   xpPerMessage: 1,
   /**
    * Jeda minimum antar perolehan XP. Tanpa ini, satu orang yang spam 100 pesan
    * dalam semenit naik level secepat orang yang chat wajar seharian.
    */
   xpCooldown: 5 * SECOND,
   /** XP yang dibutuhkan untuk naik dari level 1 ke level 2. */
   baseXp: 50,
   /** Tambahan kebutuhan XP tiap level berikutnya. */
   xpGrowth: 25,
   maxLevel: 100
})

/** Gelar pemain berdasarkan level. Dipakai di `balance` dan pesan naik level. */
const RANK_TITLES = Object.freeze([
   { min: 100, title: 'Immortal' },
   { min: 75, title: 'Mythic' },
   { min: 50, title: 'Legend' },
   { min: 35, title: 'Elite' },
   { min: 20, title: 'Veteran' },
   { min: 10, title: 'Regular' },
   { min: 5, title: 'Wanderer' },
   { min: 1, title: 'Newcomer' }
])

export const getLevel = (user) =>
   Math.max(1, user?.level ?? 1)

export const getXp = (user) =>
   Math.max(0, user?.xp ?? 0)

/** XP yang dibutuhkan untuk naik dari `level` ke level berikutnya. */
export const xpToNext = (level) =>
   LEVELING.baseXp + (Math.max(1, level) - 1) * LEVELING.xpGrowth

export const rankTitle = (level) => {
   const current = getLevel({ level })
   for (const entry of RANK_TITLES)
      if (current >= entry.min) return entry.title
   return 'Newcomer'
}

/** Hadiah tiap naik level. Makin tinggi level, makin besar. */
export const levelReward = (level) => ({
   coin: 25 + level * 15,
   limit: Math.max(1, Math.floor(level / 3)),
   energy: 10
})

/** Bar progres teks, misal `▰▰▰▰▱▱▱▱▱▱`. */
export const progressBar = (current, total, size = 10) => {
   if (!(total > 0)) return '▰'.repeat(size)

   const ratio = Math.min(1, Math.max(0, current / total))
   const filled = Math.min(size, Math.max(0, Math.round(ratio * size)))

   return '▰'.repeat(filled) + '▱'.repeat(size - filled)
}

/**
 * Boleh dapat XP sekarang? Dibatasi jeda antar pesan supaya tidak bisa di-spam.
 * Pemain baru (lastXp masih 0) selalu boleh.
 */
export const shouldGainXp = (user, now = Date.now()) => {
   const lastXp = user?.lastXp ?? 0
   if (lastXp <= 0) return true

   return now - lastXp >= LEVELING.xpCooldown
}

/**
 * Beri XP dan proses semua kenaikan level yang terjadi.
 *
 * Efeknya (coin, limit, energy) LANGSUNG diterapkan ke user di sini, jadi tidak
 * ada kesempatan pemanggil lupa membayar hadiahnya. Yang dikembalikan hanya
 * catatan kenaikannya, untuk diumumkan ke chat.
 *
 * @returns {{ gained: number, levelUps: Array<{ level: number, coin: number, limit: number, energy: number }> }}
 */
export const grantXp = (user, amount = LEVELING.xpPerMessage, now = Date.now()) => {
   const gained = Math.trunc(amount)
   if (!user || gained <= 0) return { gained: 0, levelUps: [] }

   const levelUps = []

   let level = getLevel(user)
   let xp = getXp(user) + gained

   while (level < LEVELING.maxLevel && xp >= xpToNext(level)) {
      xp -= xpToNext(level)
      level++

      const reward = levelReward(level)

      addCoin(user, reward.coin)
      user.limit = (user.limit ?? 0) + reward.limit
      user.energy = Math.min(MAX_ENERGY, (user.energy ?? 0) + reward.energy)

      levelUps.push({
         level,
         ...reward
      })
   }

   // Di level maksimum tidak ada level berikutnya lagi, jadi XP ditahan di ambang
   // terakhir daripada menumpuk jadi angka tak berarti.
   if (level >= LEVELING.maxLevel)
      xp = Math.min(xp, xpToNext(LEVELING.maxLevel) - 1)

   user.level = level
   user.xp = xp
   user.lastXp = now

   return {
      gained,
      levelUps
   }
}
