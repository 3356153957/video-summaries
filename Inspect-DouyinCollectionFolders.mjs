import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const edgeUserData = path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "User Data");

async function getFolderNames(page) {
  await page.goto("https://www.douyin.com/user/self?from_tab_name=main&showTab=favorite_collection", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(7000);
  const known = [
    "AI与Codex工具",
    "CAD建模3D打印",
    "健身健康",
    "哲学人文",
    "情感生活",
    "游戏攻略",
    "模板素材",
  ];
  const visible = [];
  for (const name of known) {
    if (await page.getByText(name, { exact: false }).count()) visible.push(name);
  }
  return visible;
}

async function clickText(page, text) {
  await page.getByText(text, { exact: true }).first().click({ timeout: 10000 });
  await page.waitForTimeout(3500);
}

async function extractVisibleVideos(page) {
  return await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll("a[href*='/video/']"));
    const items = [];
    const seen = new Set();
    for (const a of anchors) {
      const url = new URL(a.href, location.href);
      url.search = "";
      const key = url.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      let cur = a;
      let text = "";
      for (let depth = 0; depth < 8 && cur; depth++, cur = cur.parentElement) {
        const t = (cur.innerText || "").replace(/\s+/g, " ").trim();
        if (t.length > text.length && t.length < 800) text = t;
      }
      items.push({ url: key, text });
    }
    return items;
  });
}

async function main() {
  const context = await chromium.launchPersistentContext(edgeUserData, {
    executablePath: edgePath,
    headless: false,
    viewport: { width: 1440, height: 950 },
    args: ["--profile-directory=Default"],
  });
  const result = { folders: {}, duplicates: [] };
  try {
    const page = context.pages()[0] || await context.newPage();
    const folders = await getFolderNames(page);
    result.folderNames = folders;

    for (const folder of folders) {
      await page.goto("https://www.douyin.com/user/self?from_tab_name=main&showTab=favorite_collection", { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(6000);
      try {
        await page.getByText("收藏夹", { exact: true }).click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1000);
        await page.getByText(folder, { exact: false }).first().click({ timeout: 10000 });
        await page.waitForTimeout(3500);
      } catch (error) {
        result.folders[folder] = { error: error.message, items: [] };
        continue;
      }
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(2000);
      result.folders[folder] = { items: await extractVisibleVideos(page) };
    }

    const byUrl = new Map();
    for (const [folder, data] of Object.entries(result.folders)) {
      for (const item of data.items || []) {
        if (!byUrl.has(item.url)) byUrl.set(item.url, []);
        byUrl.get(item.url).push({ folder, text: item.text });
      }
    }
    for (const [url, hits] of byUrl.entries()) {
      if (hits.length > 1) result.duplicates.push({ url, hits });
    }
  } finally {
    await context.close();
  }
  fs.writeFileSync("douyin-folder-duplicates.json", JSON.stringify(result, null, 2), "utf8");
  console.log("douyin-folder-duplicates.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
