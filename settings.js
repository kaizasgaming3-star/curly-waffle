import { LRUCache } from 'lru-cache'
import { cpus } from 'os'
import { DEFAULT_CONNECTION_CONFIG, fetchLatestWaWebVersion } from '@sairidev/baileys-new'

const CPU_COUNT = cpus().length

// Owner name
global.ownerName = 'Kaizas'
global.ownerUsername = 'kaizas'

// Owner phone number
global.ownerNumber = '601118837488'

// Bot name
global.botName = 'Denia'

// Footer text
global.footer = '✦ Denia'

// [IMPORTANT] Bot phone number for pairing code
global.botNumber = '601115388813'

// Pairing using code method (set to true for pairing code, false for QR pairing)
global.pairingCode = true

// User default limit (used for reset too)
global.defaultLimit = 15

// Sticker pack name
global.stickerPackName = '📦 Denia Sticker'

// Sticker pack publisher
global.stickerPackPublisher = 'kaizas'

// ********** API KEYS ********** //

// Google AI Studio for Chat Bot @ https://aistudio.google.com/
global.googleApiKey = ''

// SightEngine for Anti Porn @ https://sightengine.com/
global.apiUser = ''
global.apiSecret = ''

// ********** ADVANCED SETTINGS ********** //

// Local timezone
global.localTimezone = 'Asia/Jakarta'

// Bot thumbnail (optional, you can change it with setcover command)
global.botThumbnail = './media/Image/thumbnail.jpg'

// Bot menu music (optional, you can change it with setmenumusic command)
global.botMenuMusic = './media/Audio/menu-music.mp3'

// Temporary folder name (optional)
global.temporaryFolder = 'temp'

// Plugins folder name (optional)
global.pluginsFolder = 'plugins'

// Auth state folder name (optional) - menyokong pengasingan sesi setiap bot/nombor
global.authFolder = process.env.AUTH_FOLDER || (global.botNumber ? `session/${global.botNumber}` : 'session')

// Store file name (optional)
global.storeFilename = 'database/store.json'

// Database file name (optional)
global.databaseFilename = 'database/database.json'

// Interval to clean temporary files (ms)
global.temporaryFileInterval = 30 * 60 * 1_000

// Persist database to file interval (ms)
global.dataInterval = 10 * 60 * 1_000

// Call the garbage collector if exposed (ms)
global.gcInterval = 1 * 60 * 60 * 1_000

// API request timeout (ms)
global.requestTimeout = 1.5 * 60 * 1_000

// FFmpeg process timeout (ms)
global.ffmpegTimeout = 1 * 60 * 1_000

// Min delay response (ms)
global.minDelay = 100

// Max delay response (ms)
global.maxDelay = 3 * 1_000

// Ignore user old message (sec)
global.ignoreOldMessageTS = 30

// RSS limit (mb)
global.rssLimit = 384 * 1_024 * 1_024

// FFmpeg stream max concurrent processes (min: 1)
global.ffmpegConcurrency = Math.max(4, Math.floor(CPU_COUNT * 1.3))

// Maximum allowed NSFW score (lower values are stricter)
global.maxNSFWScore = 0.75

// Maximum chat bot history length
global.maxHistoryChatSize = 20

// Global explore session cache
global.ExploreSession = new LRUCache({
   max: 256,
   ttl: 1.5 * 60 * 1_000,
   updateAgeOnGet: false,
   updateAgeOnHas: false,
   ttlAutopurge: true
})

// Auto-sync latest WhatsApp Web version non-blocking
fetchLatestWaWebVersion()
   .then(waWeb => {
      if (waWeb?.version) {
         DEFAULT_CONNECTION_CONFIG.version = waWeb.version
      }
   })
   .catch(() => {})

