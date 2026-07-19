#!/usr/bin/env node
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const temp = await mkdtemp(path.join(os.tmpdir(), "envforge-preparation-failures-"));
const checks = [];
try {
  const docs = path.join(temp, "docs");
  await cp(path.join(root, "docs"), docs, { recursive: true });
  await writeFile(path.join(docs, "broken-link.md"), "---\nid: test-broken-link\ntitle: Broken Link\nversion: '1.1'\nstatus: draft\nclassification: normative-target-design\nowners: [prep]\nlast_reviewed: '2026-07-19'\nrelated_adrs: []\nsource_of_truth_for: []\n---\n[missing](./does-not-exist.md)\n", "utf8");
  checks.push(run("broken Markdown link", "python", ["tools/validate_design_docs.py"], { ENVFORGE_VALIDATE_DOCS_ROOT: docs }, "BROKEN_LINK"));
  await writeFile(path.join(docs, "duplicate-id.md"), await readFile(path.join(docs, "README.md"), "utf8"), "utf8");
  checks.push(run("duplicate document id", "python", ["tools/validate_design_docs.py"], { ENVFORGE_VALIDATE_DOCS_ROOT: docs }, "DUPLICATE_ID"));
  await writeFile(path.join(docs, "invalid-frontmatter.md"), "---\nid: broken\n---\n", "utf8");
  checks.push(run("invalid front matter", "python", ["tools/validate_design_docs.py"], { ENVFORGE_VALIDATE_DOCS_ROOT: docs }, "FRONT_MATTER_FIELD"));

  const mmd = path.join(temp, "mermaid-docs");
  await cp(path.join(root, "docs"), mmd, { recursive: true });
  await writeFile(path.join(mmd, "broken.mmd"), "this is not mermaid\n", "utf8");
  checks.push(run("invalid Mermaid", "node", ["tools/preparation/render-mermaid.mjs"], { ENVFORGE_MERMAID_DOCS_ROOT: mmd, ENVFORGE_MERMAID_OUTPUT_ROOT: path.join(temp, "mmd-out"), ENVFORGE_MERMAID_EVIDENCE_PATH: path.join(temp, "mmd.json") }));

  const openapi = path.join(temp, "openapi");
  await cp(path.join(root, "docs/08-api/openapi"), openapi, { recursive: true });
  const openapiFile = path.join(openapi, "openapi.yaml");
  await writeFile(openapiFile, (await readFile(openapiFile, "utf8")).replace("#/components/responses/E401", "#/components/responses/MISSING_RESPONSE"), "utf8");
  checks.push(run("broken OpenAPI reference", "node", ["tools/preparation/validate-openapi.mjs"], { ENVFORGE_OPENAPI_SOURCE: openapiFile, ENVFORGE_OPENAPI_EXAMPLES: path.join(openapi, "examples/preparation-contract-examples.yaml"), ENVFORGE_OPENAPI_OUTPUT_ROOT: path.join(temp, "openapi-out"), ENVFORGE_OPENAPI_EVIDENCE_PATH: path.join(temp, "openapi.json") }, "MISSING_RESPONSE"));
  await cp(path.join(root, "docs/08-api/openapi/openapi.yaml"), openapiFile);
  await writeFile(openapiFile, (await readFile(openapiFile, "utf8")).replace("operationId: CreateProject", "operationId: ListProjects"), "utf8");
  checks.push(run("duplicate OpenAPI operationId", "node", ["tools/preparation/validate-openapi.mjs"], { ENVFORGE_OPENAPI_SOURCE: openapiFile, ENVFORGE_OPENAPI_EXAMPLES: path.join(openapi, "examples/preparation-contract-examples.yaml"), ENVFORGE_OPENAPI_OUTPUT_ROOT: path.join(temp, "openapi-out-2"), ENVFORGE_OPENAPI_EVIDENCE_PATH: path.join(temp, "openapi-2.json") }));

  const schemas = path.join(temp, "schemas");
  await cp(path.join(root, "docs/08-api/openapi/schemas"), schemas, { recursive: true });
  const examples = path.join(temp, "examples.yaml");
  await cp(path.join(root, "docs/08-api/openapi/examples/preparation-contract-examples.yaml"), examples);
  await writeFile(examples, (await readFile(examples, "utf8")).replace("type: build", "type: impossible"), "utf8");
  checks.push(run("invalid JSON Schema example", "node", ["tools/preparation/validate-json-schemas.mjs"], { ENVFORGE_JSON_SCHEMA_ROOT: schemas, ENVFORGE_JSON_SCHEMA_EXAMPLES: examples, ENVFORGE_JSON_SCHEMA_EVIDENCE_PATH: path.join(temp, "schema.json") }));
  checks.push(run("missing evidence/source path", "node", ["tools/preparation/validate-openapi.mjs"], { ENVFORGE_OPENAPI_SOURCE: path.join(temp, "missing.yaml"), ENVFORGE_OPENAPI_EXAMPLES: examples, ENVFORGE_OPENAPI_OUTPUT_ROOT: path.join(temp, "missing-out"), ENVFORGE_OPENAPI_EVIDENCE_PATH: path.join(temp, "missing.json") }));
  checks.push(run("unavailable PostgreSQL target", "node", ["tools/preparation/validate-reference-ddl.mjs"], { PREPARATION_DATABASE_URL: "postgres://postgres@127.0.0.1:1/envforge_preparation", ENVFORGE_DDL_EVIDENCE_PATH: path.join(temp, "ddl.json") }));
  if (checks.some((check) => !check.pass)) throw new Error(`Failure-path checks failed: ${JSON.stringify(checks)}`);
  const summary = { status: "PASS", checks, sourceMutation: "none" };
  await writeFile(path.join(root, "delivery/preparation/evidence/tests/failure-paths.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await rm(temp, { recursive: true, force: true });
}

function run(name, command, args, env, marker) {
  const result = spawnSync(command, args, { cwd: root, env: { ...process.env, ...env }, encoding: "utf8", shell: process.platform === "win32" });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  return { name, pass: result.status !== 0 && (!marker || output.toLowerCase().includes(marker.toLowerCase())), exitCode: result.status, marker };
}
