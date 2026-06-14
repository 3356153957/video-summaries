import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const edgeUserData = path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "User Data");
const url = "https://www.youtube.com/watch?v=JuoqE2lpRUM";

async function dump(page, label) {
  return {
    label,
    body: await page.evaluate(() => document.body.innerText.slice(0, 3000)),
    controls: await page.evaluate(() => Array.from(document.querySelectorAll("button,input,textarea,tp-yt-paper-button,yt-button-shape,ytd-button-renderer,[role='button']"))
      .map((el, i) => ({
        i,
        tag: el.tagName,
        type: el.getAttribute("type") || "",
        text: (el.textContent || el.getAttribute("placeholder") || el.getAttribute("aria-label") || el.getAttribute("title") || "").replace(/\s+/g, " ").trim(),
        visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
      }))
      .filter((x) => x.text || x.type)
      .slice(0, 260)),
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
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(7000);
    out.push(await dump(page, "initial"));
    const candidates = ["保存", "Save", "保存到播放列表"];
    for (const text of candidates) {
      try {
        const loc = page.getByText(text, { exact: true }).first();
        if (await loc.count()) {
          await loc.click({ timeout: 5000 });
          await page.waitForTimeout(2500);
          out.push(await dump(page, `after-${text}`));
          break;
        }
      } catch {}
    }
  } finally {
    await context.close();
  }
  fs.writeFileSync("youtube-save-modal-inspect.json", JSON.stringify(out, null, 2), "utf8");
  console.log("youtube-save-modal-inspect.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
