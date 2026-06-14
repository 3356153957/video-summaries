import { spawn } from "node:child_process";
import fs from "node:fs";

const prompt = fs.readFileSync("video-summary-gemini-json-prompt.md", "utf8");
const input = fs.readFileSync("video-summary-gemini-input.json", "utf8");
const stdinPayload = `${prompt}\n\n===== INPUT JSON =====\n${input}`;
const outputFile = "video-summary-gemini-output.json";
const rawFile = "video-summary-gemini-output.raw.txt";

console.log("Running Gemini CLI for structured video summaries...");
console.log(`Input: video-summary-gemini-input.json (${input.length} chars)`);
console.log(`Output: ${outputFile}`);

const args = [
  "--prompt",
  "Read the instructions and JSON from stdin. Output only valid JSON.",
  "--output-format",
  "text",
];
const child = process.platform === "win32"
  ? spawn("cmd.exe", ["/d", "/s", "/c", "gemini", ...args], {
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
    })
  : spawn("gemini", args, {
  stdio: ["pipe", "pipe", "pipe"],
  shell: false,
    });

let stdout = "";
let stderr = "";

child.stdout.on("data", (chunk) => {
  const text = chunk.toString("utf8");
  stdout += text;
});

child.stderr.on("data", (chunk) => {
  const text = chunk.toString("utf8");
  stderr += text;
  process.stderr.write(text);
});

child.stdin.on("error", (error) => {
  stderr += `stdin error: ${error.message}\n`;
});
child.stdin.end(stdinPayload);

child.on("close", (code) => {
  fs.writeFileSync(rawFile, stdout, "utf8");
  const match = stdout.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      fs.writeFileSync(outputFile, JSON.stringify(parsed, null, 2), "utf8");
      console.log(`Gemini stdout chars: ${stdout.length}`);
      console.log(`Wrote ${outputFile}`);
    } catch (error) {
      console.error(`\nJSON parse failed: ${error.message}`);
      console.error(`Raw output saved: ${rawFile}`);
    }
  } else {
    console.error(`\nNo JSON object found. Raw output saved: ${rawFile}`);
  }
  if (stderr) fs.writeFileSync("video-summary-gemini-output.stderr.txt", stderr, "utf8");
  process.exit(code ?? 0);
});
