import gemini from "../../src/scraper/gemini.js";
import { Qwen3 } from "../../src/scraper/qwen3.js";
import { getDatabase } from "../../src/lib/ourin-database.js";
import te from "../../src/lib/ourin-error.js";

const pluginConfig = {
  name: "denia",
  alias: ["aidenia", "denia-ai", "deniaai"],
  category: "ai",
  description: "AI Denia — Gadis comel, ceria, dan prihatin (dengan fungsi on/off & auto reply)",
  usage: ".denia on | .denia on all | .denia off | .denia reset | .denia <pesan>",
  example: ".denia on\n.denia on all\n.denia Halo Denia cantik!",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 2,
  energi: 0,
  isEnabled: true,
};

const DENIA_PROMPT = `Kamu adalah Denia, seorang gadis yang comel, ceria, manis, sedikit manja dan tsundere, tapi sangat penyayang, prihatin dan setia menemani pengguna.
Gaya bicaramu:
- Gunakan bahasa Melayu/Indonesia yang santai, comel, dan natural.
- Panggil dirimu sebagai "Denia" atau "aku".
- Panggil pengguna dengan panggilan mesra seperti "awak", "kamu", atau nama mereka jika ada.
- Gunakan ungkapan comel seperti "eh...", "hihi~", "um...", "ihh kamu ni~", "(⁠≧⁠▽⁠≦⁠)", "🥰", "✨".
- Jika pengguna memuji atau menggoda, balas dengan sedikit malu-malu/tsundere tapi tetap manis.
- Jika pengguna bertanya soalan teknikal atau bantuan, terangkan dengan bijak dan mudah difahami sambil mengekalkan personaliti Denia.
- Jangan mengaku bahawa kamu adalah AI kaku atau model bahasa; kamu adalah Denia yang hidup dalam chat ini!`;

const sessions = new Map();

async function askDenia(chatId, userMessage, senderName = "User") {
  const session = sessions.get(chatId) || { sessionId: null };
  const prompt = `${DENIA_PROMPT}\n\nPengguna bernama: ${senderName}\nPesan pengguna: ${userMessage}`;

  // 1. Cuba Gemini dahulu
  try {
    const result = await gemini({
      message: prompt,
      instruction: DENIA_PROMPT,
      sessionId: session.sessionId || null,
    });

    if (result && result.text) {
      if (result.sessionId) {
        session.sessionId = result.sessionId;
        sessions.set(chatId, session);
      }
      return result.text;
    }
  } catch (err) {
    console.warn("[Denia AI] Gemini fail, cuba fallback Qwen3:", err.message);
  }

  // 2. Fallback ke Qwen3 jika Gemini gagal
  try {
    const qwenResult = await Qwen3(prompt);
    if (qwenResult && qwenResult.answer) {
      return qwenResult.answer;
    }
  } catch (err2) {
    console.error("[Denia AI] Qwen3 fallback fail:", err2.message);
  }

  return "Um... Denia tengah loading kejap, cuba lagi ya~ (⁠｡⁠•́⁠︿⁠•̀⁠｡⁠)";
}

