import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import {
  buildWebhookUrl,
  deleteWebhookIfCurrent,
  loadTelegramConfig,
  redactSecret,
  redactWebhookUrl,
  registerWebhook,
  type TelegramConfig,
} from "./telegram-webhook";

const PNPM_COMMAND = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const LOCALHOST_RUN_URL = "https://64ce59a9c5d14b.lhr.life";
const HEALTH_TIMEOUT_MS = 60_000;
const HEALTH_REQUEST_TIMEOUT_MS = 5_000;
const HEALTH_RETRY_DELAY_MS = 1_000;

type ProcessResult = {
  code: number | null;
  signal: NodeJS.Signals | null;
  error?: Error;
};

type ManagedProcess = {
  child: ChildProcess;
  exit: Promise<ProcessResult>;
  exitResult?: ProcessResult;
};

class ShutdownRequested extends Error {
  constructor() {
    super("Shutdown requested");
    this.name = "ShutdownRequested";
  }
}

const activeChildren = new Set<ChildProcess>();
let shutdownRequested = false;
let shutdownSignal: string | undefined;
const shutdownController = new AbortController();

function processErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function waitForExit(child: ChildProcess): Promise<ProcessResult> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: ProcessResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    child.once("error", (error) => finish({ code: null, signal: null, error }));
    child.once("close", (code, signal) => finish({ code, signal }));
  });
}

function formatProcessResult(result: ProcessResult): string {
  if (result.error) return result.error.message;
  if (result.signal) return `signal ${result.signal}`;
  return `exit code ${result.code ?? "unknown"}`;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function stopActiveChildren(signal: NodeJS.Signals = "SIGINT"): void {
  for (const child of activeChildren) {
    if (child.exitCode === null) child.kill(signal);
  }
}

function handleSignal(signal: NodeJS.Signals): void {
  if (shutdownRequested) {
    stopActiveChildren("SIGKILL");
    return;
  }

  shutdownRequested = true;
  shutdownSignal = signal;
  shutdownController.abort();
  console.error(`[dev] ${signal} received; stopping local development.`);
  stopActiveChildren();
}

const onSigint = () => handleSignal("SIGINT");
const onSigterm = () => handleSignal("SIGTERM");

function installSignalHandlers(): void {
  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigterm);
}

function removeSignalHandlers(): void {
  process.off("SIGINT", onSigint);
  process.off("SIGTERM", onSigterm);
}

function throwIfShutdownRequested(): void {
  if (shutdownRequested) throw new ShutdownRequested();
}

function createProcessState(child: ChildProcess): ManagedProcess {
  const state: ManagedProcess = {
    child,
    exit: Promise.resolve({ code: null, signal: null }),
  };

  activeChildren.add(child);
  state.exit = waitForExit(child).then((result) => {
    state.exitResult = result;
    activeChildren.delete(child);
    return result;
  });

  return state;
}

async function runLocalMigrations(): Promise<void> {
  console.log("[dev] Applying pending local D1 migrations...");

  const child = spawn(
    PNPM_COMMAND,
    ["exec", "wrangler", "d1", "migrations", "apply", "DB", "--local"],
    { env: process.env, stdio: "inherit" },
  );
  const migration = createProcessState(child);
  const result = await migration.exit;

  throwIfShutdownRequested();
  if (result.error || result.code !== 0) {
    throw new Error(`Local D1 migrations failed: ${formatProcessResult(result)}`);
  }
}

function forwardStream(
  stream: NodeJS.ReadableStream | null,
  output: NodeJS.WriteStream,
  secret: string,
): void {
  if (!stream) return;

  const lines = createInterface({ input: stream });
  lines.on("line", (line) => {
    output.write(`${redactSecret(line, secret)}\n`);
  });
}

