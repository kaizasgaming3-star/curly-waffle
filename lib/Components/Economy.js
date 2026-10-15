/*
 * Inti SISTEM EKONOMI bot: dompet, bank, dan katalog item toko.
 *
 * Kenapa dipisah ke lib/: berkas plugin dimuat ulang Watcher.js dengan
 * cache-buster setiap kali berubah (lihat catatan di GameClaim.js). Aturan main
 * ekonomi harus SATU sumber kebenaran - kalau harga item atau rumus kerja
 * ditulis ulang di tiap plugin, cepat atau lambat angkanya jadi tidak konsisten
 * antar perintah. Semua plugin ekonomi mengimpor dari sini.
 *
 * Mata uangnya memakai field `coin` yang sudah dipakai game Pou, jadi item di
 * toko ini benar-benar bisa dibeli dari hasil main game - bukan ekonomi terpisah
 * yang menggantung tanpa sumber pemasukan.
 */

import { HOUR, MINUTE } from '../Constants.js'

/** Aturan kerja harian. Bayaran sengaja kecil supaya tidak mengalahkan game. */
export const WORK = Object.freeze({
   cooldown: 15 * MINUTE,
   min: 6,
   max: 24,
   /** Bonus upah kalau punya Pickaxe (persentase dari upah dasar). */
   pickaxeBonus: 0.3,
   /** Item yang menaikkan upah. */
   bonusItem: 'pickaxe'
})

/** Hadiah harian. Nilainya naik mengikuti streak yang sedang berjalan. */
export const DAILY = Object.freeze({
   cooldown: 24 * HOUR,
   baseCoin: 60,
   baseLimit: 2,
   baseEnergy: 30,
   /** Tambahan coin per hari streak. */
   streakCoin: 15,
   /** Streak tidak dihitung lebih dari ini. */
   maxStreak: 7,
   /** Bonus seluruh hadiah kalau punya Vault (persentase). */
   vaultBonus: 0.5,
   bonusItem: 'vault'
})

/** Bank: menahan coin dari rampok dan memberi bunga saat klaim harian. */
export const BANK = Object.freeze({
   minAmount: 10,
   interestRate: 0.02,
   /** Bunga harian tidak pernah melebihi angka ini, sebesar apa pun tabungannya. */
   interestCap: 500
})

/** Rampok: mengambil coin yang disimpan di DOMPET korban, bukan di bank. */
export const ROB = Object.freeze({
   cooldown: 30 * MINUTE,
   /** Peluang dasar berhasil sebelum bonus item. */
   baseChance: 0.45,
   /** Tambahan peluang dari Coin Magnet. */
   magnetBonus: 0.2,
   magnetItem: 'magnet',
   /** Korban di bawah saldo ini tidak menarik dirampok. */
   minWallet: 50,
   /** Bagian dompet korban yang bisa dibawa kabur. */
   maxStealRate: 0.35,
   /** Batas atas hasil curian, supaya dompet besar tidak dihabiskan sekali rampok. */
   maxSteal: 750,
   minSteal: 10,
   /** Denda kalau gagal, dihitung dari dompet perampok sendiri. */
   fineRate: 0.25
})

/** Judi koin. Menang dapat 2x taruhan, kalah taruhan hangus. */
export const GAMBLE = Object.freeze({
   cooldown: 1 * MINUTE,
   minBet: 10,
   maxBet: 5000,
   /** Peluang menang dasar - sedikit di bawah 50% supaya bot tidak jadi bank bocor. */
   winChance: 0.48,
   /** Tambahan peluang per Lucky Clover yang dipegang. */
   cloverBonus: 0.15,
   cloverItem: 'clover',
   /** Maksimal clover yang bisa menumpuk. */
   maxClover: 3,
   payoutMultiplier: 2
})

/** Item yang habis dipakai dan tidak bisa dijual kembali setelah terpakai. */
export const SHIELD_DURATION = 12 * HOUR

/** Item dijual kembali dengan potongan, supaya beli-jual tidak jadi celah cuci coin. */
export const ITEM_SELL_RATE = 0.6

/** Batas atas energy user di seluruh bot. */
export const MAX_ENERGY = 100

