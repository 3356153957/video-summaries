import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const edgeUserData = path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "User Data");

async function dump(page, label) {
  return {
    label,
    body: await page.evaluate(() => document.body.innerText.slice(0, 3000)),
    controls: await page.evaluate(() => Array.from(document.querySelectorAll("button,input,textarea,[role='button'],[class*='modal'],[class*='dialog']"))
      .map((el, i) => ({
        i,
        tag: el.tagName,
        type: el.getAttribute("type") || "",
        text: (el.textContent || el.getAttribute("placeholder") || el.getAttribute("aria-label") || el.getAttribute("title") || "").replace(/\s+/g, " ").trim(),
        visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
        cls: el.className?.toString?.().slice(0, 140) || "",
      }))
      .filter((x) => x.text || x.type || x.cls)
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
    await page.goto("https://www.douyin.com/user/self?from_tab_name=main&showTab=favorite_collection", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(7000);
    await page.getByText("批量管理", { exact: true }).click({ timeout: 10000 });
    await page.waitForTimeout(1500);
    out.push(await dump(page, "batch"));

    const checkboxes = page.locator("input[type='checkbox']");
    const count = await checkboxes.count();
    if (count > 1) {
      await checkboxes.nth(1).click({ force: true });
      await page.waitForTimeout(1000);
      out.push(await dump(page, "selected-one"));
      await page.getByText("加入收藏夹", { exact: true }).click({ timeout: 10000 });
      await page.waitForTimeout(2000);
      out.push(await dump(page, "after-add-folder"));
    } else {
      out.push({ label: "no-checkboxes", count });
    }
  } finally {
    await context.close();
  }
  fs.writeFileSync("douyin-add-folder-modal-inspect.json", JSON.stringify(out, null, 2), "utf8");
  console.log("douyin-add-folder-modal-inspect.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
