import fs from "node:fs";
import vm from "node:vm";

const src = fs.readFileSync("dashboard/data.js", "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const genericSummaryPattern = /基于标题轻量归档|等待后续深度总结|分类：未分类|教程类视频，先轻量归档/;
const videos = sandbox.window.VIDEO_DASHBOARD_DATA || [];
const items = videos
  .filter((video) => video.category === "未分类" || genericSummaryPattern.test(video.summary || ""))
  .map((video) => ({
    id: video.bvid,
    platform: video.platform,
    title: video.title,
    url: video.url || "",
    current_category: video.category,
    current_summary: video.summary || "",
    content_type: video.contentType || "general",
  }));

const payload = {
  generated_at: new Date().toISOString(),
  instruction: "Classify only these generic/unclassified dashboard items. Use title/url only; do not claim video content was watched.",
  allowed_categories: [
    "AI与Codex工具",
    "CAD建模3D打印",
    "工程制造",
    "学习教程",
    "健身健康",
    "哲学人文",
    "游戏攻略",
    "模板素材",
    "生活情感",
    "旅行美食",
    "影音娱乐",
    "时事升学",
    "其它收藏"
  ],
  items,
};

fs.writeFileSync("video-summary-unclassified-input.json", `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ count: items.length }, null, 2));
