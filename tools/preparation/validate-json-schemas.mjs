#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import YAML from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schemaRoot = path.resolve(process.env.ENVFORGE_JSON_SCHEMA_ROOT || path.join(root, "docs/08-api/openapi/schemas"));
const examplesPath = path.resolve(process.env.ENVFORGE_JSON_SCHEMA_EXAMPLES || path.join(root, "docs/08-api/openapi/examples/preparation-contract-examples.yaml"));
const evidencePath = path.resolve(process.env.ENVFORGE_JSON_SCHEMA_EVIDENCE_PATH || path.join(root, "delivery/preparation/evidence/api/json-schema-validation.json"));
const started = Date.now();

const ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
addFormats(ajv);
const documents = new Map();
const files = (await readdir(schemaRoot)).filter((name) => name.endsWith(".yaml")).sort();
for (const file of files) {
  const absolute = path.join(schemaRoot, file);
  const document = YAML.parse(await readFile(absolute, "utf8"));
  const id = pathToFileURL(absolute).href;
  document.$id = id;
  documents.set(id, document);
  ajv.addSchema(document, id);
}

const results = [];
for (const [id, document] of documents) {
  for (const name of Object.keys(document.$defs || {}).sort()) {
    const ref = `${id}#/$defs/${encodeURIComponent(name)}`;
    const validate = ajv.getSchema(ref) || ajv.compile({ $ref: ref });
    const sample = synthesize(document.$defs[name], id, new Set());
    if (!validate(sample)) {
      throw new Error(`Generated positive sample failed ${path.basename(new URL(id).pathname)}#${name}: ${ajv.errorsText(validate.errors)}`);
    }
    if (validate(null)) throw new Error(`Negative null unexpectedly passed ${name}`);
    results.push({ file: path.basename(new URL(id).pathname), schema: name, positive: "PASS", negative: "PASS" });
  }
}

const examplesDoc = YAML.parse(await readFile(examplesPath, "utf8"));
const exampleResults = [];
for (const [name, entry] of Object.entries(examplesDoc.examples || {})) {
  const [filePart, fragment] = entry.schema.split("#", 2);
  const absolute = path.resolve(path.dirname(examplesPath), filePart);
  const ref = `${pathToFileURL(absolute).href}#${fragment}`;
  const validate = ajv.getSchema(ref) || ajv.compile({ $ref: ref });
  const actual = Boolean(validate(entry.value));
  if (actual !== Boolean(entry.valid)) {
    throw new Error(`Example ${name} expected valid=${entry.valid}, got ${actual}: ${ajv.errorsText(validate.errors)}`);
  }
  exampleResults.push({ name, schema: entry.schema, expectedValid: Boolean(entry.valid), result: "PASS" });
}

const summary = {
  status: "PASS",
  command: "npm run validate:schemas",
  tool: "ajv 8.20.0 + ajv-formats 3.0.1",
  environment: `${process.platform}/${process.arch} node ${process.version}`,
  exitCode: 0,
  schemaFiles: files.length,
  definitions: results.length,
  generatedPositiveCases: results.length,
  generatedNegativeCases: results.length,
  explicitExamples: exampleResults.length,
  examplesSha256: createHash("sha256").update(await readFile(examplesPath)).digest("hex"),
  elapsedMs: Date.now() - started,
  results,
  exampleResults
};
await mkdir(path.dirname(evidencePath), { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));

function synthesize(schema, baseId, seen) {
  if (!schema || typeof schema !== "object") return {};
  if (schema.const !== undefined) return structuredClone(schema.const);
  if (Array.isArray(schema.enum) && schema.enum.length) return structuredClone(schema.enum[0]);
  if (schema.$ref) {
    const target = resolveRef(schema.$ref, baseId);
    if (seen.has(target.ref)) return {};
    return synthesize(target.schema, target.baseId, new Set([...seen, target.ref]));
  }
  if (schema.oneOf?.length) return synthesize(schema.oneOf[0], baseId, seen);
  if (schema.anyOf?.length) return synthesize(schema.anyOf[0], baseId, seen);
  if (schema.allOf?.length) {
    return schema.allOf.reduce((value, item) => {
      const next = synthesize(item, baseId, seen);
      return typeof value === "object" && typeof next === "object" && !Array.isArray(value) && !Array.isArray(next) ? { ...value, ...next } : next;
    }, {});
  }
  const type = Array.isArray(schema.type) ? schema.type.find((value) => value !== "null") : schema.type;
  if (type === "object" || schema.properties) {
    const output = {};
    for (const key of schema.required || []) output[key] = synthesize(schema.properties?.[key] || {}, baseId, seen);
    return output;
  }
  if (type === "array") {
    const count = Math.max(0, schema.minItems || 0);
    return Array.from({ length: count }, () => synthesize(schema.items || {}, baseId, seen));
  }
  if (type === "integer" || type === "number") return schema.minimum ?? 0;
  if (type === "boolean") return false;
  if (type === "string" || !type) {
    if (schema.format === "uuid") return "00000000-0000-4000-8000-000000000001";
    if (schema.format === "date-time") return "2026-07-19T00:00:00Z";
    if (schema.format === "date") return "2026-07-19";
    if (schema.format === "uri" || schema.format === "uri-reference") return "urn:envforge:preparation";
    if (schema.format === "email") return "test@example.invalid";
    if (schema.pattern?.includes("64")) return "a".repeat(64);
    return "x".repeat(Math.max(1, schema.minLength || 1));
  }
  return {};
}

function resolveRef(reference, baseId) {
  const url = new URL(reference, baseId);
  const documentId = `${url.protocol}//${url.host}${url.pathname}`;
  const document = documents.get(documentId);
  if (!document) throw new Error(`Unknown schema reference ${reference} from ${baseId}`);
  let target = document;
  for (const part of url.hash.replace(/^#\/?/, "").split("/").filter(Boolean)) {
    target = target[decodeURIComponent(part).replaceAll("~1", "/").replaceAll("~0", "~")];
  }
  return { schema: target, baseId: documentId, ref: url.href };
}
