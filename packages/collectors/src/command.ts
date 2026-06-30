import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function runCommand(command: string, args: string[] = []): Promise<{
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode?: number;
  timedOut: boolean;
}> {
  try {
    const result = await execFileAsync(command, args, {
      windowsHide: true,
      timeout: 15_000
    });

    return {
      ok: true,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
      exitCode: 0,
      timedOut: false
    };
  } catch (error) {
    const commandError = error as {
      stdout?: string;
      stderr?: string;
      message?: string;
      code?: number | string;
      killed?: boolean;
      signal?: string;
    };

    return {
      ok: false,
      stdout: commandError.stdout?.trim() ?? "",
      stderr: commandError.stderr?.trim() || commandError.message || "Command failed",
      exitCode: typeof commandError.code === "number" ? commandError.code : undefined,
      timedOut: commandError.killed === true || commandError.signal === "SIGTERM"
    };
  }
}
