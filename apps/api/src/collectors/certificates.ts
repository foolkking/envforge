/**
 * Collector: certificates (optional)
 * Finds TLS certificates and checks expiry.
 */

import type { CollectorResult } from "./types.js";
import type { CollectorModule, CollectorExecutor } from "./runner.js";

export const certificatesCollector: CollectorModule<string[]> = {
  canRun: () => true,
  async run(_host: string, executor: CollectorExecutor): Promise<CollectorResult<string[]>> {
    const commands: Array<{ command: string; exitCode?: number; timedOut?: boolean }> = [];
    const errors: string[] = [];
    const data: string[] = [];

    // Find certs in common paths + check expiry
    const cmd = `for cert in /etc/ssl/certs/*.pem /etc/letsencrypt/live/*/cert.pem /etc/nginx/ssl/*.pem /etc/caddy/certs/*.pem; do [ -f "$cert" ] && echo "CERT: $cert" && openssl x509 -in "$cert" -noout -enddate 2>/dev/null | sed 's/notAfter=//'; done; echo DONE`;

    try {
      const r = await executor.exec(cmd);
      commands.push({ command: "enumerate certificates", exitCode: r.exitCode, timedOut: r.timedOut });
      const lines = r.stdout.trim().split("\n").filter(l => l && l !== "DONE");
      data.push(...lines);
    } catch (e) {
      errors.push("certs: " + String(e));
    }

    return {
      id: "certificates",
      status: data.length > 0 ? "ok" : "partial",
      completeness: data.length > 0 ? 1 : 0.3,
      commands,
      errors,
      collectedAt: new Date().toISOString(),
      data
    };
  }
};
