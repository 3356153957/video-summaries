import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const edgeUserData = path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "User Data");

const categories = [
  {
    folder: "AI与Codex工具",
    keywords: ["codex", "claude", "ai", "agent", "github", "deepseek", "vibecoding", "大模型", "编程", "代码", "自动化", "工作流", "插件"],
  },
  {
    folder: "CAD建模3D打印",
    keywords: ["solidworks", "3d打印", "makerworld", "机械", "建模", "减速器", "出图", "标注", "三旋翼"],
  },
  {
    folder: "健身健康",
    keywords: ["拉伸", "肩胛", "健身", "肌肉", "心率", "健康", "训练", "拍照姿势"],
  },
  {
    folder: "哲学人文",
    keywords: ["哲学", "人权", "心理学", "人生", "解构主义", "历史", "左宗棠"],
  },
  {
    folder: "情感生活",
    keywords: ["情感", "恋爱", "女朋友", "相亲", "青春", "生活", "母亲", "父亲"],
  },
  {
    folder: "游戏攻略",
    keywords: ["游戏", "三角洲", "apex", "steam", "epic", "天国拯救", "攻略", "switch"],
  },
  {
    folder: "模板素材",
    keywords: ["模板", "素材", "photoshop", "ps教程", "抠图", "改字", "剪辑"],
  },
];

function classify(text) {
  const lower = text.toLowerCase();

  const hasAiSignal = ["codex", "claude", "ai", "agent", "deepseek", "vibecoding", "大模型", "ai工具", "ai编程"].some((keyword) =>
    lower.includes(keyword.toLowerCase())
  );
  const hasModelingSignal = ["cad", "solidworks", "3d打印", "makerworld", "建模", "机械", "出图", "标注", "fusion360", "blender"].some((keyword) =>
    lower.includes(keyword.toLowerCase())
  );
  if (hasAiSignal && hasModelingSignal) return "AI与Codex工具";

  let best = null;
  let bestScore = 0;
  for (const category of categories) {
    let score = 0;
    for (const keyword of category.keywords) {
      if (lower.includes(keyword.toLowerCase())) score += keyword.length > 4 ? 2 : 1;
    }
    if (score > bestScore) {
      best = category.folder;
      bestScore = score;
    }
  }
  return best;
}

async function enterBatch(page) {
  await page.goto("https://www.douyin.com/user/self?from_tab_name=main&showTab=favorite_collection", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(7000);
  await page.getByText("批量管理", { exact: true }).click({ timeout: 10000 });
  await page.waitForTimeout(1500);
}

async function getItems(page) {
  return await page.evaluate(() => {
    function bestText(el) {
      let cur = el;
      for (let depth = 0; depth < 8 && cur; depth++, cur = cur.parentElement) {
        const text = (cur.innerText || "").replace(/\s+/g, " ").trim();
        if (text.length > 20 && text.length < 700 && !text.includes("退出管理") && !text.includes("全选")) return text;
      }
      return "";
    }
    return Array.from(document.querySelectorAll("input[type='checkbox']"))
      .map((input, index) => ({ index, text: bestText(input) }))
      .filter((item) => item.index > 0 && item.text);
  });
}

async function clickFolderInModal(page, folder) {
  const clicked = await page.evaluate((folder) => {
    const panels = Array.from(document.querySelectorAll(".modal-pannel"));
    const modal = panels[panels.length - 1];
    if (!modal) return false;
    function bestText(el) {
      let cur = el;
      for (let depth = 0; depth < 7 && cur; depth++, cur = cur.parentElement) {
        const text = (cur.innerText || "").replace(/\s+/g, " ").trim();
        if (text && text.length < 160 && !text.includes("收藏视频到")) return text;
      }
      return "";
    }
    for (const input of modal.querySelectorAll("input[type='checkbox']")) {
      if (bestText(input).startsWith(folder)) {
        input.click();
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
    }
    return false;
  }, folder);
  if (!clicked) throw new Error(`Folder checkbox not found: ${folder}`);
  await page.waitForTimeout(800);
  await page.getByText("确定", { exact: true }).last().click({ timeout: 10000 });
  await page.waitForTimeout(2500);
}

async function main() {
  const context = await chromium.launchPersistentContext(edgeUserData, {
    executablePath: edgePath,
    headless: false,
    viewport: { width: 1440, height: 950 },
    args: ["--profile-directory=Default"],
  });

  const report = { planned: {}, added: [], failed: [], skipped: [] };
  try {
    const page = context.pages()[0] || await context.newPage();
    await enterBatch(page);
    const items = await getItems(page);
    const groups = new Map();
    for (const item of items) {
      const folder = classify(item.text);
      if (!folder) {
        report.skipped.push(item);
        continue;
      }
      if (!groups.has(folder)) groups.set(folder, []);
      groups.get(folder).push(item);
    }
    for (const [folder, list] of groups.entries()) report.planned[folder] = list.length;

    for (const [folder, list] of groups.entries()) {
      try {
        await enterBatch(page);
        const checkboxes = page.locator("input[type='checkbox']");
        for (const item of list) {
          await checkboxes.nth(item.index).click({ force: true });
          await page.waitForTimeout(80);
        }
        await page.getByText("加入收藏夹", { exact: true }).click({ timeout: 10000 });
        await page.waitForTimeout(1800);
        await clickFolderInModal(page, folder);
        report.added.push({ folder, count: list.length, titles: list.map((item) => item.text.slice(0, 120)) });
      } catch (error) {
        report.failed.push({ folder, count: list.length, error: error.message });
      }
    }
  } finally {
    await context.close();
  }

  fs.writeFileSync("douyin-classification-report.json", JSON.stringify(report, null, 2), "utf8");
  let md = "# Douyin Classification Report\n\n";
  md += "## Planned\n\n";
  for (const [folder, count] of Object.entries(report.planned)) md += `- ${folder}: ${count}\n`;
  md += "\n## Added\n\n";
  for (const item of report.added) md += `- ${item.folder}: ${item.count}\n`;
  if (report.failed.length) {
    md += "\n## Failed\n\n";
    for (const item of report.failed) md += `- ${item.folder}: ${item.count} - ${item.error}\n`;
  }
  md += `\n## Skipped\n\n- ${report.skipped.length} items did not match the folder rules.\n`;
  fs.writeFileSync("douyin-classification-report.md", md, "utf8");
  console.log("douyin-classification-report.md");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
