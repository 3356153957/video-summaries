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
  let out;
  try {
    const page = context.pages()[0] || await context.newPage();
    await page.goto("https://www.douyin.com/user/self?from_tab_name=main&showTab=favorite_collection", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(7000);
    await page.getByText("批量管理", { exact: true }).click({ timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.locator("input[type='checkbox']").nth(1).click({ force: true });
    await page.waitForTimeout(800);
    await page.getByText("加入收藏夹", { exact: true }).click({ timeout: 10000 });
    await page.waitForTimeout(1800);
    out = await page.evaluate(() => {
      const panels = Array.from(document.querySelectorAll(".modal-pannel"));
      const modal = panels[panels.length - 1];
      function bestText(el) {
        let cur = el;
        for (let depth = 0; depth < 7 && cur; depth++, cur = cur.parentElement) {
          const text = (cur.innerText || "").replace(/\s+/g, " ").trim();
          if (text && text.length < 160 && !text.includes("收藏视频到")) return text;
        }
        return "";
      }
      return Array.from(modal.querySelectorAll("input[type='checkbox']")).map((input, index) => {
        const rect = input.getBoundingClientRect();
        return {
          index,
          checked: input.checked,
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          text: bestText(input),
          outer: input.outerHTML.slice(0, 300),
        };
      });
    });
  } finally {
    await context.close();
  }
  fs.writeFileSync("douyin-folder-checkbox-map.json", JSON.stringify(out, null, 2), "utf8");
  console.log("douyin-folder-checkbox-map.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
