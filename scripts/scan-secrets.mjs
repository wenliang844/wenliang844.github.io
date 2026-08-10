import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = resolveRoot();
const TEXT_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".md", ".mjs", ".toml", ".txt", ".xml", ".yaml", ".yml"]);
const PATTERNS = [
  { name: "AWS access key", pattern: new RegExp("AK" + "IA[0-9A-Z]{16}", "g") },
  { name: "GitHub token", pattern: new RegExp("gh" + "[pousr]_[A-Za-z0-9]{30,}", "g") },
  { name: "OpenAI-style key", pattern: new RegExp("sk" + "-[A-Za-z0-9_-]{20,}", "g") },
  { name: "private key", pattern: new RegExp("BEGIN (?:RSA |EC |OPENSSH )?PRIVATE " + "KEY", "g") },
];

function resolveRoot() {
  return join(import.meta.dirname, "..");
}

const { stdout } = await execFileAsync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: ROOT, encoding: "buffer" });
const files = stdout.toString("utf8").split("\0").filter(Boolean);
const findings = [];

for (const file of files) {
  if (!TEXT_EXTENSIONS.has(extname(file).toLowerCase()) || file === "scripts/scan-secrets.mjs") continue;
  const fullPath = join(ROOT, file);
  const info = await stat(fullPath);
  if (info.size > 2_000_000) continue;
  const content = await readFile(fullPath, "utf8");
  for (const { name, pattern } of PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      findings.push(`${file}:${line} ${name}`);
    }
  }
}

if (findings.length) {
  console.error("Potential secrets detected:\n" + findings.map((item) => `  - ${item}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Secret scan passed: ${files.length} tracked and untracked files checked.`);
}
