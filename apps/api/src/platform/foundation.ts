import { createHash, randomBytes } from "node:crypto";

export const PROJECT_TYPES = ["assessment", "build", "migration", "capture", "restore"] as const;
export type ProjectType = typeof PROJECT_TYPES[number];

export function uuidV7(now = Date.now()): string {
  const bytes = randomBytes(16);
  let value = BigInt(now);
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(value & 0xffn);
    value >>= 8n;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalHash(value: unknown): string {
  return sha256(canonicalJson(value));
}

const sensitiveKey = /(?:password|passwd|secret|token|private.?key|connection.?string|credential)/i;

export function assertNoSensitiveKeys(value: unknown, path = "payload"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (sensitiveKey.test(key)) throw new Error(`Sensitive field is not allowed in ${path}: ${key}`);
    assertNoSensitiveKeys(item, `${path}.${key}`);
  }
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    sensitiveKey.test(key) ? "[REDACTED]" : redact(item)
  ]));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, sortValue(item)]));
}