/** Efek item sekali pakai. Dipakai perintah `use` dan pemeriksaan di plugin lain. */
export const TYPED_ITEMS = Object.freeze({
   shield: {
      duration: SHIELD_DURATION
   },
   clover: {
      maxStack: GAMBLE.maxClover
   },
   energy: {
      restore: 50,
      maxEnergy: MAX_ENERGY
   },
   coupon: {
      limit: 5
   }
})

/**
 * Katalog toko. `permanent` berarti sekali beli langsung terpasang dan efeknya
 * jalan terus; item tanpa `permanent` adalah barang sekali pakai.
 */
export const ITEMS = Object.freeze({
   pickaxe: {
      name: 'Pickaxe',
      emoji: '⛏️',
      price: 350,
      permanent: true,
      description: `+${Math.round(WORK.pickaxeBonus * 100)}% coin from work`
   },
   magnet: {
      name: 'Coin Magnet',
      emoji: '🧲',
      price: 500,
      permanent: true,
      description: `+${Math.round(ROB.magnetBonus * 100)}% success chance when robbing`
   },
   vault: {
      name: 'Vault',
      emoji: '🔐',
      price: 800,
      permanent: true,
      description: `+${Math.round(DAILY.vaultBonus * 100)}% coin and interest from daily`
   },
   shield: {
      name: 'Energy Shield',
      emoji: '🛡️',
      price: 200,
      permanent: false,
      description: `Blocks every rob attempt for ${SHIELD_DURATION / HOUR} hours`
   },
   clover: {
      name: 'Lucky Clover',
      emoji: '🍀',
      price: 150,
      permanent: false,
      description: `+${Math.round(GAMBLE.cloverBonus * 100)}% win chance on your next gamble`
   },
   energy: {
      name: 'Energy Drink',
      emoji: '⚡',
      price: 120,
      permanent: false,
      description: `Restores ${TYPED_ITEMS.energy.restore} energy instantly`
   },
   coupon: {
      name: 'Limit Coupon',
      emoji: '🎫',
      price: 180,
      permanent: false,
      description: `Adds ${TYPED_ITEMS.coupon.limit} limit instantly`
   }
})

/** Item yang bisa dibeli pembeli pertama kali; dipakai untuk memisah tool tahan pakai. */
export const PERMANENT_ITEM_IDS = Object.freeze(
   Object.keys(ITEMS).filter(id => ITEMS[id].permanent)
)

export const isItemId = (id) =>
   Object.prototype.hasOwnProperty.call(ITEMS, id)

/**
 * Cari id item dari yang diketik user. Menerima id persis, potongan awal id,
 * atau nama item, supaya `pickaxe`, `pick`, dan `Pickaxe` sama-sama jalan.
 */
export const resolveItemId = (input) => {
   if (typeof input !== 'string') return null

   const query = input.trim().toLowerCase()
   if (!query) return null

   if (isItemId(query)) return query

   for (const id of Object.keys(ITEMS))
      if (ITEMS[id].name.toLowerCase() === query) return id

   const partial = Object.keys(ITEMS).filter(id => id.startsWith(query))
   if (partial.length === 1) return partial[0]

   return null
}

export const sellPrice = (id) =>
   isItemId(id) ? Math.floor(ITEMS[id].price * ITEM_SELL_RATE) : 0

/* ********** DOMPET & BANK ********** */

export const getWallet = (user) =>
   user?.coin ?? 0

export const getBank = (user) =>
   user?.bank ?? 0

export const netWorth = (user) =>
   getWallet(user) + getBank(user)

/** Tambah/kurang coin dompet. Nilai selalu dibulatkan ke bilangan bulat. */
export const addCoin = (user, amount) => {
   const value = Math.trunc(amount)
   if (!user || !value) return getWallet(user)

   user.coin = Math.max(0, getWallet(user) + value)
   return user.coin
}

export const removeCoin = (user, amount) =>
   addCoin(user, -Math.abs(Math.trunc(amount)))

/* ********** INVENTARIS ********** */

/** Map inventaris selalu dalam bentuk objek { itemId: jumlah }. */
export const getInventory = (user) => {
   if (!user) return {}

   if (!user.inventory || typeof user.inventory !== 'object' || Array.isArray(user.inventory))
      user.inventory = {}

   return user.inventory
}

