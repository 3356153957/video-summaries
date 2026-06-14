import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const edgeUserData = path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "User Data");

async function main() {
  const context = await chromium.launchPersistentContext(edgeUserData, {
    executablePath: edgePath,
    headless: false,
    viewport: { width: 1440, height: 950 },
    args: ["--profile-directory=Default"],
  });
  let result;
  try {
    const page = context.pages()[0] || await context.newPage();
    await page.goto("https://www.youtube.com/feed/playlists", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);
    result = await page.evaluate(() => {
      const ytcfgObj = globalThis.ytcfg;
      const get = (key) => ytcfgObj?.get?.(key);
      return {
        url: location.href,
        title: document.title,
        hasYtcfg: !!ytcfgObj,
        apiKey: get("INNERTUBE_API_KEY"),
        clientName: get("INNERTUBE_CLIENT_NAME"),
        clientVersion: get("INNERTUBE_CLIENT_VERSION"),
        context: get("INNERTUBE_CONTEXT"),
        loggedIn: get("LOGGED_IN"),
        delegatedSessionId: get("DELEGATED_SESSION_ID"),
        sessionIndex: get("SESSION_INDEX"),
      };
    });
  } finally {
    await context.close();
  }
  fs.writeFileSync("youtube-innertube-inspect.json", JSON.stringify(result, null, 2), "utf8");
  console.log("youtube-innertube-inspect.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
