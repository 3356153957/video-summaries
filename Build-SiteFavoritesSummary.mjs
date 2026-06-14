import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("site-favorites.json", "utf8"));
const platforms = Object.fromEntries(data.platforms.map((platform) => [platform.platform, platform]));

function countBy(items, field) {
  const counts = new Map();
  for (const item of items) {
    const key = item[field] || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function pick(items, matcher, limit = 8) {
  return items.filter((item) => matcher(`${item.title} ${item.description || ""}`)).slice(0, limit);
}

function line(item) {
  const author = item.author ? ` - ${item.author}` : "";
  const folder = item.folder ? ` [${item.folder}]` : item.section ? ` [${item.section.replace(/^https?:\/\/www\./, "")}]` : "";
  return `- ${item.title}${author}${folder}\n  ${item.url}`;
}

const bilibili = platforms.Bilibili || { items: [], folders: [] };
const douyin = platforms.Douyin || { items: [] };
const youtube = platforms.YouTube || { items: [], sections: [] };

const biliItems = bilibili.items || [];
const douyinItems = douyin.items || [];
const ytItems = youtube.items || [];

const aiCodex = pick(biliItems, (text) => /Codex|Skill|Agent|Claude|API|OpenAI|插件/i.test(text), 10);
const engineering = pick(biliItems, (text) => /Arduino|ESP32|单片机|SOLIDWORKS|UG|NX|3D打印|Klipper|Orca|建模|机械|机电/i.test(text), 12);
const uav = pick(biliItems, (text) => /Pixhawk|Ardupilot|飞控|无人机|垂起|VTOL|固定翼|FPV|INAV|ROV|巡检/i.test(text), 12);
const travelStudy = pick(biliItems, (text) => /拉萨|高等数学|Google AI|Lumina|电视|Minecraft/i.test(text), 8);

const douyinTech = pick(douyinItems, (text) => /solidworks|曲面|无人机|FPV|RC|技术|教程|音箱|高三|数学/i.test(text), 12);
const douyinLife = pick(douyinItems, (text) => /情感|情侣|女朋友|爱|房子|牛马|青春|成长|晚安|搞笑|海阔天空|人生/i.test(text), 12);
const douyinScenery = pick(douyinItems, (text) => /风景|旅行|川西|烟花|红军|新疆|历史|军演/i.test(text), 8);

const ytReal = ytItems.filter((item) =>
  item.title &&
  !/^(全部播放|随机播放|赞过的视频|\d+:\d+|已观看)/.test(item.title)
);

const folderCounts = countBy(biliItems, "folder");
const youtubeCounts = youtube.sections || [];

const md = `# 网站内视频收藏总结

- 生成时间：${new Date(data.generated_at).toLocaleString("zh-CN", { hour12: false })}
- 浏览器：Microsoft Edge Default profile
- 数据来源：已打开 B站、抖音、YouTube 网站内收藏/喜欢/稍后再看页面
- 抓取结果：B站 ${biliItems.length} 条，抖音 ${douyinItems.length} 条，YouTube ${ytItems.length} 条

## 总体画像

你的收藏明显不是纯娱乐向，而是“AI 工具 + 工程实践 + 无人机/飞控 + 机械建模/3D打印 + 少量生活情绪内容”的混合资料库。

最核心的主线有三条：

1. AI Agent / Codex 生产力：关注 Codex 插件、Skill、第三方 API、Claude/Codex 对比和上手教程。
2. 工程动手能力：UG NX、SOLIDWORKS、Arduino、ESP32、3D 打印、Klipper、OrcaSlicer 等内容很多，偏实操。
3. 无人机与飞控：Pixhawk、Ardupilot、INAV、垂起固定翼、FPV、ROV 管道巡检，是一个很清晰的长期兴趣方向。

抖音收藏更碎片化，混合了工程技术短视频、情感/生活片段、风景旅行、历史时政、搞笑内容。YouTube 目前能看到喜欢和稍后再看列表，但页面提取到的标题较少，更多是播放列表入口和观看进度信息。

## B站收藏

状态：已登录，成功读取收藏夹 API。

收藏夹分布：
${folderCounts.map(([folder, count]) => `- ${folder}：${count} 条`).join("\n")}

### AI / Codex / Agent

${aiCodex.map(line).join("\n\n") || "- 未抓到明显条目"}

这一组可以看作你的“AI 工作流升级资料”。重点在 Codex 插件、Skill 编排、API 接入、Agent 生产力。建议优先整理成一份固定工作流：常用 Skill 组合、插件用途、API 接入步骤、踩坑记录。

### 机械 / 电控 / 3D打印 / 建模

${engineering.map(line).join("\n\n") || "- 未抓到明显条目"}

这一组是典型项目型学习资料：从 CAD/UG/SOLIDWORKS 到 Arduino/ESP32，再到 3D 打印机切片和 Klipper 配置。它们适合按“项目能力”沉淀，而不是按视频平台沉淀。

### 无人机 / 飞控 / 垂起固定翼

${uav.map(line).join("\n\n") || "- 未抓到明显条目"}

这一组非常集中，尤其是 Pixhawk/Ardupilot、INAV 垂起、F450、VTOL、FPV、ROV。它已经具备形成一个项目资料包的条件：飞控选型、机体结构、调参流程、通信链路、测试清单。

### 其他学习/工具/生活资料

${travelStudy.map(line).join("\n\n") || "- 未抓到明显条目"}

这里包括拉萨旅行攻略、高数、Google AI Pro、Lumina、电视直播工具、Minecraft 服务器等，属于临时兴趣或可复用工具类收藏。

## 抖音收藏

状态：已打开抖音个人页并读取可见的喜欢/收藏视频卡片，共 ${douyinItems.length} 条。

### 技术与学习

${douyinTech.map(line).join("\n\n") || "- 未抓到明显条目"}

抖音里的技术收藏偏短平快，适合做灵感和案例索引，不适合直接当系统教程。比较有价值的是 SOLIDWORKS 曲面、两栖/陆空无人机、FPV/RC、音箱对比、高中数学等。

### 情绪/生活/娱乐

${douyinLife.map(line).join("\n\n") || "- 未抓到明显条目"}

这部分占比也不低，主要是情感共鸣、生活压力、搞笑、音乐、青春成长类内容。它们不像 B站那样项目导向，更像“情绪收藏”和碎片化兴趣。

### 风景/历史/时事

${douyinScenery.map(line).join("\n\n") || "- 未抓到明显条目"}

这里体现出旅行、风景、历史故事和公共议题兴趣，和 B站里的拉萨攻略有轻微呼应。

## YouTube

状态：已打开 YouTube 喜欢、稍后再看、播放列表页面。

页面统计：
${youtubeCounts.map((section) => `- ${section.section}：页面可见 ${section.count} 项`).join("\n")}

可识别标题：
${ytReal.slice(0, 12).map(line).join("\n\n") || "- 页面主要返回播放/随机播放/进度类入口，未能稳定提取完整视频标题。"}

YouTube 登录态是可用的，但页面结构返回的可读标题不如 B站 API 稳定。后续如果要深挖 YouTube，建议单独抓取 \`playlist?list=LL\` 和 \`playlist?list=WL\` 的视频详情，或直接把具体视频链接交给 summarize。

## 建议下一步

1. 把 B站收藏拆成三个知识库主题：AI Agent、机电/CAD/3D打印、无人机飞控。
2. 抖音收藏只保留“技术灵感”和“项目案例”索引，情绪娱乐类不用深度沉淀。
3. YouTube 需要二次抓取具体视频标题，否则当前摘要只能说明列表结构。
4. 最值得优先整理的是“无人机/垂起固定翼项目资料包”，因为 B站和抖音都有明显重叠。
`;

fs.writeFileSync("site-favorites-summary.md", md, "utf8");
console.log("site-favorites-summary.md");
