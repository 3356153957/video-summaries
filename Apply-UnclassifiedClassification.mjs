import fs from "node:fs";
import vm from "node:vm";

const src = fs.readFileSync("dashboard/data.js", "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const videos = sandbox.window.VIDEO_DASHBOARD_DATA || [];
const result = JSON.parse(fs.readFileSync("video-summary-unclassified-output.json", "utf8"));
const byId = new Map((result.items || []).map((item) => [item.id, item]));

let updated = 0;
for (const video of videos) {
  const patch = byId.get(video.bvid);
  if (!patch) continue;
  video.category = patch.category || video.category;
  video.summary = patch.summary || video.summary;
  video.keyPoints = patch.key_points || video.keyPoints || [];
  video.tools = patch.tools || video.tools || [];
  video.actions = patch.actions || video.actions || [];
  video.risks = patch.risks || video.risks || [];
  video.value = patch.value_level || video.value || "中";
  video.confidence = patch.confidence || video.confidence || "medium";
  updated += 1;
}

const json = JSON.stringify(videos, null, 2);
fs.writeFileSync("dashboard/data.js", `window.VIDEO_DASHBOARD_DATA = ${json};\n`, "utf8");
fs.writeFileSync("video-summary-dashboard-data.json", `${json}\n`, "utf8");

console.log(JSON.stringify({ updated }, null, 2));
