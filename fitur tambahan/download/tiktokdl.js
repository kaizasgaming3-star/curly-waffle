import fs from "fs";
import path from "path";
import { optimizeVideoForWhatsApp, probeVideo, ensureTikTokUrl } from "../../lib/Components/TikTokOptimizer.js";

async function tiktokDl(url) {
  function formatNumber(integer) {
    let numb = parseInt(integer);
    return Number(numb).toLocaleString().replace(/,/g, ".");
  }

  function formatDate(n, locale = "en") {
    let d = new Date(n);
    return d.toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
  }

  let data = [];
  const domain = "https://www.tikwm.com/api/";
  const resp = await fetch(domain, {
    method: "POST",
    headers: {
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Origin": "https://www.tikwm.com",
      "Referer": "https://www.tikwm.com/",
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: new URLSearchParams({ url, count: "12", cursor: "0", web: "1", hd: "1" }),
  });
  const json = await resp.json();
  const res = json?.data;
  if (!res) throw new Error(json?.msg || "Gagal mendapatkan data TikTok");

  if (res?.duration == 0) {
    res.images.forEach((v) => data.push({ type: "photo", url: v }));
  } else {
    data.push(
      {
        type: "watermark",
        url: ensureTikTokUrl(res?.wmplay),
      },
      {
        type: "nowatermark",
        url: ensureTikTokUrl(res?.play),
      },
      {
        type: "nowatermark_hd",
        url: ensureTikTokUrl(res?.hdplay || res?.play),
      },
    );
  }

  return {
    status: true,
    title: res.title,
    taken_at: formatDate(res.create_time).replace("1970", ""),
    region: res.region,
    id: res.id,
    durations: res.duration,
    duration: res.duration + " Seconds",
    cover: "https://www.tikwm.com" + res.cover,
    size_wm: res.wm_size,
    size_nowm: res.size,
    size_nowm_hd: res.hd_size,
    data,
    music_info: {
      id: res.music_info.id,
      title: res.music_info.title,
      author: res.music_info.author,
      album: res.music_info.album || null,
      url: "https://www.tikwm.com" + res.music || res.music_info.play,
    },
    stats: {
      views: formatNumber(res.play_count),
      likes: formatNumber(res.digg_count),
      comment: formatNumber(res.comment_count),
      share: formatNumber(res.share_count),
      download: formatNumber(res.download_count),
    },
    author: {
      id: res.author.id,
      fullname: res.author.unique_id,
      nickname: res.author.nickname,
      avatar: "https://www.tikwm.com" + res.author.avatar,
    },
  };
}

const pluginConfig = {
  name: ["tiktok", "tt", "ttmp4"],
  alias: ["tiktokdl", "ttdown"],
  category: "download",
  description: "Download video/slide TikTok tanpa watermark (Kualiti Ultra HD / 4K)",
  usage: ".tiktok <url>",
  example: ".tiktok https://vt.tiktok.com/xxx",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const text = m.text?.trim();
  const prefix = m.prefix;
  const command = m?.command;
  if (!text) {
    m.react("❌");
    return m.reply(
      `📌 Contoh: *${prefix + command} https://vt.tiktok.com/...*`,
    );
  }
  m.react("🕕");
  try {
    const result = await tiktokDl(text);

    const musicButton = {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🎵 Ambil Music",
        id: `${prefix}ttmp3 ${text}`,
      }),
    };

    if (result.durations > 0 && result.duration !== "0 Seconds") {
      const videoItem = result.data.find(
        (e) => e.type === "nowatermark_hd" || e.type === "nowatermark",
      ) || result.data[0];

      const caption =
        `🎵 *𝗧 𝗜 𝗞 𝗧 𝗢 𝗞  -  𝗗 𝗢 𝗪 𝗡 𝗟 𝗢 𝗔 𝗗 𝗘 𝗥  (𝗛 𝗗)*\n\n` +
        `- Author: *${result.author.nickname}* (${result.author.fullname})\n` +
        `- Caption: ${result.title || "-"}\n` +
        `- Music: ${result.music_info.title} - ${result.music_info.author}\n` +
        `- Duration: ${result.duration}\n` +
        `- Uploaded: ${result.taken_at}\n` +
        `- Region: ${result.region}\n\n` +
        `*Statistik Video:*\n` +
        `- Views: *${result.stats.views}*\n` +
        `- Likes: *${result.stats.likes}*\n` +
        `- Comments: *${result.stats.comment}*\n` +
        `- Shares: *${result.stats.share}*\n` +
        `- Downloads: *${result.stats.download}*`;

      const processed = await optimizeVideoForWhatsApp(videoItem.url);

      if (processed && processed.buffer) {
        await sock.sendMessage(
          m.chat,
          {
            video: processed.buffer,
            mimetype: "video/mp4",
            caption: caption,
          },
          { quoted: m }
        );
      } else {
        await sock.sendMessage(
          m.chat,
          {
            video: { url: videoItem.url },
            mimetype: "video/mp4",
            caption: caption,
          },
          { quoted: m }
        );
      }
    } else {
      const caption =
        `📸 *𝗧 𝗜 𝗞 𝗧 𝗢 𝗞  -  𝗗 𝗢 𝗪 𝗡 𝗟 𝗢 𝗔 𝗗 𝗘 𝗥*\n\n` +
        `- Author: *${result.author.nickname}* (${result.author.fullname})\n` +
        `- Caption: ${result.title || "-"}\n` +
        `- Music: ${result.music_info.title} - ${result.music_info.author}\n` +
        `- Uploaded: ${result.taken_at}\n` +
        `- Region: ${result.region}\n\n` +
        `*Statistik Konten:*\n` +
        `- Views: *${result.stats.views}*\n` +
        `- Likes: *${result.stats.likes}*\n` +
        `- Comments: *${result.stats.comment}*\n` +
        `- Shares: *${result.stats.share}*\n` +
        `- Downloads: *${result.stats.download}*`;

      const slides = result.data?.map((zan, idx) => ({
        image: { url: zan.url },
        caption: idx === 0 ? caption : "",
      })) || [];
      await sock.sendMessage(
        m.chat,
        {
          albumMessage: slides,
        },
        { quoted: m },
      );

      await sock.sendButton(m.chat, null, `📸 Slide berhasil dikirim!\nTekan tombol di bawah untuk ambil music.`, m, {
        buttons: [musicButton],
      });
    }
    m.react("✅");
  } catch (e) {
    console.error(e);
    m.react("❌");
    m.reply("Coba lagi nanti, atau bisa coba " + m.prefix + "tt2");
  }
}

