import fs from "node:fs";
import path from "node:path";

// 简单解析本地的 .env 文件
function loadEnv() {
  const envFile = path.resolve(".env");
  if (!fs.existsSync(envFile)) return {};
  const content = fs.readFileSync(envFile, "utf8");
  const env = {};
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const parts = trimmed.split("=");
    const key = parts[0].trim();
    let val = parts.slice(1).join("=").trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[key] = val;
  });
  return env;
}

// 通过自建应用凭据获取 tenant_access_token
async function getTenantAccessToken(appId, appSecret) {
  const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret
    })
  });
  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`获取 tenant_access_token 失败: [${data.code}] ${data.msg}`);
  }
  return data.tenant_access_token;
}

// 自建应用发送单聊消息给指定用户
async function sendAppMessage(token, receiveId, receiveIdType, postContent) {
  const url = `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${receiveIdType || "open_id"}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      receive_id: receiveId,
      msg_type: "post",
      content: JSON.stringify(postContent)
    })
  });
  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`自建应用消息发送失败: [${data.code}] ${data.msg}`);
  }
  return data;
}

async function main() {
  const env = loadEnv();
  const appId = env.FEISHU_APP_ID || process.env.FEISHU_APP_ID;
  const appSecret = env.FEISHU_APP_SECRET || process.env.FEISHU_APP_SECRET;
  const receiveId = env.FEISHU_RECEIVE_ID || process.env.FEISHU_RECEIVE_ID;
  const receiveIdType = env.FEISHU_RECEIVE_ID_TYPE || process.env.FEISHU_RECEIVE_ID_TYPE || "open_id";
  const webhook = env.FEISHU_WEBHOOK || process.env.FEISHU_WEBHOOK;
  const siteUrl = env.GITHUB_PAGES_URL || "https://your-github-username.github.io/your-repo-name/dashboard/";

  const useAppMode = appId && appSecret && receiveId && !appId.includes("YOUR_FEISHU");
  const useWebhookMode = webhook && !webhook.includes("YOUR_FEISHU");

  if (!useAppMode && !useWebhookMode) {
    console.error("错误：未找到有效的飞书自建应用配置或 Webhook 机器人链接，请在本地 .env 文件中进行配置！");
    process.exit(1);
  }

  const dataPath = "video-summary-dashboard-data.json";
  if (!fs.existsSync(dataPath)) {
    console.error(`错误：未找到数据文件 ${dataPath}`);
    process.exit(1);
  }

  const videos = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const today = new Date().toISOString().slice(0, 10);
  const newVideos = videos.filter((video) => video.date_added === today);

  console.log(`今日新增视频数量：${newVideos.length}`);
  console.log(`发送模式：${useAppMode ? "飞书自建应用单聊模式" : "群机器人 Webhook 模式"}`);

  let titleText;
  let postContent;

  if (newVideos.length === 0) {
    titleText = "📅 今日视频收藏 - 无新增 ☕";
    postContent = {
      "zh_cn": {
        "title": titleText,
        "content": [
          [
            { "tag": "text", "text": "今天没有新增的视频收藏。继续保持专注，有需要时随时收藏新内容！\n\n" },
            { "tag": "text", "text": "🔗 个人收藏夹工作台入口：" },
            { "tag": "a", "text": "点击访问视频看板", "href": siteUrl }
          ]
        ]
      }
    };
  } else {
    titleText = `📅 今日新增收藏总结 (${today}) 🚀`;
    const contentLines = [
      [
        { "tag": "text", "text": `今日共新增 ${newVideos.length} 个收藏视频，已自动完成 AI 整理分类与总结：\n\n` }
      ]
    ];

    newVideos.forEach((video, index) => {
      contentLines.push([
        { "tag": "text", "text": `${index + 1}. 【${video.category || "未分类"}】` },
        { "tag": "a", "text": video.title, "href": video.url },
        { "tag": "text", "text": ` (UP: ${video.author || "未知"})` }
      ]);
      contentLines.push([
        { "tag": "text", "text": `   💡 AI 摘要: ${video.summary || "暂无"}\n` }
      ]);
      if (video.actions && video.actions.length > 0) {
        contentLines.push([
          { "tag": "text", "text": `   👉 行动点: ${video.actions.join("；")}\n` }
        ]);
      }
      contentLines.push([
        { "tag": "text", "text": "\n" }
      ]);
    });

    contentLines.push([
      { "tag": "text", "text": "────────────────────────\n" }
    ]);
    contentLines.push([
      { "tag": "text", "text": "🔗 查看完整转写稿及具体工具清单请访问：" },
      { "tag": "a", "text": "视频收藏工作台", "href": siteUrl }
    ]);

    postContent = {
      "zh_cn": {
        "title": titleText,
        "content": contentLines
      }
    };
  }

  try {
    if (useAppMode) {
      // 1. 获取 tenant_access_token
      console.log("正在通过自建应用获取 tenant_access_token...");
      const token = await getTenantAccessToken(appId, appSecret);
      // 2. 发送消息
      console.log(`正在发送消息给用户: ${receiveId}...`);
      const res = await sendAppMessage(token, receiveId, receiveIdType, postContent);
      console.log("飞书自建应用消息推送成功：", JSON.stringify(res));
    } else {
      // 机器人 Webhook 模式
      const payload = {
        msg_type: "post",
        content: {
          "post": postContent
        }
      };
      console.log("正在通过 Webhook 机器人发送消息...");
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${result}`);
      }
      console.log("飞书机器人 Webhook 推送成功：", result);
    }
  } catch (error) {
    console.error("飞书发送失败：", error.message);
    process.exit(1);
  }
}

main();
