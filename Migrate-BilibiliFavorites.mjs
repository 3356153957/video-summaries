import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const edgeUserData = path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "User Data");
const execute = process.argv.includes("--execute");
const baseMoveDelayMs = Number(process.env.BILI_MOVE_DELAY_MS || "900");
const retryDelayMs = (process.env.BILI_RETRY_DELAYS_MS || "8000,25000,70000")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value >= 0);

const targetCategories = [
  {
    name: "AI工具-Codex",
    keywords: ["codex", "skill", "agent", "claude", "openai", "api", "插件", "ai pro", "google ai", "智能体"],
  },
  {
    name: "无人机飞控FPV",
    keywords: ["pixhawk", "ardupilot", "飞控", "无人机", "垂起", "vtol", "固定翼", "fpv", "inav", "f450", "遥控", "rc", "rov", "巡检", "两栖"],
  },
  {
    name: "CAD机械设计",
    keywords: ["solidworks", "ug", "nx", "cad", "机械", "建模", "曲面", "成图", "工程图", "零件", "装配", "机电"],
  },
  {
    name: "单片机电控",
    keywords: ["arduino", "esp32", "单片机", "步进电机", "直线模组", "gpio", "rainmaker", "物联网", "wifi"],
  },
  {
    name: "3D打印DIY",
    keywords: ["3d打印", "打印机", "klipper", "orca", "orcaslicer", "voron", "切片", "拓竹", "x2d", "收纳", "gridfinity"],
  },
  {
    name: "软件工具开源",
    keywords: ["github", "开源", "电视", "app", "服务器", "minecraft", "lumina", "音箱", "bose", "hifi", "软件", "安装", "激活"],
  },
  {
    name: "课程数学考试",
    keywords: ["高等数学", "高数", "数学", "课程", "教程", "讲义", "高考", "一模", "英语", "发音"],
  },
  {
    name: "旅行历史风景",
    keywords: ["拉萨", "旅行", "风景", "川西", "新疆", "历史", "左宗棠", "军演", "红军", "烟花", "雪山"],
  },
  {
    name: "情感生活娱乐",
    keywords: ["情感", "情侣", "女朋友", "爱", "房子", "牛马", "青春", "成长", "晚安", "搞笑", "海阔天空", "钢琴", "黄家驹", "vlog", "探店", "小说"],
  },
  {
    name: "游戏赛车",
    keywords: ["apex", "地平线", "神力科莎", "漂移", "游戏", "英雄"],
  },
  {
    name: "其他待整理",
    keywords: [],
  },
];

function normalize(value) {
  return String(value || "").toLowerCase();
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isHtmlOrRiskResponse(response) {
  const message = String(response?.message || "");
  return response?.code === -999 || /<!doctype html|<html|spm_prefix|访问受限|验证|风控/i.test(message);
}

function formatApiError(response) {
  const message = String(response?.message || "").replace(/\s+/g, " ").trim();
  return `${response?.code ?? "unknown"} ${message.slice(0, 220)}`;
}

function chooseCategory(item) {
  const text = normalize(`${item.sourceFolderTitle} ${item.title} ${item.author} ${item.description}`);
  let best = targetCategories[targetCategories.length - 1];
  let bestScore = 0;

  for (const category of targetCategories) {
    if (!category.keywords.length) continue;
    let score = 0;
    for (const keyword of category.keywords) {
      if (text.includes(normalize(keyword))) score += keyword.length > 4 ? 2 : 1;
    }
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }

  return best.name;
}

async function biliFetch(page, url, options = {}) {
  return await page.evaluate(async ({ url, options }) => {
    const res = await fetch(url, { credentials: "include", ...options });
    const text = await res.text();
    const meta = {
      httpStatus: res.status,
      contentType: res.headers.get("content-type") || "",
      finalUrl: res.url,
    };
    try {
      return { ...JSON.parse(text), meta };
    } catch {
      return { code: -999, message: text.slice(0, 500), meta };
    }
  }, { url, options });
}

async function biliPost(page, url, form) {
  return await page.evaluate(async ({ url, form }) => {
    const body = new URLSearchParams(form);
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body,
    });
    const text = await res.text();
    const meta = {
      httpStatus: res.status,
      contentType: res.headers.get("content-type") || "",
      finalUrl: res.url,
    };
    try {
      return { ...JSON.parse(text), meta };
    } catch {
      return { code: -999, message: text.slice(0, 500), meta };
    }
  }, { url, form });
}

