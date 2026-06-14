import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const edgeUserData = path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "User Data");

async function dump(page, label) {
  return {
    label,
    url: page.url(),
    title: await page.title(),
    body: await page.evaluate(() => document.body.innerText.slice(0, 2500)),
    controls: await page.evaluate(() => Array.from(document.querySelectorAll("button,input,textarea,tp-yt-paper-button,yt-button-shape,[role='button']"))
      .map((el, i) => ({
        i,
        tag: el.tagName,
        type: el.getAttribute("type") || "",
        text: (el.textContent || el.getAttribute("placeholder") || el.getAttribute("aria-label") || el.getAttribute("title") || "").replace(/\s+/g, " ").trim(),
        visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
      }))
      .filter((x) => x.text || x.type)
      .slice(0, 200)),
  };
}

async function main() {
  const context = await chromium.launchPersistentContext(edgeUserData, {
    executablePath: edgePath,
    headless: false,
    viewport: { width: 1440, height: 950 },
    args: ["--profile-directory=Default"],
  });
  const out = [];
  try {
    const page = context.pages()[0] || await context.newPage();
    await page.goto("https://www.youtube.com/feed/playlists", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);
    out.push(await dump(page, "initial"));
    try {
      await page.getByText("创建", { exact: true }).first().click({ timeout: 10000 });
      await page.waitForTimeout(2000);
      out.push(await dump(page, "after-create"));
    } catch (error) {
      out.push({ label: "create-error", error: error.message });
    }
  } finally {
    await context.close();
  }
  fs.writeFileSync("youtube-create-playlist-inspect.json", JSON.stringify(out, null, 2), "utf8");
  console.log("youtube-create-playlist-inspect.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
