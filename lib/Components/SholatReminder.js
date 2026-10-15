/**
 * This file is part of the SairiDev Bot WhatsApp project, solely developed and maintained by SairiDev.
 * https://github.com/sairidev
 *
 * All rights reserved.
 *
 * - You are NOT allowed to copy, rewrite, modify, redistribute, or reuse this file in any form.
 * - You are NOT allowed to claim this file or any part of this project as your own.
 * - This credit notice must NOT be removed or altered.
 * - This file may ONLY be used within the SairiDev project.
 */

import { delay } from '@sairidev/baileys-new'

import { FAKE_QUOTE } from '../Constants.js'
import { request } from '../Request.js'
import { fetchAsBuffer, frame, getIndonesianTimezone, getNextMidnight, getNowInTZ, toTitleCase } from '../Utilities.js'

const LOCALE_TIME_MAP = {
   'Asia/Jakarta': 1301,
   'Asia/Makassar': 2622,
   'Asia/Jayapura': 3329
}

const MESSAGES = {
   imsak: 'The time for Imsak has arrived. Please finish your pre-dawn meal.',
   subuh: 'The time for Fajr has arrived. Let us prepare for prayer.',
   terbit: 'The sun has risen. May your day go smoothly and be full of blessings.',
   dhuha: 'The time for Duha prayer has arrived. Please perform the Duha prayer.',
   dzuhur: 'The time for Dhuhr has arrived. Let us perform the prayer.',
   ashar: 'The time for Asr has arrived. Please prepare for prayer.',
   maghrib: 'The time for Maghrib has arrived. Please perform the prayer.',
   isya: 'The time for Isha has arrived. Let us complete our worship tonight.'
}

const MESSAGE_EMOJIS = {
   imsak: '🌙',
   subuh: '🌅',
   terbit: '☀️',
   dhuha: '🌤️',
   dzuhur: '🌞',
   ashar: '🌇',
   maghrib: '🌆',
   isya: '🌙'
}

const parseTime = (dateStr, timeStr) => {
   const [year, month, day] = dateStr.split('-').map(Number)
   const [hour, minute] = timeStr.split(':').map(Number)

   return new Date(year, month - 1, day, hour, minute, 0)
}

const getSchedule = async (kotaId) => {
   const now = getNowInTZ()
   const year = now.getFullYear()
   const month = String(now.getMonth() + 1).padStart(2, '0')
   const day = String(now.getDate()).padStart(2, '0')

   const json = await request(`https://api.myquran.com/v2/sholat/jadwal/${kotaId}/${year}/${month}/${day}`)

   if (json?.status && json.data?.jadwal)
      return json.data

   throw new Error('Failed to get prayers schedule')
}

export default (db = {}) => {
   let socket = {},
      groupIds = [],
      timeouts = [],
      currentDate = null,
      isRunning = false

   const clearAll = () => {
      timeouts.forEach(timeout => clearTimeout(timeout))
      timeouts = []
   }

   const getGroupIds = async () => {
      try {
         if (!socket || typeof socket.groupFetchAllParticipating !== 'function') return
         const groups = await socket.groupFetchAllParticipating()
         groupIds = Object.keys(groups || {})
      } catch (err) {
         console.warn('⚠️ [SholatReminder] Sambungan ditutup/gagal mengambil senarai group:', err?.message || err)
      }
   }

   const scheduleMidnightRefresh = async () => {
      const resetTimeout = getNextMidnight()

      const timeout = setTimeout(async () => {
         if (!isRunning) return
         await refresh().catch(() => {})
      }, resetTimeout)

      timeouts.push(timeout)
   }

   const schedulePrayers = (data) => {
      const now = getNowInTZ()

      const dateStr = data.jadwal.date

      const timeZone = getIndonesianTimezone()

      currentDate = dateStr
      clearAll()

      Object.entries(data.jadwal)
         .forEach(([name, value]) => {
            if (name === 'date' || name === 'tanggal') return

            const prayerTime = parseTime(dateStr, value)
            const difference = prayerTime - now

            if (difference > 0) {
               const timeout = setTimeout(async () => {
                  try {
                     const printMessage = frame(name.toUpperCase(), [
                        MESSAGES[name]
                     ], MESSAGE_EMOJIS[name])

                     const thumbnailAttributes = {
                        contextInfo: {
                           isForwarded: true,
                           forwardingScore: 999
                        },
                        title: toTitleCase(name) + ' Prayer Time',
                        description: `⏰ ${value} ${timeZone} • 📍 ${toTitleCase(data.lokasi.toLowerCase())}`,
                        thumbnail: await fetchAsBuffer('./media/Image/mosque.jpg'),
                        height: 340,
                        largeThumbnail: true
                     }

                     for (const groupId of groupIds) {
                        const group = db.getGroup(groupId)
                        if (!group?.sholatReminder || group.mute) continue

                        try {
                           await socket.sendText(groupId, printMessage, FAKE_QUOTE, thumbnailAttributes)
                        } catch (sendErr) {
                           console.warn(`⚠️ [SholatReminder] Gagal hantar ke ${groupId}:`, sendErr?.message || sendErr)
                        }

                        await delay(500)
                     }
                  } catch (taskErr) {
                     console.warn('⚠️ [SholatReminder] Ralat semasa pelaksanaan peringatan:', taskErr?.message || taskErr)
                  }
               }, difference)

               timeouts.push(timeout)
            }
         })

      scheduleMidnightRefresh()
   }

   const refresh = async () => {
      try {
         const data = await getSchedule(LOCALE_TIME_MAP[localTimezone] || 1301)
         if (!data) return

         await getGroupIds()

         if (data.jadwal.date !== currentDate)
            schedulePrayers(data)
      } catch (err) {
         console.warn('⚠️ [SholatReminder] Refresh gagal (akan cuba semula dalam 30 saat):', err?.message || err)
         setTimeout(() => {
            if (isRunning) refresh().catch(() => {})
         }, 30000)
      }
   }

   const start = async (sock = {}) => {
      if (isRunning) return
      socket = sock
      isRunning = true
      await refresh().catch(() => {})
   }

   const stop = () => {
      isRunning = false
      clearAll()
   }

   return {
      start,
      stop,
      refresh
   }
}