import fs from "node:fs";

const inputFiles = [
  "bilibili-favorite-migration-plan.json",
  "site-favorites.json",
  "bilibili-engineering-to-study-report.json",
];

const aiKeywords = [
  "AI",
  "ai",
  "AIGC",
  "Codex",
  "Agent",
  "Claude",
  "ChatGPT",
  "Gemini",
  "OpenAI",
  "Google AI",
  "人工智能",
  "大模型",
  "数字克隆",
  "智能体",
  "AI时代",
];

const excludeAuthorOnly = true;

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function loadJson(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function walk(value, out = []) {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, out);
    return out;
  }
  if (!value || typeof value !== "object") return out;
  if (value.title && (value.bvid || value.url || value.description || value.author)) out.push(value);
  for (const child of Object.values(value)) walk(child, out);
  return out;
}

function bvidFromItem(item) {
  if (item.bvid) return item.bvid;
  const match = String(item.url || "").match(/BV[0-9A-Za-z]+/);
  return match?.[0] || "";
}

function hasAiSignal(item) {
  const folderText = [
    item.targetFolderTitle,
    item.sourceFolderTitle,
    item.to,
    item.from,
    item.folder,
  ].join(" ");
  const contentText = [item.title, item.description].join(" ");
  const authorText = item.author || "";

  if (/AI工具|AI与|Codex/i.test(folderText)) return true;
  if (aiKeywords.some((keyword) => contentText.includes(keyword))) return true;
  if (!excludeAuthorOnly && aiKeywords.some((keyword) => authorText.includes(keyword))) return true;
  return false;
}

function collectLocalAiItems() {
  const byBvid = new Map();
  for (const file of inputFiles) {
    const data = loadJson(file);
    if (!data) continue;
    for (const item of walk(data)) {
      const bvid = bvidFromItem(item);
      if (!bvid || !hasAiSignal(item)) continue;
      const current = byBvid.get(bvid) || {};
      byBvid.set(bvid, {
        ...current,
        bvid,
        title: clean(current.title || item.title),
        author: clean(current.author || item.author),
        description: clean(current.description || item.description),
        folder: clean(current.folder || item.targetFolderTitle || item.to || item.sourceFolderTitle),
        url: item.url || current.url || `https://www.bilibili.com/video/${bvid}`,
      });
    }
  }
  return [...byBvid.values()];
}

async function biliJson(url, referer = "https://www.bilibili.com/") {
  const res = await fetch(url, {
    headers: {
      "accept": "application/json, text/plain, */*",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      "referer": referer,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149 Safari/537.36 Edg/149",
    },
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { code: -999, message: text.slice(0, 500) };
  }
}

async function getView(bvid) {
  const url = `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`;
  const data = await biliJson(url, `https://www.bilibili.com/video/${bvid}`);
  if (data.code !== 0) throw new Error(`view failed ${bvid}: ${data.code} ${data.message || ""}`);
  return data.data;
}

async function getPlayer(bvid, cid) {
  const url = `https://api.bilibili.com/x/player/v2?bvid=${encodeURIComponent(bvid)}&cid=${encodeURIComponent(cid)}`;
  const data = await biliJson(url, `https://www.bilibili.com/video/${bvid}`);
  if (data.code !== 0) return null;
  return data.data;
}

async function getSubtitleText(subtitleUrl, bvid) {
  let url = subtitleUrl || "";
  if (url.startsWith("//")) url = `https:${url}`;
  const data = await biliJson(url, `https://www.bilibili.com/video/${bvid}`);
  const body = data.body || [];
  return body.map((line) => clean(line.content)).filter(Boolean).join("\n");
}

function pickSubtitle(subtitles) {
  if (!Array.isArray(subtitles) || !subtitles.length) return null;
  return subtitles.find((item) => /中文|zh|ai/i.test([item.lan, item.lan_doc].join(" "))) || subtitles[0];
}

function summarizeTranscript(text) {
  if (!text) return "";
  const compact = clean(text);
  return compact.slice(0, 6000);
}

async function enrichItem(item) {
  const view = await getView(item.bvid);
  const page = view.pages?.[0] || {};
  const player = page.cid ? await getPlayer(item.bvid, page.cid) : null;
  const subtitle = pickSubtitle(player?.subtitle?.subtitles);
  let transcript = "";
  if (subtitle?.subtitle_url) {
    try {
      transcript = await getSubtitleText(subtitle.subtitle_url, item.bvid);
    } catch (error) {
      transcript = "";
    }
  }

  return {
    ...item,
    title: clean(view.title || item.title),
    author: clean(view.owner?.name || item.author),
    description: clean(view.desc || item.description),
    duration: view.duration,
    pubdate: view.pubdate,
    stat: view.stat || {},
    pages: (view.pages || []).map((p) => ({ cid: p.cid, page: p.page, part: p.part, duration: p.duration })),
    tag: view.tname || "",
    subtitle: subtitle ? { lan: subtitle.lan, lan_doc: subtitle.lan_doc, id: subtitle.id } : null,
    transcriptCharCount: transcript.length,
    transcriptSample: summarizeTranscript(transcript),
  };
}

function writeMarkdown(items) {
  let md = "# Bilibili AI Video Content Notes\n\n";
  md += `- Generated: ${new Date().toLocaleString("zh-CN", { hour12: false })}\n`;
  md += `- Videos: ${items.length}\n`;
  md += "- Scope: Bilibili favorites with AI/Codex/Agent/digital-clone signals.\n\n";

  for (const item of items) {
    md += `## ${item.title}\n\n`;
    md += `- UP: ${item.author || "unknown"}\n`;
    md += `- URL: ${item.url}\n`;
    md += `- Folder signal: ${item.folder || "unknown"}\n`;
    md += `- Public subtitle: ${item.transcriptCharCount ? `yes, ${item.transcriptCharCount} chars` : "not found"}\n`;
    if (item.description) md += `- Description: ${item.description.slice(0, 800)}\n`;
    if (item.transcriptSample) {
      md += "\n### Transcript Sample\n\n";
      md += `${item.transcriptSample.slice(0, 1800)}\n`;
    }
    md += "\n";
  }

  fs.writeFileSync("bilibili-ai-video-content-notes.md", md, "utf8");
}

async function main() {
  const localItems = collectLocalAiItems();
  const enriched = [];
  for (const item of localItems) {
    try {
      enriched.push(await enrichItem(item));
      console.log(`OK ${item.bvid} ${item.title}`);
    } catch (error) {
      enriched.push({ ...item, error: error.message });
      console.log(`FAILED ${item.bvid} ${error.message}`);
    }
  }

  fs.writeFileSync("bilibili-ai-video-content-notes.json", JSON.stringify(enriched, null, 2), "utf8");
  writeMarkdown(enriched);
  console.log(`WROTE bilibili-ai-video-content-notes.json items=${enriched.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
