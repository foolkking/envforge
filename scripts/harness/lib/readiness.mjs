/**
 * scripts/harness/lib/readiness.mjs
 *
 * Pure-logic helpers shared by the harness orchestrator, the readiness
 * probe, and the test suite. Keeping the logic in one place means a
 * regression in the verdict rules fails CI before it ever reaches a
 * live VM.
 *
 * Three responsibilities:
 *   1. parseReadinessProbe — turn the JSON our SSH probe emits into a
 *      structured TargetReadiness record.
 *   2. evaluateReadiness    — apply the readiness contract documented
 *      in docs/validation.md.
 *   3. decideCertificationVerdict — fold the per-scenario results into
 *      a single certification verdict.
 *
 * NOTHING in this module talks to the runtime store, the EnvForge API,
 * or shells out to SSH. That keeps it CI-safe.
 */

/** @typedef {{
 *    target: string,
 *    os: string,
 *    kernel: string,
 *    hostname: string,
 *    systemd: boolean,
 *    ssh: boolean,
 *    sudo: boolean,
 *    apt: boolean,
 *    aptLocked: boolean,
 *    sshServiceName: string,
 *    nginxServiceName?: string | null,
 *    dockerServiceName?: string | null,
 *    firewallStack: string,
 *    productionMarkers: string[],
 *    disposableMarkers: string[]
 *  }} ProbeRaw
 */

/** @typedef {{
 *    target: string,
 *    os: string,
 *    kernel: string,
 *    hostname: string,
 *    systemd: boolean,
 *    ssh: boolean,
 *    sudo: boolean,
 *    apt: boolean,
 *    disposable: boolean,
 *    safeForDestructive: boolean,
 *    verdict: "ready" | "not-ready",
 *    reasons: string[],
 *    raw: ProbeRaw
 *  }} TargetReadiness
 */

const DISPOSABLE_HOSTNAME_HINTS = [
  "envforge-harness",
  "envforge-cert",
  "envforge-disposable",
  "envforge-test"
];

const PRODUCTION_HOSTNAME_HINTS = ["prod", "production", "live", "main"];

const REQUIRED_OS_PATTERNS = [/Ubuntu 22\.\d+/, /Ubuntu 24\.\d+/];

/**
 * Parse the JSON document our remote probe emits. Tolerates missing
 * fields by recording a clear reason rather than throwing — the
 * resulting record is the input to evaluateReadiness which decides
 * the final verdict.
 *
 * @param {unknown} payload
 * @returns {{ ok: true, raw: ProbeRaw } | { ok: false, error: string }}
 */
export function parseReadinessProbe(payload) {
  if (typeof payload !== "object" || payload === null) {
    return { ok: false, error: "probe payload is not an object" };
  }
  const p = /** @type {Record<string, unknown>} */ (payload);
  const required = ["target", "os", "kernel", "hostname"];
  for (const key of required) {
    if (typeof p[key] !== "string" || p[key].length === 0) {
      return { ok: false, error: `probe payload missing string field "${key}"` };
    }
  }
  const raw = {
    target: String(p.target),
    os: String(p.os),
    kernel: String(p.kernel),
    hostname: String(p.hostname),
    systemd: p.systemd === true,
    ssh: p.ssh === true,
    sudo: p.sudo === true,
    apt: p.apt === true,
    aptLocked: p.aptLocked === true,
    sshServiceName: typeof p.sshServiceName === "string" ? p.sshServiceName : "unknown",
    nginxServiceName: typeof p.nginxServiceName === "string" ? p.nginxServiceName : null,
    dockerServiceName: typeof p.dockerServiceName === "string" ? p.dockerServiceName : null,
    firewallStack: typeof p.firewallStack === "string" ? p.firewallStack : "unknown",
    productionMarkers: Array.isArray(p.productionMarkers) ? p.productionMarkers.map(String) : [],
    disposableMarkers: Array.isArray(p.disposableMarkers) ? p.disposableMarkers.map(String) : []
  };
  return { ok: true, raw };
}

/**
 * Apply the readiness contract. Returns a structured record so the
 * orchestrator can decide whether destructive scenarios may run.
 *
 * @param {ProbeRaw} raw
 * @returns {TargetReadiness}
 */
