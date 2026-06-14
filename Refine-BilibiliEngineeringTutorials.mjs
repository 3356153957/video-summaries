import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const edgeUserData = path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "User Data");

const execute = process.argv.includes("--execute");
const sourceTitle = "工程制造";
const targetTitle = "学习生活杂项";
const baseMoveDelayMs = Number(process.env.BILI_REFINE_MOVE_DELAY_MS || "1000");
const retryDelayMs = (process.env.BILI_REFINE_RETRY_DELAYS_MS || "8000,25000,70000")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value >= 0);

const learningPatterns = [
  /教程/,
  /教学/,
  /入门/,
  /课程/,
  /练习/,
  /从零/,
  /保姆/,
  /自学/,
  /全套/,
  /全程/,
  /每日一练/,
  /讲解/,
  /基础/,
  /零基础/,
  /公开课/,
  /训练/,
  /实战课/,
  /学用/,
  /速成/,
  /一小时讲课/,
];

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

async function biliFetch(page, url) {
  return await page.evaluate(async (url) => {
    const res = await fetch(url, { credentials: "include" });
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
  }, url);
}

async function biliPost(page, url, form) {
  return await page.evaluate(async ({ url, form }) => {
    const body = new URLSearchParams(form);
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
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
  await page.waitForTimeout(1500);
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

async function getFolderItems(page, folder) {
  const total = Number(folder.media_count || 0);
  const pages = Math.max(1, Math.ceil(total / 20));
  const items = [];
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
    if (response.code !== 0) throw new Error(`Resource API failed for ${folder.title}: ${response.code} ${response.message || ""}`);
    for (const media of response.data?.medias || []) {
      if (media.id && media.type) {
        items.push({
          rid: media.id,
          type: media.type,
          bvid: media.bvid || "",
          title: clean(media.title),
          sourceFolderId: folder.id,
          sourceFolderTitle: folder.title,
          url: media.bvid ? `https://www.bilibili.com/video/${media.bvid}` : media.link || "",
        });
      }
    }
  }
  return items;
}

function getLearningReason(title) {
  const pattern = learningPatterns.find((item) => item.test(title));
  return pattern ? String(pattern).replaceAll("/", "") : "";
}

function selectTutorialLikeItems(items) {
  return items
    .map((item) => ({ ...item, reason: getLearningReason(item.title) }))
    .filter((item) => item.reason);
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
    const error = new Error(formatApiError(response));
    error.response = response;
    throw error;
  }
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

function writeReport(report) {
  fs.writeFileSync("bilibili-engineering-to-study-report.json", JSON.stringify(report, null, 2), "utf8");

  let md = "# Bilibili Engineering To Study Report\n\n";
  md += `- Mode: ${execute ? "EXECUTE" : "DRY RUN"}\n`;
  md += `- Generated: ${new Date().toLocaleString("zh-CN", { hour12: false })}\n`;
  md += `- Source: ${sourceTitle}\n`;
  md += `- Target: ${targetTitle}\n`;
  md += `- Source items scanned: ${report.sourceItemCount}\n`;
  md += `- Planned moves: ${report.moves.length}\n`;
  md += `- Move failures: ${report.moveResults.filter((item) => !item.ok).length}\n\n`;

  md += "## Final Folder Counts\n\n";
  for (const folder of report.finalFolders) {
    if ([sourceTitle, targetTitle, "AI工具", "无人机飞控", "软件工具"].includes(folder.title)) {
      md += `- ${folder.title}: ${folder.media_count}\n`;
    }
  }

  md += "\n## Moved Or Planned Items\n\n";
  for (const move of report.moves) {
    md += `- ${move.title}\n`;
    md += `  - Reason: ${move.reason}\n`;
    md += `  - URL: ${move.url}\n`;
  }

  if (report.moveResults.some((item) => !item.ok)) {
    md += "\n## Failures\n\n";
    for (const item of report.moveResults.filter((result) => !result.ok)) {
      md += `- ${item.title}: ${item.error}\n`;
    }
  }

  fs.writeFileSync("bilibili-engineering-to-study-report.md", md, "utf8");
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
    const folders = await getFolders(page, mid);
    const sourceFolder = folders.find((folder) => folder.title === sourceTitle);
    const targetFolder = folders.find((folder) => folder.title === targetTitle);
    if (!sourceFolder) throw new Error(`Source folder not found: ${sourceTitle}`);
    if (!targetFolder) throw new Error(`Target folder not found: ${targetTitle}`);

    const sourceItems = await getFolderItems(page, sourceFolder);
    const moves = selectTutorialLikeItems(sourceItems);
    const report = {
      execute,
      sourceItemCount: sourceItems.length,
      moves,
      moveResults: [],
      finalFolders: [],
    };

    if (execute) {
      for (const move of moves) {
        const result = await moveItemWithRetry(page, move, targetFolder.id, csrf);
        report.moveResults.push({ ...result, title: move.title, reason: move.reason, from: sourceTitle, to: targetTitle });
        await page.waitForTimeout(baseMoveDelayMs);
      }
    }

    report.finalFolders = (await getFolders(page, mid))
      .map((folder) => ({ id: folder.id, title: folder.title, media_count: folder.media_count }))
      .sort((a, b) => Number(b.media_count || 0) - Number(a.media_count || 0));

    writeReport(report);
    console.log(`${execute ? "EXECUTE" : "DRY RUN"} scanned=${sourceItems.length} moves=${moves.length} failed=${report.moveResults.filter((item) => !item.ok).length}`);
    for (const move of moves) console.log(`- ${move.reason}: ${move.title}`);
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
