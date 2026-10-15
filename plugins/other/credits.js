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

import { DONATE_URL } from '@sairidev/baileys-new'

import { fetchThumbnail, frame, greeting } from '../../lib/Utilities.js'

export default {
   command: ['credits', 'script', 'thanksto'],
   hidden: 'sc',
   category: 'other',
   async run(m) {
      const printCredits = frame('CREDITS', [
         'sairidev — Project Maintainer & Creator'
      ])
      const printInfoUrl = frame('INFO', [
         DONATE_URL
      ])
      const printAPIs = frame('THIRD-PARTY SERVICES', [
         'rynn-k — Nekolabs API',
         'elrayyxml — Nexray API',
         'faa — Faa API',
         'Deline Clarissa — Deline API',
         'ZenzzXD — Zennz API'
      ])
      const printSourceCode = frame('INFO', [
         'https://github.com/sairidev'
      ])
      m.reply(printCredits + '\n\n' +
         printInfoUrl + '\n\n' +
         printAPIs + '\n\n' +
         printSourceCode, {
         title: botName,
         description: greeting(),
         thumbnail: await fetchThumbnail(),
         largeThumbnail: true
      })
   }
}
