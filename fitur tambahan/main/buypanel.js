import { prepareWAMessageMedia } from "ourin";
import fs from "fs";
import config from "../../config.js";

const pluginConfig = {
  name: "buypanel",
  alias: ["buy", "panel", "sewapanel"],
  category: "main",
  description: "Mengarahkan user untuk melakukan pembelian panel bot",
  usage: ".buypanel",
  example: ".buypanel, .panel",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  await m.react("🚀");

  const botName = config.bot?.name || "Senz Okkotsu";
  const userTag = `@${m.sender.split("@")[0]}`;
  const targetWhatsApp = "https://wa.me/628138768292?text=Halo%20kak,%20saya%20mau%20beli%20panel,%20boleh%20minta%20list%20nya?";

  let media = null;
  try {
    const assetBuffer = fs.readFileSync(config.assets["ourin"]);
    media = await prepareWAMessageMedia({ image: assetBuffer }, { upload: sock.waUploadToServer });
  } catch (_) {}

  const textBody = `Halo, ${userTag} !
Mau beli panel berkualitas dengan harga terjangkau dan Server yang kencang 🤔

Silahkan klik tombol di bawah ini untuk terhubung langsung ke Nomor Admin dan melakukan pemesanan 😉`;

  const content = {
    viewOnceMessage: {
      message: {
        messageContextInfo: {},
        interactiveMessage: {
          header: {
            hasMediaAttachment: media ? true : false,
            imageMessage: media ? media.imageMessage : undefined,
            title: "",
            subtitle: "",
          },
          body: { text: textBody.trim() },
          footer: { text: `© ${botName} — Panel Premium` },
          contextInfo: {
            mentionedJid: [m.sender],
            isForwarded: true,
            forwardingScore: 9,
          },
          nativeFlowMessage: {
            buttons: [
              {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                  display_text: "🚀 Order Panel Legal",
                  url: targetWhatsApp,
                  merchant_url: targetWhatsApp,
                }),
              },
            ],
          },
        },
      },
    },
  };

  await sock.relayMessage(m.chat, content, { quoted: m });
  await m.react("✅");
}

export { pluginConfig as config, handler };