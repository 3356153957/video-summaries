import fs from "node:fs";
import path from "node:path";

const summaryFile = fs.existsSync("video-summary-summary.json")
  ? "video-summary-summary.json"
  : "video-summary-gemini-output.json";
const summary = JSON.parse(fs.readFileSync(summaryFile, "utf8"));

const unclassifiedOutputFile = "video-summary-unclassified-output.json";
if (fs.existsSync(unclassifiedOutputFile)) {
  const unclassifiedOutput = JSON.parse(fs.readFileSync(unclassifiedOutputFile, "utf8"));
  if (Array.isArray(unclassifiedOutput.items)) {
    const sanitizedInputFile = "video-summary-unclassified-input.sanitized.json";
    if (fs.existsSync(sanitizedInputFile)) {
      const sanitized = JSON.parse(fs.readFileSync(sanitizedInputFile, "utf8"));
      const sanitizedById = new Map((sanitized.items || []).map((item) => [item.id, item]));

      unclassifiedOutput.items = unclassifiedOutput.items.map((item) => {
        const orig = sanitizedById.get(item.id);
        if (orig) {
          return {
            ...item,
            platform: orig.platform,
            source_id: orig.platform === "Douyin" ? "" : orig.id,
            title: orig.title,
            url: orig.url,
          };
        }
        return item;
      });
    }
    summary.items = [...(summary.items || []), ...unclassifiedOutput.items];
  }
}
const geminiInput = JSON.parse(fs.readFileSync("video-summary-gemini-input.json", "utf8"));
const existing = JSON.parse(fs.readFileSync("bilibili-ai-video-content-notes.json", "utf8"));
const byBvid = new Map(existing.map((item) => [item.bvid, item]));

const dashboardDataFile = "video-summary-dashboard-data.json";
const prevDashboardData = fs.existsSync(dashboardDataFile)
  ? JSON.parse(fs.readFileSync(dashboardDataFile, "utf8"))
  : [];
const prevByBvid = new Map(prevDashboardData.map((item) => [item.bvid, item]));

const bilibiliCovers = {
  BV1DfL16WEwq: "./covers/BV1DfL16WEwq.jpg",
  BV1MXLt6vE6s: "./covers/BV1MXLt6vE6s.jpg",
  BV1RcRmBbE3x: "./covers/BV1RcRmBbE3x.jpg",
  BV1q5G961Ech: "./covers/BV1q5G961Ech.jpg",
  BV1384y1M76j: "./covers/BV1384y1M76j.jpg",
  BV1qpwEzTEa9: "./covers/BV1qpwEzTEa9.jpg",
  BV1t1gPzeErV: "./covers/BV1t1gPzeErV.jpg",
};

const pluginTen = [
  { name: "Hyperframe", role: "创意动画与视觉包装，适合标题卡、动态包装、短视频动画。", confidence: "high" },
  { name: "Remotion", role: "工程化视频生成，适合数据视频、榜单视频、可复用模板视频。", confidence: "medium", note: "转写中出现 Remocean，按上下文校正为 Remotion。" },
  { name: "Figma / 设计稿插件", role: "把模糊产品想法转成移动端页面、配色、组件和产品原型。", confidence: "medium", note: "转写为“Big 码/设计狗”，具体插件名需人工核对。" },
  { name: "Web App 插件", role: "根据设计稿或需求开发网页应用、网页游戏。", confidence: "medium" },
  { name: "iOS App 插件", role: "把网页/产品原型改造成 iOS 手机 App 或安装包。", confidence: "low", note: "视频明确提到 iOS 手机 App，但插件英文名未识别清楚。" },
  { name: "Android App 插件", role: "开发安卓应用，和 iOS 插件同属产品开发类。", confidence: "low", note: "插件英文名未识别清楚。" },
  { name: "表格插件", role: "清洗、分类、统计、画图，适合账单和数据分析。", confidence: "high" },
  { name: "PPT 插件", role: "把分析结果整理成汇报、复盘、项目展示用 PPT。", confidence: "high" },
  { name: "Computer Use", role: "直接操作本机电脑和已登录浏览器，适合依赖登录态或桌面软件的任务。", confidence: "high" },
  { name: "Browser Use", role: "使用 AI 内置浏览器处理网页浏览、信息提取、资料整理，权限更收敛。", confidence: "high" },
];

function compactNumber(value) {
  return Number(value || 0);
}

function platformCover(item) {
  if (item.platform === "Bilibili" && bilibiliCovers[item.source_id]) return bilibiliCovers[item.source_id];
  if (item.platform === "YouTube" && item.source_id) return `https://img.youtube.com/vi/${item.source_id}/hqdefault.jpg`;
  return "";
}

