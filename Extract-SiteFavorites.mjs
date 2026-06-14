import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const edgeUserData = path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "User Data");
const outputPath = path.resolve("site-favorites.json");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function uniqueByUrl(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    if (!item.url || seen.has(item.url)) continue;
    seen.add(item.url);
    result.push(item);
  }
  return result;
}

async function extractVideoAnchors(page, options = {}) {
  const { limit = 60, patterns = [] } = options;
  return uniqueByUrl(
    await page.evaluate(({ limit, patterns }) => {
      const regexes = patterns.map((pattern) => new RegExp(pattern));
      return Array.from(document.querySelectorAll("a[href]"))
        .map((a) => {
          const href = a.href;
          const text =
            a.getAttribute("title") ||
            a.getAttribute("aria-label") ||
            a.textContent ||
            "";
          return {
            title: text.replace(/\s+/g, " ").trim(),
            url: href,
          };
        })
        .filter((item) => item.title && regexes.some((regex) => regex.test(item.url)))
        .slice(0, limit);
    }, { limit, patterns })
  );
}

async function scrollPage(page, rounds = 4) {
  for (let i = 0; i < rounds; i++) {
    await page.mouse.wheel(0, 1600);
    await sleep(1200);
  }
}

async function getBilibiliFavorites(page, context) {
  const result = {
    platform: "Bilibili",
    status: "unknown",
    folders: [],
    items: [],
    notes: [],
  };

  await page.goto("https://www.bilibili.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(2500);

  const cookies = await context.cookies("https://www.bilibili.com");
  const mid = cookies.find((cookie) => cookie.name === "DedeUserID")?.value;
  if (!mid) {
    result.status = "not_logged_in_or_cookie_missing";
    result.notes.push("DedeUserID cookie was not found.");
    return result;
  }

  result.status = "logged_in";
  result.mid = mid;

  const foldersResponse = await page.evaluate(async (mid) => {
    const res = await fetch(`https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=${encodeURIComponent(mid)}&jsonp=jsonp`, {
      credentials: "include",
    });
    return res.json();
  }, mid);

  if (foldersResponse.code !== 0) {
    result.status = "api_error";
    result.notes.push(`Folder API returned code ${foldersResponse.code}: ${foldersResponse.message || ""}`);
    return result;
  }

  const folders = foldersResponse.data?.list || [];
  result.folders = folders.map((folder) => ({
    id: folder.id,
    title: folder.title,
    media_count: folder.media_count,
  }));

  for (const folder of folders.slice(0, 8)) {
    const listResponse = await page.evaluate(async (mediaId) => {
      const url = new URL("https://api.bilibili.com/x/v3/fav/resource/list");
      url.searchParams.set("media_id", mediaId);
      url.searchParams.set("pn", "1");
      url.searchParams.set("ps", "20");
      url.searchParams.set("keyword", "");
      url.searchParams.set("order", "mtime");
      url.searchParams.set("type", "0");
      url.searchParams.set("tid", "0");
      url.searchParams.set("platform", "web");
      const res = await fetch(url.toString(), { credentials: "include" });
      return res.json();
    }, folder.id);

    if (listResponse.code !== 0) {
      result.notes.push(`Resource API failed for folder ${folder.title}: ${listResponse.code} ${listResponse.message || ""}`);
      continue;
    }

    const medias = listResponse.data?.medias || [];
    for (const media of medias) {
      result.items.push({
        platform: "Bilibili",
        folder: folder.title,
        title: cleanText(media.title),
        url: media.bvid ? `https://www.bilibili.com/video/${media.bvid}` : media.link || `https://www.bilibili.com/video/av${media.id || ""}`,
        bvid: media.bvid || "",
        author: media.upper?.name || "",
        description: cleanText(media.intro || ""),
        duration: media.duration || null,
      });
    }
  }

  result.items = uniqueByUrl(result.items);
  return result;
}

async function getDouyinFavorites(page) {
  const result = {
    platform: "Douyin",
    status: "unknown",
    items: [],
    notes: [],
  };

  const urls = [
    "https://www.douyin.com/user/self?from_tab_name=main&showTab=favorite_collection",
    "https://www.douyin.com/user/self?from_tab_name=main&showTab=like",
    "https://www.douyin.com/jingxuan",
  ];

  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await sleep(5000);
      await scrollPage(page, 5);
      const items = await extractVideoAnchors(page, {
        limit: 80,
        patterns: ["douyin\\.com/video/", "iesdouyin\\.com/share/video/"],
      });
      for (const item of items) {
        result.items.push({ platform: "Douyin", section: url, ...item });
      }
    } catch (error) {
      result.notes.push(`${url}: ${error.message}`);
    }
  }

  result.items = uniqueByUrl(result.items);
  result.status = result.items.length ? "visible_items_found" : "no_visible_items_or_login_required";
  return result;
}