export const countItem = (user, id) => {
   if (!isItemId(id)) return 0
   return getInventory(user)[id] ?? 0
}

export const hasItem = (user, id) =>
   countItem(user, id) > 0

export const addItem = (user, id, quantity = 1) => {
   if (!isItemId(id) || quantity <= 0) return countItem(user, id)

   const inventory = getInventory(user)
   inventory[id] = (inventory[id] ?? 0) + Math.trunc(quantity)

   return inventory[id]
}

/** Buang item. Mengembalikan false kalau jumlahnya tidak cukup, jadi tidak ada yang hilang. */
export const removeItem = (user, id, quantity = 1) => {
   if (!isItemId(id) || quantity <= 0) return false

   const inventory = getInventory(user)
   const owned = inventory[id] ?? 0
   if (owned < quantity) return false

   const left = owned - quantity
   if (left > 0) inventory[id] = left
   else delete inventory[id]

   return true
}

/** Hitung total item yang dipegang, untuk ringkasan di `inventory`. */
export const totalItems = (user) => {
   let total = 0
   for (const quantity of Object.values(getInventory(user)))
      total += quantity
   return total
}

/* ********** EFEK ITEM ********** */

/** Shield menahan rampok sampai waktu ini lewat. */
export const getShieldUntil = (user) =>
   user?.shieldUntil ?? 0

export const hasShield = (user, now = Date.now()) =>
   getShieldUntil(user) > now

/** Sisa masa berlaku shield dalam ms, 0 kalau tidak aktif. */
export const shieldRemaining = (user, now = Date.now()) =>
   Math.max(0, getShieldUntil(user) - now)

/** Jumlah Lucky Clover yang sudah dipegang (dipakai saat judi). */
export const getCloverBoost = (user) =>
   Math.max(0, user?.cloverBoost ?? 0)

/**
 * Buka satu Lucky Clover. Mengembalikan true kalau berhasil dipakai, false kalau
 * tumpukannya sudah penuh atau tidak punya sama sekali.
 */
export const useClover = (user) => {
   if (getCloverBoost(user) >= GAMBLE.maxClover) return false
   if (!removeItem(user, GAMBLE.cloverItem, 1)) return false

   user.cloverBoost = getCloverBoost(user) + 1
   return true
}

/** Pakai satu Clover untuk satu kali judi. Mengembalikan true kalau bonus terpakai. */
export const spendClover = (user) => {
   const boost = getCloverBoost(user)
   if (boost < 1) return false

   user.cloverBoost = boost - 1
   return true
}

/** Pasang shield baru. Menimpa sisa waktu yang lama, bukan menumpuk. */
export const applyShield = (user, now = Date.now()) => {
   user.shieldUntil = now + SHIELD_DURATION
   return user.shieldUntil
}

export const clearShield = (user) => {
   user.shieldUntil = 0
}

/* ********** HITUNGAN LAIN ********** */

/**
 * Baca jumlah coin dari ketikan user.
 *
 * Menerima angka polos, atau `all`/`semua`/`max` yang berarti seluruh saldo yang
 * disebut lewat `maxAmount`. Mengembalikan null kalau tidak bisa dibaca, supaya
 * pemanggil bisa membedakan "salah ketik" dari "nol".
 */
export const parseAmount = (input, maxAmount = Infinity) => {
   if (typeof input !== 'string') return null

   const query = input.trim().toLowerCase()
   if (!query) return null

   if (query === 'all' || query === 'semua' || query === 'max')
      return Math.max(0, Math.floor(maxAmount))

   if (!/^\d+$/.test(query)) return null

   const amount = Number(query)
   if (!Number.isSafeInteger(amount)) return null

   return amount
}

/** Peringkat dompet+bank semua user, dipakai `balance` dan `richest`. */
export const rankOf = (users, meJid) => {
   const sorted = [...new Set(users.values())]
      .filter(user => user?.jid)
      .sort((a, b) => netWorth(b) - netWorth(a))

   const index = sorted.findIndex(user => user.jid === meJid)

   return {
      list: sorted,
      position: index === -1 ? 0 : index + 1,
      total: sorted.length
   }
}