function fallbackMeta(item) {
  if (item.platform === "Bilibili" && byBvid.has(item.source_id)) {
    const local = byBvid.get(item.source_id);
    return {
      author: local.author || "",
      duration: local.duration || null,
      views: local.stat?.view || null,
      favorites: local.stat?.favorite || null,
      transcript: `../bilibili-ai-transcripts/${item.source_id}.txt`,
    };
  }
  return { author: "", duration: null, views: null, favorites: null, transcript: "" };
}

function category(item) {
  if (item.category) return item.category;
  if (item.platform === "Bilibili" && /AI工具|默认收藏夹/.test(item.folder || "")) return "AI工具";
  if (item.platform === "Douyin") return item.folder || "抖音收藏";
  if (item.platform === "YouTube") return item.folder || "YouTube收藏";
  return item.folder || "未分类";
}

function detailKey(item) {
  return `${item.platform}|${item.source_id || ""}|${item.title}`;
}

function inputKey(item) {
  return `${item.platform}|${item.id || ""}|${item.title}`;
}

function normalize(item, index) {
  const meta = fallbackMeta(item);
  const namedItems = item.source_id === "BV1MXLt6vE6s" ? pluginTen : (item.named_items || []);
  const bvid = item.source_id || `${item.platform}-${index}`;
  
  let dateAdded = new Date().toISOString().slice(0, 10);
  let cover = platformCover(item);
  if (prevByBvid.has(bvid)) {
    dateAdded = prevByBvid.get(bvid).date_added || dateAdded;
    let prevCover = prevByBvid.get(bvid).cover || "";
    if (prevCover.startsWith("./covers/")) {
      const coverFile = path.resolve("dashboard", prevCover);
      if (fs.existsSync(coverFile)) {
        const stat = fs.statSync(coverFile);
        if (stat.size < 4000) {
          console.log(`Filter out small invalid cover: ${prevCover} (${stat.size} bytes)`);
          prevCover = "";
        }
      } else {
        prevCover = "";
      }
    }
    cover = prevCover || cover;
  }

  return {
    platform: item.platform,
    bvid,
    title: item.title,
    author: meta.author || item.author || "",
    url: item.url || "",
    cover,
    category: category(item),
    value: item.value_level || "中",
    priority: index + 1,
    duration: meta.duration,
    views: compactNumber(meta.views),
    favorites: compactNumber(meta.favorites),
    transcript: meta.transcript,
    summary: item.summary || "",
    keyPoints: item.key_points || [],
    namedItems,
    tools: item.tools || namedItems.map((entry) => entry.name),
    actions: item.actions || [],
    risks: item.risks || [],
    contentType: item.content_type || "general",
    confidence: item.confidence || "medium",
    date_added: dateAdded,
  };
}

const detailMap = new Map((summary.items || []).map((item) => [detailKey(item), item]));
const detailById = new Map((summary.items || [])
  .filter((item) => item.source_id)
  .map((item) => [`${item.platform}|${item.source_id}`, item]));
const dashboardItems = (geminiInput.items || []).map((source, index) => {
  const detailed = detailById.get(`${source.platform}|${source.id || ""}`) || detailMap.get(inputKey(source));
  if (detailed) return normalize(detailed, index);
  const item = {
    platform: source.platform,
    source_id: source.id || "",
    title: source.title,
    url: source.url || "",
    folder: source.folder || "",
    content_type: source.type_hint || "general",
    summary: source.description
      ? source.description.slice(0, 180)
      : `${source.type_hint === "tutorial" ? "教程类视频，先轻量归档，不深挖正文。" : "基于标题轻量归档，等待后续深度总结。"} 分类：${source.folder || "未分类"}`,
    key_points: [],
    named_items: [],
    tools: [],
    actions: [],
    risks: source.type_hint === "tutorial" ? ["教程类正文通常很长，默认不深挖，按需再转写总结。"] : [],
    value_level: source.type_hint === "list_or_tool" || source.type_hint === "case" ? "中" : "低",
    confidence: "low",
  };
  return normalize(item, index);
});
fs.writeFileSync("dashboard/data.js", `window.VIDEO_DASHBOARD_DATA = ${JSON.stringify(dashboardItems, null, 2)};\n`, "utf8");
fs.writeFileSync("video-summary-dashboard-data.json", JSON.stringify(dashboardItems, null, 2), "utf8");
console.log(`dashboard items=${dashboardItems.length}`);
console.log(`summary source=${summaryFile}`);