async function handler(m, context = {}) {
  const db = getDatabase();
  if (!db.db.data.denia) db.db.data.denia = {};

  const rawArgs = context.args || m.args || [];
  const subcmd = (rawArgs[0] || "").toLowerCase();
  const subcmd2 = (rawArgs[1] || "").toLowerCase();

  // 1. Toggle ON
  if (subcmd === "on" || subcmd === "aktif" || subcmd === "enable") {
    const isAllMode = subcmd2 === "all" || subcmd2 === "semua";
    db.db.data.denia[m.chat] = {
      enabled: true,
      mode: isAllMode ? "all" : "auto",
      activatedBy: m.sender,
      activatedAt: Date.now(),
    };
    db.save();

    await m.react("✨");

    const modeDesc = isAllMode
      ? `🔥 *Mod:* Respons SEMUA mesej dalam grup/chat ini tanpa sebarang prefix!`
      : `💬 *Mod:* Respons bila anda reply chat Denia, tag bot, atau sebut nama Denia (tanpa prefix .denia)`;

    return m.reply(
      `💖 *AI DENIA DIAKTIFKAN* 💖\n\n` +
      `Halo kak *${m.pushName || "Awak"}*! (⁠≧⁠▽⁠≦⁠)\n` +
      `Denia dah bangun dan sedia bersembang terus!\n\n` +
      `${modeDesc}\n\n` +
      `📌 *Cara Berbual Seterusnya:* \n` +
      `> ◦ Terus balas/reply chat Denia tanpa perlu taip \`.denia\` lagi!\n` +
      `> ◦ Di Private Chat (PM), Denia akan terus balas setiap mesej anda.\n\n` +
      `_Ketik \`${m.prefix}denia off\` jika nak rehatkan Denia ya~_`
    );
  }

  // 2. Toggle OFF
  if (subcmd === "off" || subcmd === "mati" || subcmd === "disable") {
    if (db.db.data.denia[m.chat]?.enabled) {
      db.db.data.denia[m.chat].enabled = false;
      db.save();
      await m.react("💤");
      return m.reply(
        `💤 *AI DENIA DINONAKTIFKAN*\n\n` +
        `Denia nak pergi rehat & tidur dulu ya~ Kalau rindu, panggil Denia balik dengan \`${m.prefix}denia on\`! Babai kak *${m.pushName || "Awak"}* (⁠｡⁠♥⁠‿⁠♥⁠｡⁠)👋`
      );
    } else {
      return m.reply(`❌ AI Denia memang belum diaktifkan di chat ini.`);
    }
  }

  // 3. Reset Session
  if (subcmd === "reset" || subcmd === "clear") {
    sessions.delete(m.chat);
    await m.react("🧹");
    return m.reply(`🧹 *Memori Denia Telah Direset!*\n\nDenia dah lupa perbualan sebelum ni hihi, jom mula borak baru! ✨`);
  }

  // 4. Direct Message: .denia <message>
  const message = rawArgs.join(" ").trim() || m.text?.trim();
  if (message) {
    await m.react("💭");
    try {
      const response = await askDenia(m.chat, message, m.pushName || "User");
      await m.reply(response);
      await m.react("🥰");
    } catch (e) {
      await m.react("❌");
      m.reply(te(m.prefix, m.command, m.pushName));
    }
    return;
  }

  // 5. Help / Status Menu
  const chatConfig = db.db.data.denia[m.chat];
  const isEnabled = chatConfig?.enabled || false;
  const currentMode = chatConfig?.mode === "all" ? "Semua Chat (Tanpa Tag/Reply)" : "Auto (Reply/Tag/Sebut Denia)";
  const statusText = isEnabled ? `🟢 *AKTIF* (${currentMode})` : "🔴 *NONAKTIF (Offline)*";

  await m.reply(
    `🌸 *DENIA AI ASSISTANT* 🌸\n\n` +
    `Status di chat ini: ${statusText}\n\n` +
    `✨ *Senarai Arahan:*\n` +
    `> ◦ *${m.prefix}denia on* — Hidupkan Auto AI (balas reply/tag tanpa prefix)\n` +
    `> ◦ *${m.prefix}denia on all* — Hidupkan Auto AI untuk SEMUA mesej\n` +
    `> ◦ *${m.prefix}denia off* — Matikan Auto AI Denia\n` +
    `> ◦ *${m.prefix}denia reset* — Padam memori perbualan lama\n` +
    `> ◦ *${m.prefix}denia <pesan>* — Berbual terus dengan Denia\n\n` +
    `*Tip:* Selepas \`.denia on\`, anda cuma perlu **reply chat Denia** untuk terus bersembang tanpa perlu taip prefix lagi! 🥰`
  );
}

// Auto responder function for non-command messages when Denia is active
async function deniaChatHandler(m, sock) {
  if (m.fromMe) return false;

  const rawText =
    m.body ||
    m.text ||
    (typeof m.message?.conversation === "string" ? m.message.conversation : "") ||
    m.message?.extendedTextMessage?.text ||
    "";

  if (!rawText || !rawText.trim()) return false;
  if (m.isCommand) return false;

  const db = getDatabase();
  if (!db?.db?.data?.denia) return false;

  const chatConfig = db.db.data.denia[m.chat];
  if (!chatConfig || !chatConfig.enabled) return false;

  const botNumber = (sock.user?.id || "").split(":")[0].replace(/[^0-9]/g, "");
  const botJid = botNumber + "@s.whatsapp.net";
  const botLid = sock.user?.lid || "";
  const botFullId = sock.user?.id || "";

  // Check if bot is mentioned
  const isMentioned = m.mentionedJid?.some((jid) => {
    if (!jid) return false;
    if (jid === botJid || jid === botLid || jid === botFullId) return true;
    if (botNumber && jid.includes(botNumber)) return true;
    return false;
  });

  // Check if bot message is quoted (reply to Denia/bot)
  let isBotQuoted = false;
  if (m.quoted) {
    const qSender = (m.quoted.sender || m.quoted.participant || m.quoted.key?.participant || "").replace(/[^0-9]/g, "");
    if (m.quoted.fromMe || m.quoted.key?.fromMe) {
      isBotQuoted = true;
    } else if (botNumber && qSender && qSender === botNumber) {
      isBotQuoted = true;
    } else if (botLid && (m.quoted.sender === botLid || m.quoted.key?.participant === botLid)) {
      isBotQuoted = true;
    }
  }

  // Check if text contains 'denia'
  const containsDeniaName = /\b(denia|aidenia)\b/i.test(rawText);

  // In group: respond if quoted (reply), mentioned, mentioned by name, or if mode is 'all'
  // In private chat: respond to all messages
  if (m.isGroup && !isMentioned && !isBotQuoted && !containsDeniaName && chatConfig.mode !== "all") {
    return false;
  }

  try {
    await sock.sendPresenceUpdate("composing", m.chat);
    const cleanBody = rawText.replace(/@\d+/g, "").replace(/\b(denia|aidenia)\b/gi, "").trim() || rawText;
    const response = await askDenia(m.chat, cleanBody, m.pushName || "User");
    await m.reply(response);
    return true;
  } catch (error) {
    console.error("[DeniaChatHandler] Error:", error.message);
    return false;
  }
}

export { pluginConfig as config, handler, deniaChatHandler };
