import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const edgeUserData = path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "User Data");

const execute = process.argv.includes("--execute");
const moveLimit = Number(process.env.SIMPLIFY_MOVE_LIMIT || "0");
const baseMoveDelayMs = Number(process.env.SIMPLIFY_MOVE_DELAY_MS || "900");
const retryDelayMs = (process.env.SIMPLIFY_RETRY_DELAYS_MS || "8000,25000,70000")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value >= 0);

const mergeMap = new Map([
  ["AI工具-Codex", "AI工具"],
  ["无人机飞控FPV", "无人机飞控"],
  ["CAD机械设计", "工程制造"],
  ["单片机电控", "工程制造"],
  ["3D打印DIY", "工程制造"],
  ["软件工具开源", "软件工具"],
  ["课程数学考试", "学习生活杂项"],
  ["旅行历史风景", "学习生活杂项"],
  ["其他待整理", "学习生活杂项"],
]);

const deleteWhenEmpty = new Set([
  "AI工具-Codex",
  "无人机飞控FPV",
  "CAD机械设计",
  "单片机电控",
  "3D打印DIY",
  "软件工具开源",
  "课程数学考试",
  "旅行历史风景",
  "其他待整理",
  "情感生活娱乐",
  "游戏赛车",
  "垂起",
  "项目",
]);

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

async function deleteFolder(page, folder, csrf) {
  const response = await biliPost(page, "https://api.bilibili.com/x/v3/fav/folder/del", {
    media_ids: String(folder.id),
    csrf,
  });
  if (response.code !== 0) {
    const error = new Error(formatApiError(response));
    error.response = response;
    throw error;
  }
}

function writeReport(report) {
  fs.writeFileSync("bilibili-favorite-simplify-report.json", JSON.stringify(report, null, 2), "utf8");
  let md = "# Bilibili Favorite Simplify Report\n\n";
  md += `- Mode: ${execute ? "EXECUTE" : "DRY RUN"}\n`;
  md += `- Generated: ${new Date().toLocaleString("zh-CN", { hour12: false })}\n`;
  md += `- Planned moves: ${report.moves.length}\n`;
  md += `- Move failures: ${report.moveResults.filter((item) => !item.ok).length}\n`;
  md += `- Retry attempts: ${report.moveResults.reduce((sum, item) => sum + (item.attempts || 0), 0)}\n`;
  md += `- Deleted folders: ${report.deleteResults.filter((item) => item.ok).length}\n`;
  md += `- Delete failures: ${report.deleteResults.filter((item) => !item.ok).length}\n\n`;

  md += "## Final Target Categories\n\n";
  for (const name of ["AI工具", "无人机飞控", "工程制造", "软件工具", "学习生活杂项"]) {
    const count = report.finalFolders.find((folder) => folder.title === name)?.media_count ?? "unknown";
    md += `- ${name}: ${count}\n`;
  }

  md += "\n## Moves\n\n";
  for (const move of report.moves) {
    md += `- ${move.title}\n`;
    md += `  - From: ${move.from}\n`;
    md += `  - To: ${move.to}\n`;
    md += `  - URL: ${move.url}\n`;
  }

  if (report.deleteResults.length) {
    md += "\n## Deleted Old Folders\n\n";
    for (const item of report.deleteResults) {
      md += `- ${item.ok ? "OK" : "FAILED"}: ${item.title}`;
      if (item.error) md += ` - ${item.error}`;
      md += "\n";
    }
  }

  fs.writeFileSync("bilibili-favorite-simplify-report.md", md, "utf8");
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
    const folderByTitle = new Map(folders.map((folder) => [folder.title, folder]));

    const moves = [];
    for (const [sourceTitle, targetTitle] of mergeMap.entries()) {
      const sourceFolder = folderByTitle.get(sourceTitle);
      if (!sourceFolder || Number(sourceFolder.media_count || 0) === 0) continue;
      const items = await getFolderItems(page, sourceFolder);
      for (const item of items) {
        moves.push({ ...item, from: sourceTitle, to: targetTitle });
      }
    }

    if (moveLimit > 0 && moves.length > moveLimit) {
      moves.splice(moveLimit);
    }

    const report = {
      execute,
      moves,
      moveResults: [],
      deleteResults: [],
      finalFolders: [],
    };

    if (execute) {
      const targetIds = new Map();
      for (const targetName of new Set(mergeMap.values())) {
        const id = await ensureFolder(page, folders, targetName, csrf);
        targetIds.set(targetName, id);
        folders = await getFolders(page, mid);
      }

      for (const move of moves) {
        const result = await moveItemWithRetry(page, move, targetIds.get(move.to), csrf);
        report.moveResults.push({ ...result, title: move.title, from: move.from, to: move.to });
        await page.waitForTimeout(baseMoveDelayMs);
      }

      folders = await getFolders(page, mid);
      for (const folder of folders) {
        if (!deleteWhenEmpty.has(folder.title) || Number(folder.media_count || 0) !== 0) continue;
        try {
          await deleteFolder(page, folder, csrf);
          report.deleteResults.push({ ok: true, title: folder.title });
          await page.waitForTimeout(250);
        } catch (error) {
          report.deleteResults.push({ ok: false, title: folder.title, error: error.message });
        }
      }
    }

    report.finalFolders = (await getFolders(page, mid))
      .map((folder) => ({ id: folder.id, title: folder.title, media_count: folder.media_count }))
      .sort((a, b) => Number(b.media_count || 0) - Number(a.media_count || 0));
    writeReport(report);
    console.log(`${execute ? "EXECUTE" : "DRY RUN"} moves=${moves.length} failed=${report.moveResults.filter((item) => !item.ok).length}`);
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