async function autoTikTokHandler(m, sock) {
  if (m.fromMe || m.isCommand) return false;

  const rawText =
    m.body ||
    m.text ||
    (typeof m.message?.conversation === "string" ? m.message.conversation : "") ||
    m.message?.extendedTextMessage?.text ||
    "";

  if (!rawText) return false;

  const match = rawText.match(/https?:\/\/(?:www\.|v[mt]\.|vt\.|vm\.|t\.)?tiktok\.com\/[^\s]+/i);
  if (!match) return false;

  const tiktokUrl = match[0];

  await m.react("🕕");
  try {
    const result = await tiktokDl(tiktokUrl);

    if (result.durations > 0 && result.duration !== "0 Seconds") {
      const videoItem = result.data.find(
        (e) => e.type === "nowatermark_hd" || e.type === "nowatermark",
      ) || result.data[0];

      const caption =
        `🎵 *𝗧 𝗜 𝗞 𝗧 𝗢 𝗞  -  𝗔 𝗨 𝗧 𝗢  𝗗 𝗢 𝗪 𝗡 𝗟 𝗢 𝗔 𝗗  (𝗛 𝗗)*\n\n` +
        `- Author: *${result.author.nickname}* (${result.author.fullname})\n` +
        `- Caption: ${result.title || "-"}\n` +
        `- Duration: ${result.duration}\n` +
        `- Music: ${result.music_info?.title || "-"} - ${result.music_info?.author || "-"}`;

      const processed = await optimizeVideoForWhatsApp(videoItem.url);

      if (processed && processed.buffer) {
        await sock.sendMessage(
          m.chat,
          {
            video: processed.buffer,
            mimetype: "video/mp4",
            caption: caption,
          },
          { quoted: m }
        );
      } else {
        await sock.sendMessage(
          m.chat,
          {
            video: { url: videoItem.url },
            mimetype: "video/mp4",
            caption: caption,
          },
          { quoted: m }
        );
      }
      await m.react("✅");
      return true;
    } else {
      const caption =
        `📸 *𝗧 𝗜 𝗞 𝗧 𝗢 𝗞  -  𝗔 𝗨 𝗧 𝗢  𝗗 𝗢 𝗪 𝗡 𝗟 𝗢 𝗔 𝗗*\n\n` +
        `- Author: *${result.author.nickname}* (${result.author.fullname})\n` +
        `- Caption: ${result.title || "-"}`;

      const slides = result.data?.map((zan, idx) => ({
        image: { url: zan.url },
        caption: idx === 0 ? caption : "",
      })) || [];

      if (slides.length > 0) {
        await sock.sendMessage(
          m.chat,
          { albumMessage: slides },
          { quoted: m }
        );
        await m.react("✅");
        return true;
      }
    }
  } catch (err) {
    console.error("[AutoTikTok Error]:", err.message);
    await m.react("❌");
  }
  return false;
}

export { pluginConfig as config, handler, autoTikTokHandler };
