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
  const captures = [];
  try {
    const page = context.pages()[0] || await context.newPage();
    page.on("response", async (response) => {
      const url = response.url();
      if (!/aweme\/v1\/web\/aweme\/(listcollection|favorite)/.test(url)) return;
      try {
        const json = await response.json();
        captures.push({ status: response.status(), url, json });
      } catch (error) {
        captures.push({ status: response.status(), url, error: error.message });
      }
    });
    await page.goto("https://www.douyin.com/user/self?from_tab_name=main&showTab=favorite_collection", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(10000);
    await page.mouse.wheel(0, 2500);
    await page.waitForTimeout(4000);
    await page.mouse.wheel(0, 2500);
    await page.waitForTimeout(4000);
  } finally {
    await context.close();
  }
  fs.writeFileSync("douyin-collection-api-bodies.json", JSON.stringify(captures, null, 2), "utf8");
  console.log("douyin-collection-api-bodies.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
