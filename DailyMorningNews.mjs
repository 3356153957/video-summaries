import fs from "node:fs";
import path from "node:path";
import Parser from 'rss-parser';

// 简单解析本地的 .env 文件
function loadEnv() {
  const envFile = path.resolve("c:/Users/Administrator/Documents/视频总结/.env");
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

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  }
});

const feeds = [
  { name: '🌟 前沿科技与AI', url: 'https://36kr.com/feed', count: 5 },
  { name: '💻 硬件与数码', url: 'https://www.ithome.com/rss/', count: 5 },
  { name: '🇨🇳 国内要闻', url: 'https://rss.sina.com.cn/news/china/focus15.xml', count: 2 },
  { name: '🌍 国际视点', url: 'https://rss.sina.com.cn/news/world/focus15.xml', count: 2 }
];

function cleanHtml(html) {
  if (!html) return "暂无摘要";
  // 去除HTML标签
  let text = html.replace(/<[^>]+>/g, ' ');
  // 替换HTML实体
  text = text.replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  // 去除多余空白和换行
  text = text.replace(/\s+/g, ' ').trim();
  // 截取前80个字符作为摘要
  if (text.length > 80) {
    text = text.substring(0, 80) + '...';
  }
  return text || "暂无摘要";
}

async function getTenantAccessToken(appId, appSecret) {
  const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret })
  });
  const data = await response.json();
  if (data.code !== 0) throw new Error(`获取 tenant_access_token 失败: [${data.code}] ${data.msg}`);
  return data.tenant_access_token;
}

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
  if (data.code !== 0) throw new Error(`自建应用消息发送失败: [${data.code}] ${data.msg}`);
  return data;
}

async function main() {
  const env = loadEnv();
  const appId = env.FEISHU_APP_ID || process.env.FEISHU_APP_ID;
  const appSecret = env.FEISHU_APP_SECRET || process.env.FEISHU_APP_SECRET;
  const receiveId = env.FEISHU_RECEIVE_ID || process.env.FEISHU_RECEIVE_ID;
  const receiveIdType = env.FEISHU_RECEIVE_ID_TYPE || process.env.FEISHU_RECEIVE_ID_TYPE || "open_id";

  if (!appId || !appSecret || !receiveId) {
    console.error("缺少飞书配置，请检查 .env 文件");
    process.exit(1);
  }

  const contentLines = [];
  contentLines.push([
    { "tag": "text", "text": "为您精选今日全球科技前沿与行业时事：\n\n" }
  ]);

  for (const feed of feeds) {
    try {
      console.log(`Fetching ${feed.name}...`);
      const parsed = await parser.parseURL(feed.url);
      
      if (parsed.items && parsed.items.length > 0) {
        contentLines.push([
          { "tag": "text", "text": `【${feed.name}】\n`, "style": ["bold"] }
        ]);

        const itemsToTake = parsed.items.slice(0, feed.count);
        itemsToTake.forEach((item, index) => {
          let title = item.title ? item.title.trim() : "无标题";
          title = title.replace(/\s+/g, ' '); 
          const link = item.link || "";
          const summary = cleanHtml(item.contentSnippet || item.content || item.description);

          contentLines.push([
            { "tag": "text", "text": `${index + 1}. ` },
            { "tag": "a", "text": title, "href": link }
          ]);
          contentLines.push([
            { "tag": "text", "text": `   💡 摘要: ${summary}\n` }
          ]);
        });
        
        contentLines.push([
          { "tag": "text", "text": "\n" }
        ]);
      }
    } catch (e) {
      console.error(`Failed to fetch ${feed.name}: ${e.message}`);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const postContent = {
    "zh_cn": {
      "title": `📰 每日科技与时事早报 (${today})`,
      "content": contentLines
    }
  };

  try {
    const token = await getTenantAccessToken(appId, appSecret);
    const res = await sendAppMessage(token, receiveId, receiveIdType, postContent);
    console.log("飞书早报推送成功：", res);
  } catch (err) {
    console.error(err);
  }
}

main();
