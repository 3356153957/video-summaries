import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const DATA_JS = "dashboard/data.js";
const DASHBOARD_JSON = "video-summary-dashboard-data.json";
const COVER_DIR = "dashboard/covers";

function readDashboardData() {
  const src = fs.readFileSync(DATA_JS, "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.VIDEO_DASHBOARD_DATA || [];
}

function writeDashboardData(videos) {
  const json = JSON.stringify(videos, null, 2);
  fs.writeFileSync(DATA_JS, `window.VIDEO_DASHBOARD_DATA = ${json};\n`, "utf8");
  fs.writeFileSync(DASHBOARD_JSON, `${json}\n`, "utf8");
}

function safeName(video) {
  if (video.platform === "Douyin") {
    const id = video.url?.match(/douyin\.com\/video\/(\d+)/)?.[1] || video.bvid;
    return `douyin-${id}.jpg`;
  }
  if (video.platform === "YouTube") {
    const id = video.url?.match(/[?&]v=([^&]+)/)?.[1] || video.url?.match(/youtu\.be\/([^?&/]+)/)?.[1] || video.bvid;
    return `youtube-${id}.jpg`;
  }
  return `${String(video.bvid || video.title).replace(/[^a-z0-9_-]+/gi, "_")}.jpg`;
}

async function download(url, file) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(file, bytes);
}

fs.mkdirSync(COVER_DIR, { recursive: true });

const videos = readDashboardData();
let localized = 0;
let skipped = 0;
let failed = 0;

for (const video of videos) {
  if (!video.cover || video.cover.startsWith("./covers/")) continue;
  if (!["Douyin", "YouTube"].includes(video.platform)) continue;

  const name = safeName(video);
  const file = path.join(COVER_DIR, name);
  const localPath = `./covers/${name}`;
  try {
    if (!fs.existsSync(file)) {
      await download(video.cover, file);
      await new Promise((resolve) => setTimeout(resolve, 100));
    } else {
      skipped++;
    }
    video.cover = localPath;
    localized++;
  } catch (error) {
    failed++;
    console.warn(`Cover download failed: ${video.platform} ${video.url} ${error.message}`);
  }
}

writeDashboardData(videos);

console.log(JSON.stringify({ localized, skipped, failed }, null, 2));
