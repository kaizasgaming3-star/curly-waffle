import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const pluginConfig = {
  name: "server",
  alias: ["srv", "serverinfo", "vpsinfo"],
  category: "main",
  description: "Menampilkan informasi server (OS, CPU, RAM, Disk, Uptime)",
  usage: ".server",
  example: ".server",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function formatSize(bytes) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (!bytes || bytes === 0) return "0 Byte";
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
  return Math.round(bytes / Math.pow(1024, i), 2) + " " + sizes[i];
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(d + " hari");
  if (h > 0) parts.push(h + " jam");
  if (m > 0) parts.push(m + " menit");
  if (s > 0 || parts.length === 0) parts.push(s + " detik");
  return parts.join(", ");
}

async function getDiskUsage() {
  try {
    if (process.platform === "win32") {
      const { stdout } = await execAsync("wmic logicaldisk get size,freespace,caption");
      const lines = stdout.trim().split("\n").slice(1);
      return lines
        .map((line) => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 3) {
            const caption = parts[0];
            const free = parseInt(parts[1], 10);
            const size = parseInt(parts[2], 10);
            const used = size - free;
            return "Drive " + caption + ": " + formatSize(used) + " / " + formatSize(size);
          }
          return null;
        })
        .filter(Boolean)
        .join("\n");
    }
    const { stdout } = await execAsync("df -h /");
    const lines = stdout.trim().split("\n");
    const parts = lines[1].replace(/\s+/g, " ").split(" ");
    return "Disk: " + parts[2] + " / " + parts[1] + " (Free " + parts[3] + ")";
  } catch (e) {
    return "Gagal mengambil info disk";
  }
}

async function handler(m, { sock }) {
  try {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = process.memoryUsage();
    const diskInfo = await getDiskUsage();

    const text =
      "*INFO SERVER*\n\n" +
      "OS: " + os.type() + " (" + os.platform() + ")\n" +
      "Arch: " + os.arch() + "\n" +
      "Release: " + os.release() + "\n" +
      "Hostname: " + os.hostname() + "\n" +
      "Uptime: " + formatUptime(os.uptime()) + "\n\n" +
      "CPU: " + (cpus[0]?.model || "-") + "\n" +
      "Speed: " + (cpus[0]?.speed || "-") + " MHz\n" +
      "Cores: " + cpus.length + "\n\n" +
      "RAM Used: " + formatSize(usedMem) + " / " + formatSize(totalMem) + "\n" +
      "RAM Free: " + formatSize(freeMem) + "\n" +
      "Bot RSS: " + formatSize(memUsage.rss) + "\n" +
      "Heap: " + formatSize(memUsage.heapUsed) + " / " + formatSize(memUsage.heapTotal) + "\n\n" +
      "Disk:\n" + diskInfo + "\n\n" +
      "Node.js: " + process.version + "\n" +
      "V8: " + process.versions.v8 + "\n" +
      "Runtime: " + formatUptime(process.uptime());

    await m.reply(text);
  } catch (e) {
    console.error("Server Plugin Error:", e);
    return m.reply("Terjadi kesalahan mengambil data server.");
  }
}

export { pluginConfig as config, handler };
export default { config: pluginConfig, handler };
