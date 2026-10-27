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

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'

const SETUP_PATH = fileURLToPath(
   new URL('./socket.js', import.meta.url)
)

const [MAJOR, MINOR, PATCH] = process.versions.node
   .split('.')
   .map(value => +value.replace(/\D.*$/, ''))

// ─── ANSI color helpers ──────────────────────────────────────────────────────
const clr = {
   reset:   '\x1b[0m',
   bold:    '\x1b[1m',
   dim:     '\x1b[2m',
   cyan:    '\x1b[36m',
   blue:    '\x1b[34m',
   magenta: '\x1b[35m',
   yellow:  '\x1b[33m',
   green:   '\x1b[32m',
   red:     '\x1b[31m',
   white:   '\x1b[97m',
   gray:    '\x1b[90m',
}

const Banner = () => {
   console.log('\x1Bc')

   const w = process.stdout?.columns || 80

   const center = (str, rawLen) => {
      const len = rawLen ?? str.replace(/\x1b\[[0-9;]*m/g, '').length
      const pad = Math.max(0, Math.floor((w - len) / 2))
      return ' '.repeat(pad) + str
   }

   // ASCII art wordmark – raw width = 38
   const W = 38
   const art = [
      `${clr.cyan}${clr.bold}██████╗ ███████╗███╗  ██╗██╗ █████╗${clr.reset}`,
      `${clr.cyan}${clr.bold}██╔══██╗██╔════╝████╗ ██║██║██╔══██╗${clr.reset}`,
      `${clr.cyan}${clr.bold}██║  ██║█████╗  ██╔██╗██║██║███████║${clr.reset}`,
      `${clr.blue}${clr.bold}██║  ██║██╔══╝  ██║╚████║██║██╔══██║${clr.reset}`,
      `${clr.blue}${clr.bold}██████╔╝███████╗██║ ╚███║██║██║  ██║${clr.reset}`,
      `${clr.blue}${clr.bold}╚═════╝ ╚══════╝╚═╝  ╚══╝╚═╝╚═╝  ╚═╝${clr.reset}`,
   ]

   console.log()
   art.forEach(line => console.log(center(line, W + 1)))
   console.log()

   const tag = `${clr.gray}◆  WhatsApp Bot  ·  by SairiDev  ◆${clr.reset}`
   console.log(center(tag, 35))

   const div = `${clr.gray}${'─'.repeat(Math.min(w - 4, 50))}${clr.reset}`
   console.log()
   console.log(center(div, Math.min(w - 4, 50)))
   console.log()
}

const Start = () => {
   const instance = spawn(process.execPath, [
      ...process.execArgv,
      SETUP_PATH,
      ...process.argv.slice(2)
   ], {
      stdio: ['inherit', 'inherit', 'inherit', 'ipc']
   })

   instance.once('message', (data) => {
      if (data === 'leak' || data === 'reset') {
         console[data === 'leak' ? 'error' : 'log'](
            data === 'leak'
               ? `${clr.yellow}[WARN]${clr.reset} RAM limit reached, restarting...`
               : `${clr.cyan}[INFO]${clr.reset} Restarting...`
         )
         instance.kill('SIGTERM')
      }
   })

   instance.once('error', (error) => {
      console.error(`${clr.red}[ERR] ${clr.reset}Unexpected error occurred when starting the bot:`, error)
   })

   instance.once('exit', (code) => {
      console.error(`${clr.yellow}[WARN]${clr.reset} Exited with code ${code}`)

      cleanUp(instance)

      setTimeout(Start, 2000)
   })
}

const cleanUp = (instance) => {
   if (!instance) return

   if (!instance.killed)
      try {
         instance.kill('SIGTERM')
      }
      catch { }

   if (instance.connected)
      try {
         instance.disconnect()
      }
      catch { }

   try {
      instance.stdout?.destroy()
      instance.stderr?.destroy()
      instance.stdin?.destroy()
   }
   catch { }

   instance.removeAllListeners()
}

Banner()

if (
   MAJOR < 20 ||
   (MAJOR == 20 && MINOR < 18) ||
   (MAJOR == 20 && MINOR == 18 && PATCH < 1)
) {
   console.error(
      `\n${clr.red}[ERR] ${clr.reset}This script requires Node.js 20.18.1 or above.\n` +
      `      You are using Node.js ${process.versions.node}.\n` +
      `      Please upgrade to proceed.\n`
   )
   process.exit(1)
}

Start()