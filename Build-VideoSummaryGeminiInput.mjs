import fs from "node:fs";
import path from "node:path";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function maybeRead(file, maxChars = 18000) {
  if (!fs.existsSync(file)) return "";
  return fs.readFileSync(file, "utf8").slice(0, maxChars);
}

function typeOfTitle(title) {
  if (/(\d+\s*个|必装|清单|推荐|工具|插件|Skill|项目|榜|术语)/i.test(title)) return "list_or_tool";
  if (/(教程|教学|入门|保姆|从零|零基础|全程|全套|指南|攻略|课程|练习)/i.test(title)) return "tutorial";
  if (/(实战|案例|Demo|demo|做了|生成|接管|自动化|一键)/i.test(title)) return "case";
  return "general";
}

function platformItemsFromSiteFavorites() {
  const data = readJson("site-favorites.json");
  const out = [];
  for (const platform of data.platforms || []) {
    for (const item of platform.items || []) {
      out.push({
        platform: item.platform || platform.platform,
        folder: item.folder || "",
        title: clean(item.title),
        url: item.url || "",
        id: item.bvid || item.videoId || "",
        author: clean(item.author),
        description: clean(item.description),
        duration: item.duration || null,
        type_hint: typeOfTitle(item.title),
      });
    }
  }
  return out;
}

function douyinItems() {
  const data = readJson("douyin-classification-report.json");
  const out = [];
  for (const bucket of data.added || []) {
    for (const title of bucket.titles || []) {
      out.push({
        platform: "Douyin",
        folder: bucket.folder,
        title: clean(title),
        url: "",
        id: "",
        author: "",
        description: "",
        duration: null,
        type_hint: typeOfTitle(title),
      });
    }
  }
  return out;
}

function youtubeItems() {
  const data = readJson("youtube-classification-report.json");
  return (data.added || []).map((item) => ({
    platform: "YouTube",
    folder: item.playlist,
    title: clean(item.title),
    url: item.videoId ? `https://www.youtube.com/watch?v=${item.videoId}` : "",
    id: item.videoId || "",
    author: "",
    description: "",
    duration: null,
    type_hint: typeOfTitle(item.title),
  }));
}

function buildTranscriptHints(items) {
  const transcriptDir = "bilibili-ai-transcripts";
  const interesting = new Set([
    "BV1MXLt6vE6s",
    "BV1RcRmBbE3x",
    "BV1q5G961Ech",
  ]);
  const hints = {};
  for (const item of items) {
    if (item.platform !== "Bilibili" || !item.id || !interesting.has(item.id)) continue;
    const transcriptPath = path.join(transcriptDir, `${item.id}.txt`);
    hints[item.id] = {
      reason: "list/tool video; extract concrete named tools/items if present",
      transcript_excerpt: maybeRead(transcriptPath, 18000),
    };
  }
  return hints;
}

const allItems = [
  ...platformItemsFromSiteFavorites(),
  ...douyinItems(),
  ...youtubeItems(),
];

const deduped = [];
const seen = new Set();
for (const item of allItems) {
  const key = `${item.platform}|${item.url || item.title}`;
  if (seen.has(key)) continue;
  seen.add(key);
  deduped.push(item);
}

const payload = {
  generated_at: new Date().toISOString(),
  instruction: {
    summary_policy: "For tutorial videos, do not deeply summarize full content unless transcript is supplied or explicit list extraction is needed. For list/tool videos, extract concrete named items and roles. For case videos, extract workflow and result.",
    output_should_be: "compact JSON, not prose",
  },
  counts: {
    total: deduped.length,
    by_platform: deduped.reduce((acc, item) => {
      acc[item.platform] = (acc[item.platform] || 0) + 1;
      return acc;
    }, {}),
  },
  items: deduped,
  transcript_hints: buildTranscriptHints(deduped),
};

fs.writeFileSync("video-summary-gemini-input.json", JSON.stringify(payload, null, 2), "utf8");
console.log(JSON.stringify(payload.counts, null, 2));
