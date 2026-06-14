import fs from "node:fs";
import vm from "node:vm";

const src = fs.readFileSync("dashboard/data.js", "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const videos = sandbox.window.VIDEO_DASHBOARD_DATA || [];

const overrides = {
  BV1Ji4y1M7mW: {
    category: "学习教程",
    summary: "UG12.0 系统入门课程，适合机械设计、建模初学者按章节学习基础功能。",
    keyPoints: ["UG12.0基础", "机械建模入门", "系统课程"],
    tools: ["UG NX"],
  },
  BV1EtQiBhE8b: {
    category: "CAD建模3D打印",
    summary: "用真实地形数据制作并 3D 打印雪山模型，适合学习地形模型处理与多色/双头打印思路。",
    keyPoints: ["真实地形数据", "3D打印雪山", "拓竹X2D体验"],
    tools: ["3D打印", "MakerWorld", "拓竹X2D"],
  },
  BV1pUQjBLEFP: {
    category: "学习教程",
    summary: "UG NX12.0 软件安装与激活教程，适合需要搭建 UG 学习环境的人；注意安装包来源和授权风险。",
    keyPoints: ["UG安装", "软件环境配置", "授权风险"],
    tools: ["UG NX12.0"],
  },
  BV13hFfzTEks: {
    category: "CAD建模3D打印",
    summary: "Gridfinity 定制收纳建模教程，包含底座计算器和 Fusion360 插件，适合做 3D 打印收纳系统。",
    keyPoints: ["Gridfinity收纳", "Fusion360插件", "3D打印模型"],
    tools: ["Gridfinity", "Fusion360"],
  },
  BV1CPrXBREFa: {
    category: "游戏攻略",
    summary: "Minecraft 原版生存服务器招募介绍，重点是服务器版本、玩法机制和入群方式。",
    keyPoints: ["Minecraft服务器", "原版生存", "多人联机"],
    tools: ["Minecraft"],
  },
  BV1Y5SnBMEzR: {
    category: "工程制造",
    summary: "展示 WBROV 自主管道巡检开源案例，适合关注水下机器人、巡检系统和工程落地的人。",
    keyPoints: ["管道巡检", "水下机器人", "开源案例"],
    tools: ["WBROV"],
  },
  BV1j44y1E7ot: {
    category: "学习教程",
    summary: "高等数学上册 6 小时速通课程，适合考前补基础和快速梳理知识框架。",
    keyPoints: ["高等数学", "考试复习", "速通课程"],
    tools: [],
  },
  BV1TeRPYBEX8: {
    category: "学习教程",
    summary: "成图大赛机械手建模讲课视频，适合练习机械制图、建模表达和竞赛题型。",
    keyPoints: ["成图大赛", "机械手建模", "竞赛训练"],
    tools: [],
  },
  BV1km411Z73x: {
    category: "工程制造",
    summary: "Pixhawk 与 ROS 结合的小车平台教程，适合做移动机器人、地面车和算法验证平台。",
    keyPoints: ["Pixhawk", "ROS", "地面小车"],
    tools: ["Pixhawk", "ROS"],
  },
  BV1S54y157Gt: {
    category: "垂起",
    summary: "Pix/Ardupilot 使用 ExpressLRS 的教程，适合飞控用户配置高频头和接收机链路。",
    keyPoints: ["Ardupilot", "ExpressLRS", "飞控链路"],
    tools: ["Ardupilot", "ExpressLRS"],
  },
  BV1HnRGYJE6Z: {
    category: "软件工具",
    summary: "免费电视直播方案与开源项目推荐，适合搭建手机/TV 端无广告直播源方案。",
    keyPoints: ["电视直播", "开源项目", "直播源"],
    tools: ["my-tv-0", "IPTV"],
  },
  BV1ZE421M7p7: {
    category: "垂起",
    summary: "PIX 飞控四轴飞行器组装、调试与试飞教程，适合多旋翼入门和 GPS 悬停返航学习。",
    keyPoints: ["PIX飞控", "四轴组装", "GPS返航"],
    tools: ["PIX", "F450"],
  },
  BV1Ub411s7N5: {
    category: "垂起",
    summary: "Pixhawk 基础视频教程合集，适合系统学习飞控硬件、参数配置和基础飞行控制。",
    keyPoints: ["Pixhawk基础", "飞控教程", "参数配置"],
    tools: ["Pixhawk"],
  },
  BV164411J7GE: {
    category: "学习教程",
    summary: "Arduino 零基础入门合辑，适合创客、单片机和电子控制初学者建立基础。",
    keyPoints: ["Arduino", "创客入门", "电子控制"],
    tools: ["Arduino"],
  },
  BV1HH4y1X7fb: {
    category: "学习教程",
    summary: "ESP32-S3 Arduino IDE 沉浸式教程，适合学习 Wi-Fi、HTTP、云端数据交互等物联网基础。",
    keyPoints: ["ESP32-S3", "Arduino IDE", "物联网"],
    tools: ["ESP32-S3", "Arduino IDE"],
  },
  BV1xo4y1G7ZA: {
    category: "学习教程",
    summary: "Arduino 控制步进电机和直线模组的入门案例，适合机电控制初学者动手练习。",
    keyPoints: ["步进电机", "直线模组", "Arduino控制"],
    tools: ["Arduino"],
  },
  BV1RM4y1a7J5: {
    category: "学习教程",
    summary: "ESP32 Arduino 持续更新教程，适合从单片机原理、Arduino 用法到项目实践逐步学习。",
    keyPoints: ["ESP32", "Arduino", "单片机教程"],
    tools: ["ESP32", "Arduino"],
  },
  BV1iw411Z7HZ: {
    category: "学习教程",
    summary: "SOLIDWORKS 精品教程，覆盖草图、零件、装配体和工程图，适合机械设计系统学习。",
    keyPoints: ["SOLIDWORKS", "机械设计", "工程图"],
    tools: ["SOLIDWORKS"],
  },
  BV1BM4m1R7sJ: {
    category: "CAD建模3D打印",
    summary: "DIY Voron 3D 打印机与 OrcaSlicer 基础操作教程，适合学习切片软件和打印机调试。",
    keyPoints: ["Voron", "OrcaSlicer", "3D打印机"],
    tools: ["OrcaSlicer", "Voron"],
  },
  BV1uv4y1x7Fs: {
    category: "CAD建模3D打印",
    summary: "Klipper 安装后的配置、限位、归零、PID、挤出机步进值和调平教程，适合 3D 打印机调机。",
    keyPoints: ["Klipper配置", "PID调试", "挤出机校准"],
    tools: ["Klipper", "PrusaSlicer"],
  },
  BV1CV411X7hG: {
    category: "学习教程",
    summary: "Kali Linux 渗透测试入门教程，适合信息安全学习；需严格限定在合法授权环境中实践。",
    keyPoints: ["Kali Linux", "渗透测试", "安全学习"],
    tools: ["Kali Linux"],
  },
  BV17D4y1X7AT: {
    category: "工程制造",
    summary: "DIY 超迷你便携显示器项目，结合显示、供电和开源硬件设计，适合硬件制作参考。",
    keyPoints: ["便携显示器", "开源硬件", "DIY制作"],
    tools: ["GitHub"],
  },
  BV1PJ4m1b7Wz: {
    category: "工程制造",
    summary: "40 元制作 Augelight 氛围灯的材料和制作方案，适合低成本电子小制作。",
    keyPoints: ["氛围灯", "低成本DIY", "电子制作"],
    tools: ["TP4056"],
  },
  BV1WV411977W: {
    category: "软件工具",
    summary: "单网口主机部署 PVE、OpenWRT、群晖、Windows 和 Linux 的 All-in-One 家庭服务器教程。",
    keyPoints: ["PVE虚拟化", "OpenWRT", "NAS"],
    tools: ["PVE", "OpenWRT", "群晖"],
  },
  BV1S94y1J79J: {
    category: "软件工具",
    summary: "基于 Ubuntu 的低功耗家庭服务器部署教程，覆盖 BT、Home Assistant、Jellyfin 和游戏服务器。",
    keyPoints: ["家庭服务器", "Ubuntu", "Jellyfin"],
    tools: ["Ubuntu", "Home Assistant", "Jellyfin"],
  },
  BV1zu4y1g7LY: {
    category: "软件工具",
    summary: "Debian/Deepin 下一键部署 DIY NAS All-in-One 方案，适合办公、NAS、虚拟机和 Docker 混合使用。",
    keyPoints: ["DIY NAS", "Docker", "Debian"],
    tools: ["Debian", "Docker", "Deepin"],
  },
  BV1bu4y1E7Yh: {
    category: "软件工具",
    summary: "旧电脑改造成 NAS 的保姆级教程，覆盖文件共享、相册备份和媒体库自动化。",
    keyPoints: ["旧电脑改NAS", "文件共享", "媒体库"],
    tools: ["Jellyfin", "Alist", "群晖"],
  },
};

let updated = 0;
for (const video of videos) {
  const patch = overrides[video.bvid];
  if (!patch) continue;
  Object.assign(video, {
    category: patch.category,
    summary: patch.summary,
    keyPoints: patch.keyPoints,
    tools: patch.tools,
    actions: video.actions?.length ? video.actions : ["按需收藏到对应主题，后续需要时再深看。"],
    risks: video.risks?.length ? video.risks : ["基于标题和简介整理，关键步骤需要观看原视频确认。"],
    value: video.value === "低" && /教程|开源|项目|系统|入门|保姆|部署|控制|飞控|3D|SOLIDWORKS|UG|Arduino|ESP32/i.test(video.title) ? "中" : video.value,
    confidence: "high",
  });
  updated += 1;
}

const json = JSON.stringify(videos, null, 2);
fs.writeFileSync("dashboard/data.js", `window.VIDEO_DASHBOARD_DATA = ${json};\n`, "utf8");
fs.writeFileSync("video-summary-dashboard-data.json", `${json}\n`, "utf8");
console.log(JSON.stringify({ updated }, null, 2));
