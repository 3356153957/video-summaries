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
  const responses = [];
  try {
    const page = context.pages()[0] || await context.newPage();
    page.on("response", async (response) => {
      const url = response.url();
      if (!/douyin\.com|amemv\.com|snssdk\.com|iesdouyin/.test(url)) return;
      if (!/favorite|collect|aweme|folder|mix|user|tab|post|like/i.test(url)) return;
      responses.push({
        status: response.status(),
        url,
        contentType: response.headers()["content-type"] || "",
      });
    });
    await page.goto("https://www.douyin.com/user/self?from_tab_name=main&showTab=favorite_collection", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(12000);
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(5000);
    const state = await page.evaluate(() => {
      const keys = Object.keys(window).filter((key) => /state|store|redux|douyin|RENDER|INITIAL|router/i.test(key));
      return {
        url: location.href,
        title: document.title,
        keys: keys.slice(0, 100),
        bodyText: document.body.innerText.slice(0, 4000),
      };
    });
    fs.writeFileSync("douyin-api-inspect.json", JSON.stringify({ state, responses }, null, 2), "utf8");
    console.log("douyin-api-inspect.json");
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
