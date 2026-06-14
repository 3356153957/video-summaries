import fs from "node:fs";

const source = JSON.parse(fs.readFileSync("site-favorites.json", "utf8"));

const categories = [
  {
    id: "ai-agent",
    name: "AI Agent / Codex / Skill / API",
    keywords: ["codex", "skill", "agent", "claude", "openai", "api", "插件", "ai pro", "google ai", "智能体"],
  },
  {
    id: "uav",
    name: "无人机 / 飞控 / FPV / 垂起固定翼",
    keywords: ["pixhawk", "ardupilot", "飞控", "无人机", "垂起", "vtol", "固定翼", "fpv", "inav", "f450", "遥控", "rc", "rov", "巡检", "两栖"],
  },
  {
    id: "cad-mechanical",
    name: "CAD / 机械设计 / UG / SOLIDWORKS",
    keywords: ["solidworks", "ug", "nx", "cad", "机械", "建模", "曲面", "成图", "工程图", "零件", "装配", "机电"],
  },
  {
    id: "electronics",
    name: "Arduino / ESP32 / 单片机 / 电机控制",
    keywords: ["arduino", "esp32", "单片机", "步进电机", "直线模组", "gpio", "rainmaker", "物联网", "wifi"],
  },
  {
    id: "3d-printing",
    name: "3D打印 / 切片 / Klipper / DIY制造",
    keywords: ["3d打印", "打印机", "klipper", "orca", "orcaslicer", "voron", "切片", "拓竹", "x2d", "收纳", "gridfinity"],
  },
  {
    id: "software-tools",
    name: "软件工具 / 开源项目 / 影音设备",
    keywords: ["github", "开源", "电视", "app", "服务器", "minecraft", "lumina", "音箱", "bose", "hifi", "软件", "安装", "激活"],
  },
  {
    id: "study-math",
    name: "课程学习 / 数学 / 考试",
    keywords: ["高等数学", "高数", "数学", "课程", "教程", "讲义", "高考", "一模", "英语", "发音"],
  },
  {
    id: "travel-history",
    name: "旅行 / 风景 / 历史 / 时事",
    keywords: ["拉萨", "旅行", "风景", "川西", "新疆", "历史", "左宗棠", "军演", "红军", "烟花", "雪山"],
  },
  {
    id: "life-emotion",
    name: "情感 / 生活 / 娱乐 / 音乐",
    keywords: ["情感", "情侣", "女朋友", "爱", "房子", "牛马", "青春", "成长", "晚安", "搞笑", "海阔天空", "钢琴", "黄家驹", "vlog", "探店", "小说"],
  },
  {
    id: "games",
    name: "游戏 / 车 / APEX / 地平线",
    keywords: ["apex", "地平线", "神力科莎", "漂移", "游戏", "英雄"],
  },
  {
    id: "misc",
    name: "其他 / 待人工判断",
    keywords: [],
  },
];

function normalize(value) {
  return String(value || "").toLowerCase();
}

function canonicalUrl(item) {
  const url = item.url || "";
  const bvid = item.bvid || "";
  if (bvid) return `https://www.bilibili.com/video/${bvid}`;
  return url;
}

function allItems() {
  const result = [];
  for (const platform of source.platforms || []) {
    for (const item of platform.items || []) {
      result.push({
        platform: platform.platform,
        folder: item.folder || item.section || "",
        title: item.title || "",
        author: item.author || "",
        description: item.description || "",
        url: canonicalUrl(item),
      });
    }
  }
  return result;
}

function chooseCategory(item) {
  const text = normalize(`${item.platform} ${item.folder} ${item.title} ${item.author} ${item.description}`);
  let best = categories[categories.length - 1];
  let bestScore = 0;

  for (const category of categories) {
    if (category.id === "misc") continue;
    let score = 0;
    for (const keyword of category.keywords) {
      if (text.includes(normalize(keyword))) score += keyword.length > 4 ? 2 : 1;
    }
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }

  return best;
}

function dedupe(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = item.url || `${item.platform}:${item.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function escapeCell(value) {
  const text = String(value || "").replaceAll('"', '""');
  return `"${text}"`;
}

const grouped = new Map(categories.map((category) => [category.id, []]));
for (const item of dedupe(allItems())) {
  const category = chooseCategory(item);
  grouped.get(category.id).push(item);
}

const total = Array.from(grouped.values()).reduce((sum, items) => sum + items.length, 0);
let markdown = `# 视频收藏分类目录\n\n`;
markdown += `- 生成时间：${new Date().toLocaleString("zh-CN", { hour12: false })}\n`;
markdown += `- 数据来源：site-favorites.json\n`;
markdown += `- 总条目：${total}\n\n`;
markdown += `## 分类概览\n\n`;

for (const category of categories) {
  const items = grouped.get(category.id);
  markdown += `- ${category.name}：${items.length} 条\n`;
}

markdown += `\n## 分类明细\n\n`;

for (const category of categories) {
  const items = grouped.get(category.id);
  markdown += `## ${category.name}\n\n`;
  if (!items.length) {
    markdown += `- 暂无\n\n`;
    continue;
  }
  for (const item of items) {
    const meta = [item.platform, item.folder, item.author].filter(Boolean).join(" / ");
    markdown += `- ${item.title}\n`;
    markdown += `  - 来源：${meta || item.platform}\n`;
    if (item.description) markdown += `  - 简介：${item.description.slice(0, 180)}${item.description.length > 180 ? "..." : ""}\n`;
    markdown += `  - 链接：${item.url}\n`;
  }
  markdown += `\n`;
}

let csv = "category,platform,folder,author,title,url,description\n";
for (const category of categories) {
  for (const item of grouped.get(category.id)) {
    csv += [
      category.name,
      item.platform,
      item.folder,
      item.author,
      item.title,
      item.url,
      item.description,
    ].map(escapeCell).join(",") + "\n";
  }
}

fs.writeFileSync("site-favorites-categories.md", markdown, "utf8");
fs.writeFileSync("site-favorites-categories.csv", csv, "utf8");
console.log("site-favorites-categories.md");
console.log("site-favorites-categories.csv");
