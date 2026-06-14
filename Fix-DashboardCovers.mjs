import fs from "node:fs";
import vm from "node:vm";

const DATA_JS = "dashboard/data.js";
const DASHBOARD_JSON = "video-summary-dashboard-data.json";
const DOUYIN_BODIES = "douyin-collection-api-bodies.json";

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

function normalizeBiliPic(url) {
  if (!url) return "";
  return url.startsWith("//") ? `https:${url}` : url;
}

function youtubeIdFromUrl(url = "") {
  const match = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?&/]+)/) || url.match(/shorts\/([^?&/]+)/);
  return match ? match[1] : "";
}

function douyinIdFromUrl(url = "") {
  const match = url.match(/douyin\.com\/video\/(\d+)/);
  return match ? match[1] : "";
}

function collectDouyinCoverCandidates(value, map) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectDouyinCoverCandidates(item, map));
    return;
  }
  if (!value || typeof value !== "object") return;

  const id = value.aweme_id || value.awemeId;
  if (id && !map.has(String(id))) {
    const candidates = [
      value.video?.cover?.url_list?.[0],
      value.video?.origin_cover?.url_list?.[0],
      value.video?.dynamic_cover?.url_list?.[0],
      value.chan_feed_video?.small_card_url?.url_list?.[0],
      value.share_info?.share_image_url?.url_list?.[0],
      value.images?.[0]?.url_list?.[0],
      value.image_list?.[0]?.url_list?.[0],
    ].filter(Boolean);
    if (candidates[0]) map.set(String(id), candidates[0]);
  }

  Object.values(value).forEach((item) => collectDouyinCoverCandidates(item, map));
}

function buildDouyinCoverMap() {
  if (!fs.existsSync(DOUYIN_BODIES)) return new Map();
  const json = JSON.parse(fs.readFileSync(DOUYIN_BODIES, "utf8"));
  const map = new Map();
  collectDouyinCoverCandidates(json, map);
  return map;
}

async function fetchBilibiliCover(bvid) {
  const response = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`, {
    headers: {
      accept: "application/json,text/plain,*/*",
      referer: "https://www.bilibili.com/",
      "user-agent": "Mozilla/5.0",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  if (body.code !== 0 || !body.data?.pic) throw new Error(body.message || "No pic");
  return normalizeBiliPic(body.data.pic);
}

const videos = readDashboardData();
const douyinCovers = buildDouyinCoverMap();
let fixedBilibili = 0;
let fixedDouyin = 0;
let fixedYouTube = 0;
let failedBilibili = 0;

for (const video of videos) {
  if (video.cover) continue;

  if (video.platform === "YouTube") {
    const id = youtubeIdFromUrl(video.url);
    if (id) {
      video.cover = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
      fixedYouTube++;
    }
    continue;
  }

  if (video.platform === "Douyin") {
    const id = douyinIdFromUrl(video.url) || String(video.bvid || "").replace(/^douyin-/i, "");
    const cover = douyinCovers.get(id);
    if (cover) {
      video.cover = cover;
      fixedDouyin++;
    }
    continue;
  }

  if (video.platform === "Bilibili" && video.bvid) {
    try {
      video.cover = await fetchBilibiliCover(video.bvid);
      fixedBilibili++;
      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch (error) {
      failedBilibili++;
      console.warn(`Bilibili cover failed: ${video.bvid} ${error.message}`);
    }
  }
}

writeDashboardData(videos);

console.log(JSON.stringify({
  fixedBilibili,
  failedBilibili,
  fixedDouyin,
  fixedYouTube,
  douyinCoverCandidates: douyinCovers.size,
}, null, 2));
