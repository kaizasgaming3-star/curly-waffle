import os from 'os';
import { performance } from 'perf_hooks';
import config from '../../config.js';
import { getAssetBuffer } from '../../src/lib/ourin-asset-manager.js';
import te from '../../src/lib/ourin-error.js';

const pluginConfig = {
  name: 'bot',
  alias: ['aktif', 'alive', 'statusbot', 'botstatus', 'tesbot', 'tes'],
  category: 'main',
  description: 'Cek status sama ada bot masih aktif dan sedia digunakan',
  usage: '.bot',
  example: '.bot',
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

function formatUptime(seconds) {
  seconds = Number(seconds);
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d} hari`);
  if (h > 0) parts.push(`${h} jam`);
  if (m > 0) parts.push(`${m} minit`);
  if (s > 0 || parts.length === 0) parts.push(`${s} saat`);

  return parts.join(' ');
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 MB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

async function handler(m, { sock }) {
  const start = performance.now();
  await m.react('🤖');

  try {
    const end = performance.now();
    const latency = Math.round(end - start);

    const botName = config.bot?.name || 'Ourin-MD';
    const ownerName = config.owner?.name || 'Owner';
    const version = config.bot?.version || '3.3';
    const mode = config.mode ? config.mode.toUpperCase() : 'PUBLIC';
    const prefix = m.prefix || config.command?.prefix || '.';
    const botUptime = formatUptime(process.uptime());

    const memUsage = process.memoryUsage();
    const usedRam = formatSize(memUsage.rss);

    const timeNow = new Date().toLocaleTimeString('ms-MY', {
      timeZone: 'Asia/Kuala_Lumpur',
      hour12: false,
    });

    const caption = 
`🤖 *STATUS BOT: AKTIF / ONLINE*

Halo kak *${m.pushName || 'User'}*! 👋
Bot masih aktif, stabil dan sedia menerima arahan.

╭┈┈⬡「 📋 *STATUS INFORMASI* 」
┃ 🟢 *Status:* Aktif (Online)
┃ 🤖 *Nama Bot:* ${botName}
┃ 👑 *Owner:* ${ownerName}
┃ 🏷️ *Versi:* v${version}
┃ ⚡ *Kelajuan Respon:* ${latency} ms
┃ ⏱️ *Waktu Aktif (Uptime):* ${botUptime}
┃ ⚙️ *Mod:* ${mode}
┃ 🧩 *Prefix Semasa:* \`\`\`${prefix}\`\`\`
┃ 💾 *Penggunaan RAM:* ${usedRam}
┃ 🕒 *Waktu Sistem:* ${timeNow}
╰┈┈⬡

> _Ketik *${prefix}menu* untuk melihat senarai semua arahan bot._`;

    const img = getAssetBuffer('ourin');

    if (img) {
      await sock.sendMessage(
        m.chat,
        {
          image: img,
          caption: caption,
        },
        { quoted: m }
      );
    } else {
      await m.reply(caption);
    }

    await m.react('✅');
  } catch (error) {
    console.error('[BotPlugin] Error:', error);
    await m.react('❌');
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };

