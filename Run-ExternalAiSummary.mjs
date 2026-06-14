import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const noCache = args.has("--no-cache") || args.has("--force");
const requireSourceRefs = !args.has("--no-source-refs");
const schemaVersion = "external-ai-summary-v2";

function argValue(name, fallback) {
  const prefix = `${name}=`;
  const direct = process.argv.find((arg) => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

const providerMode = argValue("--provider", "auto");
const minItems = Number(argValue("--min-items", "0"));
const antigravityRetries = Number(argValue("--antigravity-retries", "1"));
const timeoutMs = Number(argValue("--timeout-ms", "600000"));

const config = {
  promptFile: argValue("--prompt-file", "video-summary-gemini-json-prompt.md"),
  inputFile: argValue("--input-file", "video-summary-gemini-input.json"),
  sanitizedInputFile: argValue("--sanitized-input-file", "video-summary-external-ai-input.sanitized.json"),
  outputJsonFile: argValue("--output-json", "video-summary-summary.json"),
  outputReportFile: argValue("--output-report", "video-summary-report.md"),
  rawFile: argValue("--raw-file", "video-summary-external-ai.raw.txt"),
  stderrFile: argValue("--stderr-file", "video-summary-external-ai.stderr.txt"),
  runMetaFile: argValue("--run-meta-file", "video-summary-external-ai-run.json"),
  cacheFile: argValue("--cache-file", "video-summary-external-ai-cache.json"),
};

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function resolveCommand(command) {
  const result = spawnSync(process.platform === "win32" ? "where.exe" : "which", [command], {
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) return "";
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
}

function redactSensitiveText(text) {
  const replacements = [];
  let redacted = text;
  const rules = [
    {
      label: "private_key_block",
      pattern: /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi,
      replace: "[REDACTED_PRIVATE_KEY]",
    },
    {
      label: "bearer_token",
      pattern: /Bearer\s+[A-Za-z0-9._~+/=-]{12,}/gi,
      replace: "Bearer [REDACTED]",
    },
    {
      label: "secret_assignment",
      pattern: /((?:api[_-]?key|access[_-]?key|secret|password|passwd|private[_-]?key|proxy_access_key|authorization|cookie|sapisid|bili_jct)\s*[:=]\s*)(["']?)[^\s"',;}]+/gi,
      replace: "$1$2[REDACTED]",
    },
    {
      label: "json_secret_field",
      pattern: /("(?:api[_-]?key|access[_-]?key|secret|password|passwd|private[_-]?key|authorization|cookie|sapisid|bili_jct)"\s*:\s*")([^"]+)(")/gi,
      replace: '$1[REDACTED]$3',
    },
  ];

  for (const rule of rules) {
    let count = 0;
    redacted = redacted.replace(rule.pattern, (...match) => {
      count += 1;
      const replacement = typeof rule.replace === "function" ? rule.replace(...match) : rule.replace;
      return replacement.replace(/\$(\d)/g, (_, index) => match[Number(index)] || "");
    });
    if (count) replacements.push({ label: rule.label, count });
  }
  return { text: redacted, replacements };
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced ? fenced[1] : text;
  const first = source.indexOf("{");
  const last = source.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("No JSON object found");
  return JSON.parse(source.slice(first, last + 1));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateStringArray(value, label, errors, options = {}) {
  if (!Array.isArray(value)) {
    if (options.required) errors.push(`${label} must be an array`);
    return;
  }
  if (options.nonEmpty && value.length === 0) errors.push(`${label} must not be empty`);
  value.forEach((item, index) => {
    if (typeof item !== "string") errors.push(`${label}[${index}] must be a string`);
  });
}

function hasPreciseAnchor(ref) {
  if (typeof ref !== "string") return false;
  const text = ref.trim();
  return (
    /:[Ll]\d+(?:-\d+)?\b/.test(text) ||
    /\[\d{1,2}:\d{2}(?::\d{2})?\]/.test(text) ||
    /\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(text) ||
    /(?:^|[:;,\s])(?:id|source_id|item_id)=\S+/i.test(text) ||
    /(?:^|[:;,\s])(?:BVID|BV)=BV[0-9A-Za-z]+/i.test(text)
  );
}

function createContract(promptText) {
  return {
    expectsItems: /"items"\s*:\s*\[/.test(promptText),
    itemRequiresKeyPoints: /"key_points"\s*:/.test(promptText),
    requireSourceRefs,
  };
}

function buildContractInstruction(contract, inputPath) {
  const lines = [
    "",
    "额外硬性输出契约：",
    "- 输出必须是一个合法 JSON 对象，不要 Markdown，不要解释性前后缀。",
    "- 如果 schema 声明了 items，根对象必须包含 items 数组；不要只输出单个 item。",
    "- 每个 item 必须包含非空 summary。",
  ];
  if (contract.itemRequiresKeyPoints) {
    lines.push("- 每个 item 必须包含 key_points 字符串数组。");
  }
  if (contract.requireSourceRefs) {
    const fileName = path.basename(inputPath);
    lines.push(
      "- 每个 item 必须包含 source_refs 字符串数组。",
      `- source_refs 必须是精准锚点，例如 "${fileName}:id=Douyin-71"、"${fileName}:source_id=BV1xxxx"、"transcript.txt:L200-250" 或 "video.srt:[12:30]"。`,
      "- 只能基于标题判断时，也要用输入条目的 id/source_id/url 作为锚点，不要留空。"
    );
  }
  return lines.join("\n");
}

function validateSummaryNode(node, label, contract, errors) {
  if (!isPlainObject(node)) {
    errors.push(`${label} must be an object`);
    return;
  }
  if (!isNonEmptyString(node.summary)) {
    errors.push(`${label}.summary must be a non-empty string`);
  }
  if (contract.itemRequiresKeyPoints || Object.hasOwn(node, "key_points")) {
    validateStringArray(node.key_points, `${label}.key_points`, errors, { required: true, nonEmpty: contract.itemRequiresKeyPoints });
  }
  for (const field of ["tools", "actions", "risks"]) {
    if (Object.hasOwn(node, field)) validateStringArray(node[field], `${label}.${field}`, errors);
  }
  if (Object.hasOwn(node, "confidence") && !["high", "medium", "low", "高", "中", "低"].includes(node.confidence)) {
    errors.push(`${label}.confidence must be high/medium/low or 高/中/低`);
  }
  if (contract.requireSourceRefs) {
    validateStringArray(node.source_refs, `${label}.source_refs`, errors, { required: true, nonEmpty: true });
    if (Array.isArray(node.source_refs)) {
      node.source_refs.forEach((ref, index) => {
        if (!hasPreciseAnchor(ref)) errors.push(`${label}.source_refs[${index}] lacks a precise anchor`);
      });
    }
  }
}

function validateParsedOutput(parsed, contract) {
  const errors = [];
  if (!isPlainObject(parsed)) {
    throw new Error("Schema validation failed: root must be an object");
  }

  if (contract.expectsItems || Array.isArray(parsed.items)) {
    if (!Array.isArray(parsed.items)) {
      errors.push("root.items must be an array");
    } else {
      if (minItems && parsed.items.length < minItems) {
        errors.push(`Expected at least ${minItems} items, got ${parsed.items.length}`);
      }
      parsed.items.forEach((item, index) => validateSummaryNode(item, `items[${index}]`, contract, errors));
    }
  } else {
    validateSummaryNode(parsed, "root", contract, errors);
  }

  if (errors.length) {
    const suffix = errors.length > 8 ? `; ... ${errors.length - 8} more` : "";
    throw new Error(`Schema validation failed: ${errors.slice(0, 8).join("; ")}${suffix}`);
  }
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let timedOut = false;
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
      ...options,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      stderr += text;
      process.stderr.write(text);
    });
    const timer = setTimeout(() => {
      timedOut = true;
      stderr += `process timeout after ${options.timeoutMs ?? timeoutMs} ms\n`;
      child.kill("SIGTERM");
    }, options.timeoutMs ?? timeoutMs);
    child.on("error", (error) => {
      stderr += `process error: ${error.message}\n`;
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        resolve({ code: 1, stdout, stderr, error, timed_out: timedOut });
      }
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        resolve({ code: timedOut ? 124 : code ?? 0, stdout, stderr, timed_out: timedOut });
      }
    });
    if (options.stdin) child.stdin.end(options.stdin);
    else child.stdin.end();
  });
}

async function runAntigravity(promptPath, inputPath, contractInstruction) {
  const wrapper = resolveCommand("agy-print.ps1");
  const agy = resolveCommand("agy");
  if (!wrapper && !agy) throw new Error("Antigravity CLI not found");

  const prompt = [
    "你是外部高吞吐摘要 CLI。请只读取下面列出的已脱敏文件，不要读取原始未脱敏输入。",
    "不要修改任何文件。不要处理或复述任何明文密钥、token、cookie、密码、私钥、支付信息。",
    `说明文件：${path.resolve(promptPath)}`,
    `输入文件：${path.resolve(inputPath)}`,
    "请遵守说明文件里的 schema，输出只包含一个合法 JSON 对象，不要 Markdown 前后缀。",
    contractInstruction,
  ].join("\n");

  if (process.platform === "win32" && wrapper) {
    return runProcess("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      wrapper,
      prompt,
    ]);
  }

  return runProcess(agy, ["--print", prompt]);
}

