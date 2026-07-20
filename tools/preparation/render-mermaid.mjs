#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const docs = path.resolve(process.env.ENVFORGE_MERMAID_DOCS_ROOT || path.join(root, "docs"));
const outputRoot = path.resolve(process.env.ENVFORGE_MERMAID_OUTPUT_ROOT || path.join(root, "artifacts/generated/preparation/mermaid"));
const evidencePath = path.resolve(process.env.ENVFORGE_MERMAID_EVIDENCE_PATH || path.join(root, "delivery/preparation/evidence/generated-artifacts/mermaid-validation.json"));
const bin = path.join(root, "node_modules/.bin", process.platform === "win32" ? "mmdc.cmd" : "mmdc");
const ciPuppeteerConfig = process.platform === "linux" && process.env.CI === "true"
  ? path.join(root, "tools/preparation/puppeteer-ci.json")
  : undefined;
const started = Date.now();

const inputs = (await walk(docs)).filter((file) => file.endsWith(".mmd")).sort();
if (inputs.length === 0) throw new Error("No Mermaid sources found.");
await mkdir(outputRoot, { recursive: true });

const rendered = [];
for (const input of inputs) {
  const relative = path.relative(docs, input).replaceAll(path.sep, "/");
  const output = path.join(outputRoot, `${relative}.svg`);
  await mkdir(path.dirname(output), { recursive: true });
  const args = ["-i", input, "-o", output, "-b", "transparent"];
  if (ciPuppeteerConfig) args.push("-p", ciPuppeteerConfig);
  const result = spawnSync(bin, args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || "Mermaid render failed.\n");
    process.exit(result.status ?? 1);
  }
  const bytes = await readFile(output);
  if (!bytes.includes(Buffer.from("<svg"))) throw new Error(`Renderer did not create SVG for ${relative}`);
  rendered.push({
    source: `docs/${relative}`,
    output: `artifacts/generated/preparation/mermaid/${relative}.svg`,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex")
  });
}

const version = spawnSync(bin, ["--version"], { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
const summary = {
  status: "PASS",
  command: "npm run validate:docs:mermaid",
  tool: `@mermaid-js/mermaid-cli ${(version.stdout || version.stderr).trim()}`,
  environment: `${process.platform}/${process.arch} node ${process.version}`,
  browserSandboxMode: ciPuppeteerConfig ? "github-ci-no-sandbox" : "platform-default",
  exitCode: 0,
  sourceCount: inputs.length,
  outputBytes: rendered.reduce((sum, item) => sum + item.bytes, 0),
  elapsedMs: Date.now() - started,
  rendered
};
await mkdir(path.dirname(evidencePath), { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(target));
    else if (entry.isFile()) output.push(target);
  }
  return output;
}
