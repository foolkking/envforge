/**
 * dev.mjs — 一键本地开发启动器
 *
 * 一条命令(npm run dev)同时拉起前端 + 后端:
 *   - Web (Vite)  → http://localhost:5173   ← 你只需要打开这个
 *   - API         → http://localhost:5174   ← 内部端口,前端自动代理,不用管
 *
 * 特性:
 *   - 启动前自动编译后端一次,保证 dist 是最新的
 *   - API 进程意外退出会自动重启(根治"服务老掉、登录不了"的问题)
 *   - Ctrl+C 一并干净退出前后端
 */
import { spawn, execSync } from "node:child_process";

const API_PORT = "5174";
const WEB_PORT = "5173";
const ROOT = process.cwd();

const children = new Set();
let shuttingDown = false;

function log(tag, msg) {
  console.log(`\x1b[36m[dev:${tag}]\x1b[0m ${msg}`);
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  log("sys", "shutting down…");
  for (const c of children) {
    try { c.kill(); } catch {}
  }
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// 1) Build the backend once so dist/server.js is current.
log("api", "building server (one-time)…");
try {
  execSync("npm run build:server", { stdio: "inherit", cwd: ROOT });
} catch {
  log("api", "build failed — aborting");
  process.exit(1);
}

// 2) API with auto-restart on unexpected exit.
function startApi() {
  const p = spawn("node", ["apps/api/dist/server.js"], {
    stdio: "inherit",
    shell: false,
    cwd: ROOT,
    env: { ...process.env, PORT: API_PORT }
  });
  children.add(p);
  p.on("exit", (code) => {
    children.delete(p);
    if (shuttingDown) return;
    log("api", `exited (code ${code}) — restarting in 1.5s`);
    setTimeout(startApi, 1500);
  });
  log("api", `listening on http://localhost:${API_PORT}`);
}

// 3) Web (Vite) on the user-facing port.
function startWeb() {
  const p = spawn("npm", ["run", "dev", "--workspace", "@fool/web"], {
    stdio: "inherit",
    shell: true,
    cwd: ROOT
  });
  children.add(p);
  p.on("exit", (code) => {
    children.delete(p);
    if (!shuttingDown) {
      log("web", `vite exited (code ${code}) — stopping`);
      shutdown();
    }
  });
  log("web", `serving on http://localhost:${WEB_PORT}`);
}

startApi();
startWeb();
log("sys", `ready → open http://localhost:${WEB_PORT}`);