async function waitForRiskCooldown(page, delayMs, reason) {
  console.log(`Bilibili risk/HTML response, waiting ${Math.round(delayMs / 1000)}s before retry: ${reason}`);
  await page.waitForTimeout(delayMs);
  await page.goto("https://www.bilibili.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
}

async function getAccount(page, context) {
  await page.goto("https://www.bilibili.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  const cookies = await context.cookies("https://www.bilibili.com");
  const mid = cookies.find((cookie) => cookie.name === "DedeUserID")?.value;
  const csrf = cookies.find((cookie) => cookie.name === "bili_jct")?.value;
  if (!mid || !csrf) throw new Error("Bilibili login cookies were not found.");
  return { mid, csrf };
}

async function getFolders(page, mid) {
  const response = await biliFetch(page, `https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=${encodeURIComponent(mid)}&jsonp=jsonp`);
  if (response.code !== 0) throw new Error(`Folder API failed: ${response.code} ${response.message || ""}`);
  return response.data?.list || [];
}

async function getAllItems(page, folders) {
  const items = [];
  for (const folder of folders) {
    const total = Number(folder.media_count || 0);
    const pages = Math.max(1, Math.ceil(total / 20));
    for (let pn = 1; pn <= pages; pn++) {
      const url = new URL("https://api.bilibili.com/x/v3/fav/resource/list");
      url.searchParams.set("media_id", folder.id);
      url.searchParams.set("pn", String(pn));
      url.searchParams.set("ps", "20");
      url.searchParams.set("keyword", "");
      url.searchParams.set("order", "mtime");
      url.searchParams.set("type", "0");
      url.searchParams.set("tid", "0");
      url.searchParams.set("platform", "web");
      const response = await biliFetch(page, url.toString());
      if (response.code !== 0) throw new Error(`Resource API failed for ${folder.title} page ${pn}: ${response.code} ${response.message || ""}`);
      for (const media of response.data?.medias || []) {
        if (media.id && media.type) {
          items.push({
            rid: media.id,
            type: media.type,
            bvid: media.bvid || "",
            title: clean(media.title),
            author: media.upper?.name || "",
            description: clean(media.intro || ""),
            sourceFolderId: folder.id,
            sourceFolderTitle: folder.title,
            url: media.bvid ? `https://www.bilibili.com/video/${media.bvid}` : media.link || "",
          });
        }
      }
    }
  }
  return items;
}

async function ensureFolder(page, folders, name, csrf) {
  const existing = folders.find((folder) => folder.title === name);
  if (existing) return existing.id;

  const response = await biliPost(page, "https://api.bilibili.com/x/v3/fav/folder/add", {
    title: name,
    intro: "",
    privacy: "0",
    csrf,
  });
  if (response.code !== 0) throw new Error(`Create folder failed for ${name}: ${response.code} ${response.message || ""}`);
  return response.data?.id;
}

async function moveItem(page, item, targetFolderId, csrf) {
  const response = await biliPost(page, "https://api.bilibili.com/x/v3/fav/resource/deal", {
    rid: String(item.rid),
    type: String(item.type),
    add_media_ids: String(targetFolderId),
    del_media_ids: String(item.sourceFolderId),
    csrf,
  });
  if (response.code !== 0) {
    const error = new Error(`Move failed: ${item.title}: ${formatApiError(response)}`);
    error.response = response;
    throw error;
  }
  return response;
}

async function moveItemWithRetry(page, item, targetFolderId, csrf) {
  const delays = [0, ...retryDelayMs];
  let lastError;

  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) {
      await waitForRiskCooldown(page, delays[attempt], lastError?.message || "retry");
    }
    try {
      await moveItem(page, item, targetFolderId, csrf);
      return { ok: true, attempts: attempt + 1 };
    } catch (error) {
      lastError = error;
      if (!isHtmlOrRiskResponse(error.response) || attempt === delays.length - 1) {
        return { ok: false, attempts: attempt + 1, error: error.message };
      }
    }
  }

  return { ok: false, attempts: delays.length, error: lastError?.message || "unknown move error" };
}