export function evaluateReadiness(raw) {
  const reasons = [];
  const isUbuntu = REQUIRED_OS_PATTERNS.some((re) => re.test(raw.os));
  if (!isUbuntu) reasons.push(`os "${raw.os}" is not Ubuntu 22/24 LTS`);
  if (!raw.systemd) reasons.push("systemd not available");
  if (!raw.ssh) reasons.push("ssh probe failed");
  if (!raw.sudo) reasons.push("sudo not available without password");
  if (!raw.apt) reasons.push("apt-get not available");
  if (raw.aptLocked) reasons.push("apt/dpkg lock is held — wait for cloud-init / unattended-upgrades to finish");

  // Disposable detection is conservative: at least one of
  //   - hostname contains an EnvForge harness hint, OR
  //   - the probe explicitly reports a disposableMarkers entry
  // AND no explicit production hint anywhere.
  const hostHasHarness = DISPOSABLE_HOSTNAME_HINTS.some((hint) =>
    raw.hostname.toLowerCase().includes(hint)
  );
  const reportedDisposable = raw.disposableMarkers.length > 0;
  const hostIsProd = PRODUCTION_HOSTNAME_HINTS.some((hint) =>
    raw.hostname.toLowerCase().includes(hint)
  );
  const reportedProd = raw.productionMarkers.length > 0;

  let disposable = (hostHasHarness || reportedDisposable) && !hostIsProd && !reportedProd;
  if (!disposable) {
    if (hostIsProd) reasons.push(`hostname "${raw.hostname}" looks like a production host`);
    if (reportedProd) reasons.push(`probe reported production markers: ${raw.productionMarkers.join(", ")}`);
    if (!hostHasHarness && !reportedDisposable) {
      reasons.push("no disposable marker on the target — set hostname to envforge-harness-* or place /etc/envforge-disposable");
    }
  }

  const verdict = reasons.length === 0 ? "ready" : "not-ready";
  // Even if some non-destructive prerequisites are met, we ONLY allow
  // destructive scenarios when EVERYTHING is green.
  const safeForDestructive = verdict === "ready" && disposable;

  return {
    target: raw.target,
    os: raw.os,
    kernel: raw.kernel,
    hostname: raw.hostname,
    systemd: raw.systemd,
    ssh: raw.ssh,
    sudo: raw.sudo,
    apt: raw.apt,
    disposable,
    safeForDestructive,
    verdict,
    reasons,
    raw
  };
}

const VERDICT_LABELS = ["not-run", "failed", "certified-with-warnings", "certified-basic"];
export const CERTIFICATION_VERDICTS = Object.freeze(VERDICT_LABELS);

/**
 * Decide the final certification verdict.
 *
 * Inputs:
 *   - liveExecuted   : true iff the orchestrator actually ran scenarios
 *                      against a live target (the one anti-fake guard).
 *   - mandatory      : Array<{ id: string; verdict: "pass" | "fail" | "skipped" | "error" | "missing-report" }>
 *   - optional       : Array<{ id: string; verdict: "pass" | "fail" | "skipped" | "error" | "missing-report" }>
 *   - warnings       : non-blocking warnings recorded during the run.
 *
 * Rules:
 *   1. Without a live execution → "not-run". Hard guard. There is no
 *      flag combination that promotes a dry-run to certified-*.
 *   2. Any mandatory scenario whose verdict is not "pass" → "failed".
 *   3. All mandatory pass + every optional scenario passed and no
 *      warnings → "certified-basic".
 *   4. All mandatory pass + at least one optional skipped/failed OR at
 *      least one warning → "certified-with-warnings".
 *
 * @param {{
 *   liveExecuted: boolean,
 *   mandatory: Array<{ id: string; verdict: string }>,
 *   optional?: Array<{ id: string; verdict: string }>,
 *   warnings?: string[]
 * }} input
 * @returns {{ verdict: string, reasons: string[] }}
 */
export function decideCertificationVerdict(input) {
  const { liveExecuted, mandatory, optional = [], warnings = [] } = input;
  const reasons = [];
  if (!liveExecuted) {
    reasons.push("live execution did not run — verdict locked to not-run");
    return { verdict: "not-run", reasons };
  }
  const failedMandatory = mandatory.filter((s) => s.verdict !== "pass");
  if (failedMandatory.length > 0) {
    for (const s of failedMandatory) reasons.push(`mandatory scenario "${s.id}" verdict=${s.verdict}`);
    return { verdict: "failed", reasons };
  }
  const failedOptional = optional.filter((s) => s.verdict !== "pass");
  if (failedOptional.length > 0) {
    for (const s of failedOptional) reasons.push(`optional scenario "${s.id}" verdict=${s.verdict}`);
    return { verdict: "certified-with-warnings", reasons };
  }
  if (warnings.length > 0) {
    for (const w of warnings) reasons.push(`warning: ${w}`);
    return { verdict: "certified-with-warnings", reasons };
  }
  reasons.push("all mandatory + optional scenarios passed cleanly");
  return { verdict: "certified-basic", reasons };
}

/**
 * Decide whether destructive scenarios may run, given a readiness
 * record and the operator's environment. Pure helper so the
 * orchestrator and the tests stay aligned.
 *
 * @param {{
 *   readiness: TargetReadiness | null,
 *   allowDestructive: boolean,
 *   destructive: boolean
 * }} input
 */
export function destructiveAllowed({ readiness, allowDestructive, destructive }) {
  if (!destructive) return { allowed: true, reason: "scenario is not destructive" };
  if (!allowDestructive) {
    return {
      allowed: false,
      reason: "ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE!=true — destructive scenarios are off by default"
    };
  }
  if (!readiness) {
    return {
      allowed: false,
      reason: "target readiness probe was not run; refuse destructive without an explicit ready verdict"
    };
  }
  if (readiness.verdict !== "ready" || !readiness.safeForDestructive) {
    return {
      allowed: false,
      reason: `target readiness verdict=${readiness.verdict}, safeForDestructive=${readiness.safeForDestructive}; reasons: ${readiness.reasons.join("; ")}`
    };
  }
  return { allowed: true, reason: "readiness=ready, disposable confirmed, destructive ack present" };
}
