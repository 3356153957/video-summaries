import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const edgeUserData = path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "User Data");

async function visibleTexts(page, selectors) {
  return await page.evaluate((selectors) => {
    const results = [];
    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        const text = (el.textContent || el.getAttribute("aria-label") || el.getAttribute("title") || "").replace(/\s+/g, " ").trim();
        if (text) results.push({ selector, text: text.slice(0, 160) });
      }
    }
    return results.slice(0, 200);
  }, selectors);
}

async function main() {
  const context = await chromium.launchPersistentContext(edgeUserData, {
    executablePath: edgePath,
    headless: false,
    viewport: { width: 1440, height: 950 },
    args: ["--profile-directory=Default"],
  });

  const result = {};
  try {
    const page = context.pages()[0] || await context.newPage();

    await page.goto("https://www.youtube.com/feed/playlists", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);
    result.youtubePlaylists = {
      url: page.url(),
      title: await page.title(),
      texts: await visibleTexts(page, [
        "button",
        "tp-yt-paper-button",
        "yt-button-shape",
        "ytd-button-renderer",
        "a[href*='playlist']",
      ]),
    };

    await page.goto("https://www.youtube.com/playlist?list=WL", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);
    result.youtubeWatchLater = {
      url: page.url(),
      title: await page.title(),
      texts: await visibleTexts(page, [
        "button",
        "ytd-menu-renderer",
        "yt-button-shape",
        "a#video-title",
        "a[href*='watch?v=']",
      ]),
    };

    await page.goto("https://www.douyin.com/user/self?from_tab_name=main&showTab=like", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(7000);
    result.douyinLike = {
      url: page.url(),
      title: await page.title(),
      texts: await visibleTexts(page, [
        "button",
        "[role='button']",
        "a[href*='/video/']",
        "[class*='collect']",
        "[class*='favorite']",
        "[class*='folder']",
      ]),
    };

    await page.goto("https://www.douyin.com/user/self?from_tab_name=main&showTab=favorite_collection", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(7000);
    result.douyinCollection = {
      url: page.url(),
      title: await page.title(),
      texts: await visibleTexts(page, [
        "button",
        "[role='button']",
        "a[href*='/video/']",
        "[class*='collect']",
        "[class*='favorite']",
        "[class*='folder']",
      ]),
    };
  } finally {
    await context.close();
  }

  fs.writeFileSync("other-site-classification-inspect.json", JSON.stringify(result, null, 2), "utf8");
  console.log("other-site-classification-inspect.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
