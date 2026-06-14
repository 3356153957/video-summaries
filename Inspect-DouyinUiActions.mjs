import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const edgeUserData = path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "User Data");

async function dump(page, label) {
  const data = await page.evaluate(() => {
    const texts = Array.from(document.querySelectorAll("button,[role='button'],input,textarea,[class*='modal'],[class*='dialog']"))
      .map((el) => ({
        tag: el.tagName,
        text: (el.textContent || el.getAttribute("placeholder") || el.getAttribute("aria-label") || el.getAttribute("title") || "").replace(/\s+/g, " ").trim(),
        type: el.getAttribute("type") || "",
        cls: el.className?.toString?.().slice(0, 120) || "",
      }))
      .filter((x) => x.text || x.type || x.cls)
      .slice(0, 220);
    return {
      url: location.href,
      title: document.title,
      body: document.body.innerText.slice(0, 2500),
      texts,
    };
  });
  return { label, ...data };
}

async function clickByText(page, text) {
  const locator = page.getByText(text, { exact: true }).first();
  await locator.click({ timeout: 8000 });
  await page.waitForTimeout(2500);
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
    out.push(await dump(page, "initial"));

    try {
      await clickByText(page, "新建收藏夹");
      out.push(await dump(page, "after-new-folder"));
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1000);
    } catch (error) {
      out.push({ label: "new-folder-error", error: error.message });
    }

    try {
      await clickByText(page, "批量管理");
      out.push(await dump(page, "after-batch-manage"));
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1000);
    } catch (error) {
      out.push({ label: "batch-manage-error", error: error.message });
    }
  } finally {
    await context.close();
  }
  fs.writeFileSync("douyin-ui-actions-inspect.json", JSON.stringify(out, null, 2), "utf8");
  console.log("douyin-ui-actions-inspect.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
