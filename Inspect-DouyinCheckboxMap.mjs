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
    out = await page.evaluate(() => {
      function bestText(el) {
        let cur = el;
        for (let depth = 0; depth < 8 && cur; depth++, cur = cur.parentElement) {
          const text = (cur.innerText || "").replace(/\s+/g, " ").trim();
          if (text.length > 20 && text.length < 700 && !text.includes("退出管理") && !text.includes("全选")) return text;
        }
        return "";
      }
      return Array.from(document.querySelectorAll("input[type='checkbox']")).map((input, index) => {
        const rect = input.getBoundingClientRect();
        return {
          index,
          checked: input.checked,
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          text: bestText(input),
        };
      });
    });
  } finally {
    await context.close();
  }
  fs.writeFileSync("douyin-checkbox-map.json", JSON.stringify(out, null, 2), "utf8");
  console.log("douyin-checkbox-map.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