async function getYouTubeFavorites(page) {
  const result = {
    platform: "YouTube",
    status: "unknown",
    sections: [],
    items: [],
    notes: [],
  };

  const sections = [
    ["Liked videos", "https://www.youtube.com/playlist?list=LL"],
    ["Watch later", "https://www.youtube.com/playlist?list=WL"],
    ["Playlists", "https://www.youtube.com/feed/playlists"],
  ];

  for (const [section, url] of sections) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await sleep(5000);
      await scrollPage(page, 4);
      const items = uniqueByUrl(await page.evaluate(() => {
        const selectors = [
          "ytd-playlist-video-renderer",
          "ytd-rich-item-renderer",
          "ytd-grid-video-renderer",
          "ytd-video-renderer",
        ];
        const nodes = Array.from(document.querySelectorAll(selectors.join(",")));
        const extracted = nodes.map((node) => {
          const anchor =
            node.querySelector("a#video-title") ||
            node.querySelector("a.yt-simple-endpoint[href*='watch?v=']") ||
            node.querySelector("a[href*='watch?v=']");
          if (!anchor) return null;
          const title =
            anchor.getAttribute("title") ||
            anchor.getAttribute("aria-label") ||
            anchor.textContent ||
            "";
          const meta = Array.from(node.querySelectorAll("#metadata-line span, ytd-channel-name, .inline-metadata-item"))
            .map((el) => el.textContent || "")
            .join(" ");
          return {
            title: title.replace(/\s+/g, " ").trim(),
            url: anchor.href,
            meta: meta.replace(/\s+/g, " ").trim(),
          };
        }).filter((item) => item && item.title && item.url.includes("watch?v="));
        if (extracted.length) return extracted.slice(0, 80);
        return Array.from(document.querySelectorAll("a[href*='watch?v=']"))
          .map((a) => ({
            title: (a.getAttribute("title") || a.getAttribute("aria-label") || a.textContent || "").replace(/\s+/g, " ").trim(),
            url: a.href,
            meta: "",
          }))
          .filter((item) => item.title)
          .slice(0, 80);
      }));
      result.sections.push({ section, url, count: items.length });
      for (const item of items) {
        result.items.push({ platform: "YouTube", section, ...item });
      }
    } catch (error) {
      result.notes.push(`${section}: ${error.message}`);
    }
  }

  result.items = uniqueByUrl(result.items);
  result.status = result.items.length ? "visible_items_found" : "no_visible_items_or_login_required";
  return result;
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
    const result = {
      generated_at: new Date().toISOString(),
      browser: "Microsoft Edge Default profile",
      platforms: [],
    };

    result.platforms.push(await getBilibiliFavorites(page, context));
    result.platforms.push(await getDouyinFavorites(page));
    result.platforms.push(await getYouTubeFavorites(page));

    await fs.writeFile(outputPath, JSON.stringify(result, null, 2), "utf8");
    console.log(outputPath);
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
