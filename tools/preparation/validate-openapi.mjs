#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = path.resolve(process.env.ENVFORGE_OPENAPI_SOURCE || path.join(root, "docs/08-api/openapi/openapi.yaml"));
const examples = path.resolve(process.env.ENVFORGE_OPENAPI_EXAMPLES || path.join(root, "docs/08-api/openapi/examples/preparation-contract-examples.yaml"));
const outputRoot = path.resolve(process.env.ENVFORGE_OPENAPI_OUTPUT_ROOT || path.join(root, "artifacts/generated/preparation/openapi"));
const bundle = path.join(outputRoot, "openapi.bundle.yaml");
const types = path.join(outputRoot, "openapi-types.d.ts");
const lintLog = path.join(outputRoot, "redocly-lint.txt");
const evidencePath = path.resolve(process.env.ENVFORGE_OPENAPI_EVIDENCE_PATH || path.join(root, "delivery/preparation/evidence/api/openapi-validation.json"));
const started = Date.now();
await mkdir(outputRoot, { recursive: true });

const lint = runBin("redocly", ["lint", source]);
await writeFile(lintLog, `${lint.stdout}${lint.stderr}`, "utf8");
if (lint.status !== 0) fail("Redocly lint", lint);
const bundled = runBin("redocly", ["bundle", source, "--output", bundle]);
if (bundled.status !== 0) fail("Redocly bundle", bundled);
const generated = runBin("openapi-typescript", [source, "--output", types]);
if (generated.status !== 0) fail("OpenAPI TypeScript codegen", generated);

const api = YAML.parse(await readFile(source, "utf8"));
const operationIds = new Set();
const operations = [];
const requiredErrors = ["401", "403", "404", "409", "412", "422"];
for (const [route, pathItem] of Object.entries(api.paths || {})) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!new Set(["get", "post", "put", "patch", "delete", "head", "options"]).has(method)) continue;
    if (!operation.operationId || operationIds.has(operation.operationId)) throw new Error(`Missing/duplicate operationId at ${method.toUpperCase()} ${route}`);
    operationIds.add(operation.operationId);
    const success = Object.keys(operation.responses || {}).find((code) => /^2\d\d$/.test(code));
    if (!success) throw new Error(`No 2xx mock response for ${operation.operationId}`);
    const missing = requiredErrors.filter((code) => !operation.responses?.[code]);
    if (missing.length) throw new Error(`${operation.operationId} missing errors: ${missing.join(",")}`);
    if (["post", "put", "patch", "delete"].includes(method)) {
      const names = (operation.parameters || []).map((item) => item.name || item.$ref?.split("/").at(-1));
      if (!names.includes("IdempotencyKey") && !names.includes("Idempotency-Key")) throw new Error(`${operation.operationId} lacks Idempotency-Key`);
    }
    operations.push({ operationId: operation.operationId, method: method.toUpperCase(), path: route, mockStatus: Number(success) });
  }
}
const typeText = await readFile(types, "utf8");
if (!typeText.includes("export interface paths")) throw new Error("Codegen output does not contain paths interface.");
const explicitExamples = Object.keys(YAML.parse(await readFile(examples, "utf8")).examples || {}).length;
if (explicitExamples < 1) throw new Error("No explicit contract examples found.");

const lintText = `${lint.stdout}${lint.stderr}`;
const summary = {
  status: "PASS",
  commands: [
    "redocly lint docs/08-api/openapi/openapi.yaml",
    "redocly bundle docs/08-api/openapi/openapi.yaml --output artifacts/generated/preparation/openapi/openapi.bundle.yaml",
    "openapi-typescript docs/08-api/openapi/openapi.yaml --output artifacts/generated/preparation/openapi/openapi-types.d.ts"
  ],
  tools: { redocly: "1.34.5", openapiTypescript: "7.13.0", yaml: "workspace dependency" },
  environment: `${process.platform}/${process.arch} node ${process.version}`,
  exitCode: 0,
  openapi: api.openapi,
  apiVersion: api.info?.version,
  pathCount: Object.keys(api.paths || {}).length,
  operationCount: operations.length,
  operationIdsUnique: operationIds.size === operations.length,
  mockedOperations: operations.length,
  explicitExamples,
  lintWarnings: Number((lintText.match(/Warning was generated/g) || []).length),
  bundleBytes: (await readFile(bundle)).length,
  bundleSha256: createHash("sha256").update(await readFile(bundle)).digest("hex"),
  codegenBytes: typeText.length,
  codegenSha256: createHash("sha256").update(typeText).digest("hex"),
  elapsedMs: Date.now() - started,
  operations
};
await mkdir(path.dirname(evidencePath), { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...summary, operations: `[${operations.length} validated operations]` }, null, 2));

function runBin(name, args) {
  const binary = path.join(root, "node_modules/.bin", process.platform === "win32" ? `${name}.cmd` : name);
  return spawnSync(binary, args, { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
}

function fail(label, result) {
  process.stderr.write(`${label} failed.\n${result.stdout || ""}${result.stderr || ""}`);
  process.exit(result.status ?? 1);
}
