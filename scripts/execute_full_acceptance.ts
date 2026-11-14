import { spawn } from "child_process";
import { runFinalPerformanceAcceptanceTest } from "./final_performance_acceptance_test";

async function wait(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function waitForServer(url: string, timeoutMs: number = 30000): Promise<boolean> {
  const start = Date.now();
  console.log(`Waiting for production server at ${url}...`);

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.status === 200) {
        console.log(`Production server is ready and healthy! (HTTP 200 in ${Date.now() - start}ms)`);
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await wait(1000);
  }
  return false;
}

async function main() {
  const port = process.env.PORT || "3000";
  const baseUrl = `http://localhost:${port}`;

  console.log(`Starting Next.js production server on port ${port}...`);
  const nextBin = "./node_modules/next/dist/bin/next";
  const server = spawn(process.execPath, [nextBin, "start", "-p", port], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout?.on("data", (d) => process.stdout.write(d.toString()));
  server.stderr?.on("data", (d) => process.stderr.write(d.toString()));

  server.on("error", (err) => {
    console.error("Failed to start production server:", err);
  });

  try {
    const isReady = await waitForServer(baseUrl, 40000);
    if (!isReady) {
      throw new Error(`Server failed to start within timeout at ${baseUrl}`);
    }

    // Run the 5-iteration benchmark test
    await runFinalPerformanceAcceptanceTest(baseUrl);
  } finally {
    console.log("\nShutting down production server...");
    server.kill("SIGTERM");
    // Ensure child process is killed on Windows
    try {
      spawn("taskkill", ["/pid", server.pid?.toString() || "", "/T", "/F"], { stdio: "ignore" });
    } catch {
      // Ignored
    }
    console.log("Server shutdown complete.");
  }
}

main().catch((err) => {
  console.error("Acceptance execution error:", err);
  process.exit(1);
});
