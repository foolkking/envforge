/**
 * Dump every catalog item with its capability metadata, including the
 * supportLevel resolved by `withCapabilityMetadata`. Used by the
 * one-shot 116-item audit to seed `docs/catalog-audit/catalog-items.audit.json`.
 *
 * Usage:
 *   node scripts/audit-catalog-items.mjs > docs/catalog-audit/catalog-items.audit.json
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.resolve(here, "../apps/api/dist");

const databaseMod = await import(pathToFileURL(path.join(distRoot, "database.js")).href);
const items = await databaseMod.listCatalogFromDatabase();

function summary(item) {
  return {
    id: item.id,
    capabilityKey: item.capabilityKey ?? null,
    kind: item.kind,
    category: item.category,
    name: item.name,
    nameEn: item.nameEn ?? null,
    summary: item.summary ?? null,
    summaryEn: item.summaryEn ?? null,
    supportLevel: item.supportLevel ?? null,
    sensitivity: item.sensitivity,
    modeSupport: item.modeSupport ?? null,
    managedActions: item.managedActions ?? null,
    componentTypes: (item.components ?? []).map((c) => c.type),
    componentLabels: (item.components ?? []).map((c) => c.label)
  };
}

const out = {
  generatedAt: new Date().toISOString(),
  total: items.length,
  byKind: items.reduce((acc, item) => {
    acc[item.kind] = (acc[item.kind] ?? 0) + 1;
    return acc;
  }, {}),
  bySupportLevel: items.reduce((acc, item) => {
    const level = item.supportLevel ?? "unknown";
    acc[level] = (acc[level] ?? 0) + 1;
    return acc;
  }, {}),
  items: items.map(summary)
};

process.stdout.write(JSON.stringify(out, null, 2) + "\n");