async function runGemini(promptText, inputText, contractInstruction) {
  const gemini = resolveCommand(process.platform === "win32" ? "gemini.cmd" : "gemini") || resolveCommand("gemini");
  if (!gemini) throw new Error("Gemini CLI not found");

  const stdin = `${promptText}\n${contractInstruction}\n\n===== INPUT JSON =====\n${inputText}`;
  const cliArgs = [
    "--prompt",
    "Read the instructions and JSON from stdin. Output only valid JSON.",
    "--output-format",
    "text",
  ];

  if (process.platform === "win32") {
    return runProcess("cmd.exe", ["/d", "/s", "/c", "gemini", ...cliArgs], { stdin });
  }
  return runProcess(gemini, cliArgs, { stdin });
}

function isRetryableReason(reason) {
  return /timeout|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket|network|stdout empty|No JSON object found/i.test(reason);
}

function readCache(cacheKey, contract) {
  if (noCache || !fs.existsSync(config.cacheFile)) return null;
  try {
    const cache = JSON.parse(fs.readFileSync(config.cacheFile, "utf8"));
    if (cache.cache_key !== cacheKey || !cache.output_json) return null;
    validateParsedOutput(cache.output_json, contract);
    return cache;
  } catch (error) {
    console.error(`缓存不可用，继续调用外部 CLI：${error.message}`);
    return null;
  }
}