function writePlan(plan) {
  fs.writeFileSync("bilibili-favorite-migration-plan.json", JSON.stringify(plan, null, 2), "utf8");

  let md = `# Bilibili Favorite Migration Plan\n\n`;
  md += `- Mode: ${execute ? "EXECUTE" : "DRY RUN"}\n`;
  md += `- Generated: ${new Date().toLocaleString("zh-CN", { hour12: false })}\n`;
  md += `- Total movable items: ${plan.moves.length}\n`;
  md += `- Items already in target folder: ${plan.skippedAlreadyInTarget.length}\n\n`;

  for (const category of targetCategories) {
    const moves = plan.moves.filter((move) => move.targetFolderTitle === category.name);
    md += `## ${category.name} (${moves.length})\n\n`;
    if (!moves.length) {
      md += `- None\n\n`;
      continue;
    }
    for (const move of moves) {
      md += `- ${move.title}\n`;
      md += `  - From: ${move.sourceFolderTitle}\n`;
      md += `  - To: ${move.targetFolderTitle}\n`;
      md += `  - URL: ${move.url}\n`;
    }
    md += `\n`;
  }

  if (plan.executed?.length) {
    md += `## Executed\n\n`;
    for (const result of plan.executed) {
      md += `- ${result.ok ? "OK" : "FAILED"}: ${result.title}`;
      if (result.error) md += ` - ${result.error}`;
      md += `\n`;
    }
  }

  fs.writeFileSync("bilibili-favorite-migration-plan.md", md, "utf8");
}

async function main() {
  const context = await chromium.launchPersistentContext(edgeUserData, {
    executablePath: edgePath,
    headless: false,
    viewport: { width: 1440, height: 950 },
    args: ["--profile-directory=Default"],
  });

  try {
    const page = context.pages()[0] || await context.newPage();
    const { mid, csrf } = await getAccount(page, context);
    let folders = await getFolders(page, mid);
    const items = await getAllItems(page, folders);

    const targetByName = {};
    for (const category of targetCategories) targetByName[category.name] = null;

    const moves = [];
    const skippedAlreadyInTarget = [];
    for (const item of items) {
      const targetFolderTitle = chooseCategory(item);
      if (item.sourceFolderTitle === targetFolderTitle) {
        skippedAlreadyInTarget.push({ ...item, targetFolderTitle });
      } else {
        moves.push({ ...item, targetFolderTitle });
      }
    }

    const plan = {
      execute,
      generatedAt: new Date().toISOString(),
      folders: folders.map((folder) => ({ id: folder.id, title: folder.title, media_count: folder.media_count })),
      moves,
      skippedAlreadyInTarget,
      executed: [],
    };

    if (execute) {
      for (const category of targetCategories) {
        targetByName[category.name] = await ensureFolder(page, folders, category.name, csrf);
        folders = await getFolders(page, mid);
      }
      for (const move of moves) {
        const result = await moveItemWithRetry(page, move, targetByName[move.targetFolderTitle], csrf);
        plan.executed.push({ ...result, title: move.title, from: move.sourceFolderTitle, to: move.targetFolderTitle });
        await page.waitForTimeout(baseMoveDelayMs);
      }
    }

    writePlan(plan);
    console.log(`${execute ? "EXECUTE" : "DRY RUN"} moves=${moves.length} skipped=${skippedAlreadyInTarget.length}`);
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