function startWorker(config: TelegramConfig): ManagedProcess {
  const child = spawn(PNPM_COMMAND, ["exec", "wrangler", "dev", "--local", "--port", "8787"], {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const worker = createProcessState(child);
  forwardStream(child.stdout, process.stdout, config.secret);
  forwardStream(child.stderr, process.stderr, config.secret);

  return worker;
}

async function fetchHealth(healthUrl: string, worker: ManagedProcess): Promise<Response> {
  const requestController = new AbortController();
  const timeout = setTimeout(() => requestController.abort(), HEALTH_REQUEST_TIMEOUT_MS);
  let workerExited = false;
  const onShutdown = () => requestController.abort();
  shutdownController.signal.addEventListener("abort", onShutdown, { once: true });
  const workerExitWatcher = worker.exit.then(() => {
    workerExited = true;
    requestController.abort();
  });

  try {
    const response = await fetch(healthUrl, { signal: requestController.signal });
    if (workerExited) throw new Error("Wrangler exited while checking public health");
    return response;
  } catch (error) {
    if (shutdownRequested) throw new ShutdownRequested();
    if (workerExited) throw new Error("Wrangler exited while checking public health");
    throw error;
  } finally {
    clearTimeout(timeout);
    shutdownController.signal.removeEventListener("abort", onShutdown);
    void workerExitWatcher;
  }
}

async function waitForPublicHealth(worker: ManagedProcess): Promise<void> {
  const healthUrl = new URL("/health", LOCALHOST_RUN_URL).toString();
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let attempt = 0;
  let lastResult = "no response";

  console.log(`[dev] Waiting for public Worker health at ${healthUrl}...`);

  while (Date.now() < deadline) {
    throwIfShutdownRequested();
    if (worker.exitResult) {
      throw new Error(
        `Wrangler exited before the public Worker became ready (${formatProcessResult(worker.exitResult)}).`,
      );
    }
    attempt += 1;
    try {
      const response = await fetchHealth(healthUrl, worker);
      await response.text();
      if (response.ok) {
        console.log(`[dev] Public Worker health is ready (HTTP ${response.status}).`);
        return;
      }
      lastResult = `HTTP ${response.status}`;
    } catch (error) {
      if (error instanceof ShutdownRequested) throw error;
      lastResult = processErrorMessage(error);
    }

    if (attempt === 1 || attempt % 5 === 0) {
      console.log(`[dev] Public health not ready (${lastResult}); retrying...`);
    }
    await sleep(HEALTH_RETRY_DELAY_MS);
  }

  throw new Error(
    `Public Worker health check timed out after ${HEALTH_TIMEOUT_MS / 1000}s (last result: ${lastResult}). Webhook was not registered.`,
  );
}

async function stopProcess(process: ManagedProcess | undefined): Promise<void> {
  if (!process || process.child.exitCode !== null) return;

  process.child.kill("SIGINT");
  await Promise.race([process.exit, sleep(5_000)]);
  if (process.child.exitCode === null) process.child.kill("SIGTERM");
  await Promise.race([process.exit, sleep(2_000)]);
  if (process.child.exitCode === null) process.child.kill("SIGKILL");
}

async function main(): Promise<void> {
  let config: TelegramConfig | undefined;
  let worker: ManagedProcess | undefined;
  let candidateWebhookUrl: string | undefined;
  let registrationStarted = false;
  let exitCode = 0;

  installSignalHandlers();

  try {
    config = loadTelegramConfig();
    console.log("[dev] BOT_TOKEN and WEBHOOK_SECRET validated.");

    await runLocalMigrations();
    throwIfShutdownRequested();

    console.log("[dev] Starting Wrangler local Worker...");
    worker = startWorker(config);

    console.log(`[dev] Waiting for your localhost.run tunnel at ${LOCALHOST_RUN_URL}...`);
    await waitForPublicHealth(worker);
    throwIfShutdownRequested();

    candidateWebhookUrl = buildWebhookUrl(LOCALHOST_RUN_URL, config.secret);
    registrationStarted = true;
    console.log("[dev] Registering Telegram webhook and commands...");
    const webhookUrl = await registerWebhook(config, LOCALHOST_RUN_URL);
    console.log(`[dev] Telegram webhook verified: ${redactWebhookUrl(webhookUrl, config.secret)}`);
    throwIfShutdownRequested();

    console.log(`[dev] READY — local Worker is connected to Telegram via ${LOCALHOST_RUN_URL}.`);
    const result = await worker.exit;
    if (result.error || result.code !== 0) {
      throw new Error(`Wrangler stopped unexpectedly: ${formatProcessResult(result)}`);
    }
    throw new Error("Wrangler stopped unexpectedly.");
  } catch (error) {
    if (error instanceof ShutdownRequested || shutdownRequested) {
      console.log(`[dev] Shutdown complete${shutdownSignal ? ` (${shutdownSignal})` : ""}.`);
    } else {
      const message = config ? redactSecret(processErrorMessage(error), config.secret) : processErrorMessage(error);
      console.error(`[dev] ${message}`);
      exitCode = 1;
    }
  } finally {
    await stopProcess(worker);

    if (config && candidateWebhookUrl && registrationStarted) {
      try {
        const deleted = await deleteWebhookIfCurrent(config, candidateWebhookUrl);
        if (deleted) {
          console.log("[dev] Telegram webhook removed for this local run.");
        } else {
          console.log("[dev] Telegram webhook was changed elsewhere; leaving it untouched.");
        }
      } catch (error) {
        console.error(`[dev] Could not clean up Telegram webhook: ${redactSecret(processErrorMessage(error), config.secret)}`);
        exitCode = 1;
      }
    }

    removeSignalHandlers();
  }

  process.exitCode = exitCode;
}

await main();