function writeCache(cacheKey, parsed, provider) {
  const cache = {
    cache_key: cacheKey,
    schema_version: schemaVersion,
    created_at: new Date().toISOString(),
    provider,
    prompt_file: config.promptFile,
    input_file: config.inputFile,
    output_json: parsed,
  };
  fs.writeFileSync(config.cacheFile, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

function writeFailureReport(meta) {
  const lines = [
    "# 外部 AI 摘要失败报告",
    "",
    `日期：${new Date().toISOString()}`,
    "",
    "## 结果",
    "",
    "Antigravity CLI 与 Gemini CLI 均未生成可解析 JSON。",
    "",
    "## 尝试记录",
    "",
    ...meta.attempts.map((item) => `- ${item.provider}: ${item.ok ? "成功" : "失败"}；${item.reason || "无错误信息"}`),
    "",
    "## 文件",
    "",
    `- 原始输出：${config.rawFile}`,
    `- stderr：${config.stderrFile}`,
    `- 运行元数据：${config.runMetaFile}`,
  ];
  fs.writeFileSync(config.outputReportFile, `${lines.join(os.EOL)}${os.EOL}`, "utf8");
}

const promptText = fs.readFileSync(config.promptFile, "utf8");
const inputText = fs.readFileSync(config.inputFile, "utf8");
const sanitized = redactSensitiveText(inputText);
fs.writeFileSync(config.sanitizedInputFile, sanitized.text, "utf8");
const contract = createContract(promptText);
const contractInstruction = buildContractInstruction(contract, config.sanitizedInputFile);
const cacheKey = sha256(JSON.stringify({
  schema_version: schemaVersion,
  prompt_text: promptText,
  sanitized_input: sanitized.text,
  provider_mode: providerMode,
  min_items: minItems,
  require_source_refs: requireSourceRefs,
  expects_items: contract.expectsItems,
  item_requires_key_points: contract.itemRequiresKeyPoints,
}));

const meta = {
  generated_at: new Date().toISOString(),
  preferred_provider: providerMode === "auto" ? "antigravity" : providerMode,
  fallback_provider: "gemini",
  prompt_file: config.promptFile,
  input_file: config.inputFile,
  sanitized_input_file: config.sanitizedInputFile,
  output_json_file: config.outputJsonFile,
  schema_version: schemaVersion,
  cache_key: cacheKey,
  cache_file: config.cacheFile,
  require_source_refs: requireSourceRefs,
  antigravity_retries: antigravityRetries,
  timeout_ms: timeoutMs,
  redactions: sanitized.replacements,
  attempts: [],
};

console.log("外部 AI 兼容层：优先 Antigravity CLI，失败回退 Gemini CLI。");
console.log(`输入范围：${config.inputFile} (${inputText.length} chars)，已写入脱敏副本 ${config.sanitizedInputFile}`);
console.log(`输出文件：${config.outputJsonFile}；失败报告：${config.outputReportFile}`);
console.log(`契约校验：schema=${schemaVersion}，source_refs=${requireSourceRefs ? "required" : "optional"}，cache=${noCache ? "disabled" : config.cacheFile}`);
if (sanitized.replacements.length) {
  console.log(`敏感内容保护：已脱敏 ${sanitized.replacements.map((item) => `${item.label}=${item.count}`).join(", ")}`);
}

if (dryRun) {
  console.log(`Antigravity wrapper: ${resolveCommand("agy-print.ps1") || "not found"}`);
  console.log(`Antigravity CLI: ${resolveCommand("agy") || "not found"}`);
  console.log(`Gemini CLI: ${resolveCommand(process.platform === "win32" ? "gemini.cmd" : "gemini") || resolveCommand("gemini") || "not found"}`);
  console.log(`cache key: ${cacheKey}`);
  console.log("dry-run：只检测配置和生成脱敏输入，不调用外部 CLI。");
  process.exit(0);
}

const cached = readCache(cacheKey, contract);
if (cached) {
  fs.writeFileSync(config.outputJsonFile, `${JSON.stringify(cached.output_json, null, 2)}\n`, "utf8");
  meta.ok = true;
  meta.provider = cached.provider || "cache";
  meta.cache_hit = true;
  meta.output_type = "summary.json";
  meta.attempts.push({ provider: "cache", ok: true, created_at: cached.created_at || "" });
  fs.writeFileSync(config.runMetaFile, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  console.log(`缓存命中：已复用 ${config.cacheFile}，未调用外部 CLI。`);
  console.log(`已生成：${config.outputJsonFile}, ${config.runMetaFile}`);
  process.exit(0);
}

let selected = null;
let selectedParsed = null;
let combinedRaw = "";
let combinedStderr = "";

const providers = providerMode === "gemini"
  ? ["gemini"]
  : providerMode === "antigravity"
    ? ["antigravity"]
    : ["antigravity", "gemini"];

for (const provider of providers) {
  console.log(`\n准备调用 ${provider === "antigravity" ? "Antigravity CLI" : "Gemini CLI"}...`);
  const maxAttempts = provider === "antigravity" ? Math.max(1, antigravityRetries + 1) : 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let result;
    try {
      result = provider === "antigravity"
        ? await runAntigravity(config.promptFile, config.sanitizedInputFile, contractInstruction)
        : await runGemini(promptText, sanitized.text, contractInstruction);
    } catch (error) {
      const reason = error.message;
      meta.attempts.push({ provider, attempt, ok: false, reason });
      console.error(`${provider} unavailable: ${reason}`);
      break;
    }

    combinedRaw += `\n===== ${provider.toUpperCase()} ATTEMPT ${attempt} STDOUT =====\n${result.stdout}`;
    combinedStderr += `\n===== ${provider.toUpperCase()} ATTEMPT ${attempt} STDERR =====\n${result.stderr}`;

    if (result.code !== 0) {
      const reason = result.timed_out ? `timeout after ${timeoutMs} ms` : `exit code ${result.code}`;
      meta.attempts.push({ provider, attempt, ok: false, reason, stdout_chars: result.stdout.length });
      console.error(`${provider} failed: ${reason}`);
      if (provider === "antigravity" && attempt < maxAttempts && isRetryableReason(`${reason}\n${result.stderr}`)) {
        console.error(`${provider} retrying once after recoverable failure...`);
        continue;
      }
      break;
    }

    try {
      const parsed = extractJson(result.stdout);
      validateParsedOutput(parsed, contract);
      fs.writeFileSync(config.outputJsonFile, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
      if (provider === "gemini") {
        fs.writeFileSync("video-summary-gemini-output.json", `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
      } else {
        fs.writeFileSync("video-summary-antigravity-output.json", `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
      }
      selected = provider;
      selectedParsed = parsed;
      meta.attempts.push({ provider, attempt, ok: true, stdout_chars: result.stdout.length });
      break;
    } catch (error) {
      const reason = error.message;
      meta.attempts.push({ provider, attempt, ok: false, reason, stdout_chars: result.stdout.length });
      console.error(`${provider} output rejected: ${reason}`);
      if (provider === "antigravity" && attempt < maxAttempts && isRetryableReason(reason)) {
        console.error(`${provider} retrying once after recoverable output failure...`);
        continue;
      }
      break;
    }
  }
  if (selected) {
    break;
  }
}

fs.writeFileSync(config.rawFile, combinedRaw.trimStart(), "utf8");
fs.writeFileSync(config.stderrFile, combinedStderr.trimStart(), "utf8");

if (!selected) {
  meta.ok = false;
  writeFailureReport(meta);
  fs.writeFileSync(config.runMetaFile, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  console.error(`外部 AI 摘要失败，已写入 ${config.outputReportFile}`);
  process.exit(1);
}

meta.ok = true;
meta.provider = selected;
meta.cache_hit = false;
meta.output_type = "summary.json";
writeCache(cacheKey, selectedParsed, selected);
fs.writeFileSync(config.runMetaFile, `${JSON.stringify(meta, null, 2)}\n`, "utf8");

console.log(`\n外部 AI 摘要成功：${selected}`);
console.log(`已生成：${config.outputJsonFile}, ${config.rawFile}, ${config.stderrFile}, ${config.runMetaFile}, ${config.cacheFile}`);
console.log("请由 Codex 读取 summary.json/短报告进行本地落地、校验和最终交付。");
