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

async function download(url, file) {
  const response = await fetch(url, {
    headers: {
      referer: "https://www.bilibili.com/",
      "user-agent": "Mozilla/5.0",
    },
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
  if (video.platform !== "Bilibili" || !video.bvid || !video.cover) continue;
  const localPath = `./covers/${video.bvid}.jpg`;
  const file = path.join(COVER_DIR, `${video.bvid}.jpg`);
  if (video.cover === localPath && fs.existsSync(file)) {
    skipped++;
    continue;
  }
  try {
    await download(video.cover, file);
    video.cover = localPath;
    localized++;
    await new Promise((resolve) => setTimeout(resolve, 150));
  } catch (error) {
    failed++;
    console.warn(`Cover download failed: ${video.bvid} ${error.message}`);
  }
}

writeDashboardData(videos);

console.log(JSON.stringify({ localized, skipped, failed }, null, 2));
