import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = new URL("..", import.meta.url);
const MAX_GIT_OUTPUT_BYTES = 64 * 1024 * 1024;

export function parseChangedPaths(output) {
  return String(output || "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
}

async function gitOutput(root, args, encoding = "utf8") {
  const { stdout } = await execFileAsync("git", args, {
    cwd: root,
    encoding,
    maxBuffer: MAX_GIT_OUTPUT_BYTES,
    windowsHide: true,
  });
  return stdout;
}

export async function captureWorktree(root = ROOT) {
  const rootPath = root instanceof URL ? fileURLToPath(root) : root;
  const [diff, untrackedOutput, status] = await Promise.all([
    gitOutput(root, ["diff", "--binary", "--no-ext-diff", "HEAD", "--"], "buffer"),
    gitOutput(root, ["ls-files", "--others", "--exclude-standard", "-z"]),
    gitOutput(root, ["status", "--porcelain=v1", "--untracked-files=all"]),
  ]);
  const untracked = untrackedOutput.split("\0").filter(Boolean).sort();
  const hash = createHash("sha256").update(diff);

  for (const path of untracked) {
    hash.update("\0").update(path).update("\0").update(await readFile(resolve(rootPath, path)));
  }

  return {
    fingerprint: hash.digest("hex"),
    status: parseChangedPaths(status),
  };
}

async function runProductionBuild(root) {
  const npmCli = process.env.npm_execpath;
  const command = npmCli
    ? process.execPath
    : process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npm";
  const args = npmCli
    ? [npmCli, "run", "build"]
    : process.platform === "win32" ? ["/d", "/s", "/c", "npm run build"] : ["run", "build"];
  const result = await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit", windowsHide: true });
    child.once("error", reject);
    child.once("exit", (code, signal) => resolvePromise({ code, signal }));
  });

  if (result.code !== 0) {
    const reason = result.signal ? `signal ${result.signal}` : `exit code ${result.code}`;
    throw new Error(`Production build failed with ${reason}.`);
  }
}

export async function checkGeneratedArtifacts({ root = ROOT, build = runProductionBuild } = {}) {
  const before = await captureWorktree(root);
  await build(root);
  const after = await captureWorktree(root);

  if (before.fingerprint !== after.fingerprint) {
    throw new Error([
      "The production build changed the worktree.",
      "Review and commit every intended generated artifact:",
      ...after.status.map((line) => `  ${line}`),
    ].join("\n"));
  }

  console.log("Production build leaves the worktree unchanged.");
}

const isDirectExecution = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  checkGeneratedArtifacts().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
