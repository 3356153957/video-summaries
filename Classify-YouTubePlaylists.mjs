import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const edgeUserData = path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "User Data");

const assignments = [
  { title: "如何记单词", videoId: "JuoqE2lpRUM", playlist: "学习生活" },
  { title: "The first 20 hours -- how to learn anything | Josh Kaufman | TEDxCSU", videoId: "5MgBikgcWnY", playlist: "学习生活" },
  { title: "No Measuring! 2 Fast ways to Design Gridfinity Shadow Boxes", videoId: "fGtTYha84vc", playlist: "工程制造" },
  { title: "openclash新手教程系列附加篇、DNS泄露、openclash搭配Adguardhome、openclash远程访问、订阅失败、BT直连等问题解决", videoId: "5-eSqP-iNnc", playlist: "软件工具" },
  { title: "零基础保姆级小白节点搭建教学", videoId: "s90feRmdr9A", playlist: "软件工具" },
  { title: "ASMR mean girl does your makeup in school bathroom", videoId: "7dCWt36jwjE", playlist: "放松娱乐" },
];

async function main() {
  const context = await chromium.launchPersistentContext(edgeUserData, {
    executablePath: edgePath,
    headless: false,
    viewport: { width: 1440, height: 950 },
    args: ["--profile-directory=Default"],
  });
  const report = {
    created: [],
    added: [],
    failed: [],
  };

  try {
    const page = context.pages()[0] || await context.newPage();
    await page.goto("https://www.youtube.com/feed/playlists", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);
    const cookies = await context.cookies("https://www.youtube.com");
    const sapisid = cookies.find((cookie) => cookie.name === "SAPISID")?.value ||
      cookies.find((cookie) => cookie.name === "__Secure-1PAPISID")?.value ||
      cookies.find((cookie) => cookie.name === "__Secure-3PAPISID")?.value;
    if (!sapisid) throw new Error("YouTube SAPISID cookie not found.");
    const timestamp = Math.floor(Date.now() / 1000);
    const origin = "https://www.youtube.com";
    const hash = crypto.createHash("sha1").update(`${timestamp} ${sapisid} ${origin}`).digest("hex");
    const authorization = `SAPISIDHASH ${timestamp}_${hash}`;

    const result = await page.evaluate(async ({ assignments, authorization }) => {
      const apiKey = ytcfg.get("INNERTUBE_API_KEY");
      const context = ytcfg.get("INNERTUBE_CONTEXT");
      const clientVersion = ytcfg.get("INNERTUBE_CLIENT_VERSION");
      const sessionIndex = ytcfg.get("SESSION_INDEX") || "0";
      const out = { created: [], added: [], failed: [] };
      const headers = {
        "content-type": "application/json",
        "x-youtube-client-name": "1",
        "x-youtube-client-version": clientVersion,
        "x-goog-authuser": sessionIndex,
        "x-origin": "https://www.youtube.com",
        authorization,
      };

      async function call(endpoint, body) {
        const res = await fetch(`https://www.youtube.com/youtubei/v1/${endpoint}?key=${apiKey}`, {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify({ context, ...body }),
        });
        const text = await res.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch {
          json = { raw: text.slice(0, 500) };
        }
        if (!res.ok) {
          throw new Error(`${res.status} ${JSON.stringify(json).slice(0, 500)}`);
        }
        return json;
      }

      const byPlaylist = new Map();
      for (const item of assignments) {
        if (!byPlaylist.has(item.playlist)) byPlaylist.set(item.playlist, []);
        byPlaylist.get(item.playlist).push(item);
      }

      for (const [playlistTitle, items] of byPlaylist.entries()) {
        try {
          const create = await call("playlist/create", {
            title: playlistTitle,
            privacyStatus: "PRIVATE",
            videoIds: [items[0].videoId],
          });
          const playlistId = create.playlistId || create.id || create.playlist?.playlistId;
          if (!playlistId) throw new Error(`No playlist id in response: ${JSON.stringify(create).slice(0, 500)}`);
          out.created.push({ title: playlistTitle, playlistId });
          out.added.push({ playlist: playlistTitle, videoId: items[0].videoId, title: items[0].title, via: "create" });

          for (const item of items.slice(1)) {
            try {
              await call("browse/edit_playlist", {
                playlistId,
                actions: [{ action: "ACTION_ADD_VIDEO", addedVideoId: item.videoId }],
              });
              out.added.push({ playlist: playlistTitle, videoId: item.videoId, title: item.title, via: "edit" });
            } catch (error) {
              out.failed.push({ playlist: playlistTitle, videoId: item.videoId, title: item.title, error: error.message });
            }
          }
        } catch (error) {
          for (const item of items) {
            out.failed.push({ playlist: playlistTitle, videoId: item.videoId, title: item.title, error: error.message });
          }
        }
      }
      return out;
    }, { assignments, authorization });

    Object.assign(report, result);
  } finally {
    await context.close();
  }

  fs.writeFileSync("youtube-classification-report.json", JSON.stringify(report, null, 2), "utf8");
  let md = "# YouTube Classification Report\n\n";
  md += `- Created playlists: ${report.created.length}\n`;
  md += `- Added videos: ${report.added.length}\n`;
  md += `- Failed: ${report.failed.length}\n\n`;
  md += "## Created\n\n";
  for (const item of report.created) md += `- ${item.title}: ${item.playlistId}\n`;
  md += "\n## Added\n\n";
  for (const item of report.added) md += `- ${item.title} -> ${item.playlist}\n`;
  if (report.failed.length) {
    md += "\n## Failed\n\n";
    for (const item of report.failed) md += `- ${item.title} -> ${item.playlist}: ${item.error}\n`;
  }
  fs.writeFileSync("youtube-classification-report.md", md, "utf8");
  console.log("youtube-classification-report.md");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
