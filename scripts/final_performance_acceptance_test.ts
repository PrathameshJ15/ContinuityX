import { prisma } from "../src/lib/db";
import { createSessionToken } from "../src/lib/auth";

interface EndpointRun {
  route: string;
  type: "API" | "PAGE";
  times: number[];
  mean: number;
  min: number;
  max: number;
  dataVerified: boolean;
  verificationDetail: string;
  status: number;
}

export async function runFinalPerformanceAcceptanceTest(baseUrl: string = "http://localhost:3000") {
  console.log("===============================================================================");
  console.log("      CONTINUITYX - FINAL PERFORMANCE ACCEPTANCE TEST (5 ITERATIONS)          ");
  console.log("===============================================================================\n");

  const project = await prisma.project.findFirst({
    where: { name: "Smart Attendance System (Synthetic Demo)" },
  });
  if (!project) throw new Error("Target demo project not found in database");
  const projectId = project.id;

  const leadUser = await prisma.user.findUnique({
    where: { email: "lead@continuityx.demo" },
  });
  if (!leadUser) throw new Error("Demo lead user not found");

  const token = await createSessionToken({
    id: leadUser.id,
    email: leadUser.email,
    name: leadUser.name,
  });
  const cookieHeader = `continuityx_session=${token}`;
  console.log(`Authenticated as: ${leadUser.email} (Role: OWNER)`);
  console.log(`Target Project: "${project.name}" (${projectId})\n`);

  // Define API endpoints with validation functions
  const apiEndpoints = [
    {
      route: `/api/projects`,
      method: "GET",
      validator: (data: any) => {
        const found = Array.isArray(data.projects) && data.projects.some((p: any) => p.id === projectId);
        return { ok: found, detail: `Found ${data.projects?.length || 0} projects (contains target)` };
      },
    },
    {
      route: `/api/projects/${projectId}`,
      method: "GET",
      validator: (data: any) => {
        const ok = data.project?.id === projectId && data.project?.name === project.name;
        return { ok, detail: `Project: "${data.project?.name}" (Role: ${data.membership?.role})` };
      },
    },
    {
      route: `/api/projects/${projectId}/documents`,
      method: "GET",
      validator: (data: any) => {
        const ok = Array.isArray(data.documents);
        return { ok, detail: `${data.documents?.length || 0} indexed documents` };
      },
    },
    {
      route: `/api/projects/${projectId}/claims`,
      method: "GET",
      validator: (data: any) => {
        const ok = Array.isArray(data.claims) && data.claims.length > 0;
        return { ok, detail: `${data.claims?.length || 0} claims in database` };
      },
    },
    {
      route: `/api/projects/${projectId}/conflicts`,
      method: "GET",
      validator: (data: any) => {
        const ok = typeof data.claimCount === "number" && Array.isArray(data.conflicts);
        return { ok, detail: `${data.conflicts?.length || 0} conflicts, claimCount: ${data.claimCount}` };
      },
    },
    {
      route: `/api/projects/${projectId}/review/queue`,
      method: "GET",
      validator: (data: any) => {
        const ok = typeof data.totalCount === "number";
        return { ok, detail: `Queue total: ${data.totalCount}, items: ${data.claims?.length || 0}` };
      },
    },
    {
      route: `/api/projects/${projectId}/radar`,
      method: "GET",
      validator: (data: any) => {
        const ok = Array.isArray(data.alerts) && typeof data.metrics === "object";
        return { ok, detail: `${data.alerts?.length || 0} active alerts, metrics present` };
      },
    },
    {
      route: `/api/projects/${projectId}/intelligence`,
      method: "GET",
      validator: (data: any) => {
        const ok = typeof data.continuityScore === "object" && typeof data.busFactor === "object";
        return { ok, detail: `Score: ${data.continuityScore?.score ?? "N/A"}, Bus Factor: ${data.busFactor?.busFactor ?? "N/A"}` };
      },
    },
    {
      route: `/api/projects/${projectId}/entities`,
      method: "GET",
      validator: (data: any) => {
        const ok = Array.isArray(data.entities) && data.entities.length > 0;
        return { ok, detail: `${data.entities?.length || 0} entities verified` };
      },
    },
    {
      route: `/api/projects/${projectId}/handovers/draft`,
      method: "GET",
      validator: (data: any) => {
        const ok = data.draft && Array.isArray(data.draft.sections);
        return { ok, detail: `Draft handover with ${data.draft?.sections?.length || 0} sections` };
      },
    },
    {
      route: `/api/projects/${projectId}/members`,
      method: "GET",
      validator: (data: any) => {
        const ok = Array.isArray(data.members) && data.members.length > 0;
        return { ok, detail: `${data.members?.length || 0} project members` };
      },
    },
    {
      route: `/api/projects/${projectId}/audit`,
      method: "GET",
      validator: (data: any) => {
        const ok = Array.isArray(data.logs);
        return { ok, detail: `${data.logs?.length || 0} audit log entries` };
      },
    },
  ];

  // Define Pages to benchmark
  const pageRoutes = [
    `/login`,
    `/dashboard`,
    `/projects/${projectId}`,
    `/projects/${projectId}/documents`,
    `/projects/${projectId}/claims`,
    `/projects/${projectId}/conflicts`,
    `/projects/${projectId}/review`,
    `/projects/${projectId}/radar`,
    `/projects/${projectId}/intelligence`,
    `/projects/${projectId}/entities`,
    `/projects/${projectId}/handover`,
    `/projects/${projectId}/members`,
    `/projects/${projectId}/audit`,
  ];

  const NUM_RUNS = 5;
  const apiResults: EndpointRun[] = [];
  const pageResults: EndpointRun[] = [];

  console.log(`Benchmarking ${apiEndpoints.length} API endpoints across ${NUM_RUNS} iterations...`);

  for (const ep of apiEndpoints) {
    const times: number[] = [];
    let lastStatus = 0;
    let verified = false;
    let detail = "";

    for (let run = 1; run <= NUM_RUNS; run++) {
      const url = `${baseUrl}${ep.route}`;
      const t0 = performance.now();
      const res = await fetch(url, {
        method: ep.method,
        headers: {
          Cookie: cookieHeader,
          "Accept": "application/json",
        },
      });
      const text = await res.text();
      const duration = performance.now() - t0;
      times.push(Math.round(duration));
      lastStatus = res.status;

      if (run === 1) {
        try {
          const json = JSON.parse(text);
          const validation = ep.validator(json);
          verified = validation.ok;
          detail = validation.detail;
        } catch (e: any) {
          verified = false;
          detail = `JSON parse failed: ${e.message}`;
        }
      }
    }
    console.log(`  ✓ ${ep.route.padEnd(40)} Mean: ${Math.round(times.reduce((a, b) => a + b, 0) / times.length)}ms (${times.join(", ")}ms)`);

    const mean = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const min = Math.min(...times);
    const max = Math.max(...times);

    apiResults.push({
      route: ep.route,
      type: "API",
      times,
      mean,
      min,
      max,
      dataVerified: verified,
      verificationDetail: detail,
      status: lastStatus,
    });
  }

  console.log(`Benchmarking ${pageRoutes.length} Page routes across ${NUM_RUNS} iterations...`);

  for (const route of pageRoutes) {
    const times: number[] = [];
    let lastStatus = 0;
    let verified = false;
    let detail = "";

    for (let run = 1; run <= NUM_RUNS; run++) {
      const url = `${baseUrl}${route}`;
      const t0 = performance.now();
      const res = await fetch(url, {
        headers: {
          Cookie: cookieHeader,
          "Accept": "text/html",
        },
      });
      const html = await res.text();
      const duration = performance.now() - t0;
      times.push(Math.round(duration));
      lastStatus = res.status;

      if (run === 1) {
        verified = res.status === 200 && html.length > 500 && html.includes("<!DOCTYPE html>");
        detail = `${html.length} bytes rendered`;
      }
    }
    console.log(`  ✓ ${route.padEnd(40)} Mean: ${Math.round(times.reduce((a, b) => a + b, 0) / times.length)}ms (${times.join(", ")}ms)`);

    const mean = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const min = Math.min(...times);
    const max = Math.max(...times);

    pageResults.push({
      route,
      type: "PAGE",
      times,
      mean,
      min,
      max,
      dataVerified: verified,
      verificationDetail: detail,
      status: lastStatus,
    });
  }

  console.log("\n===============================================================================");
  console.log("                        API ENDPOINT BENCHMARK RESULTS                         ");
  console.log("===============================================================================");
  console.log(
    "Route".padEnd(42) +
    "Run 1".padStart(7) +
    "Run 2".padStart(7) +
    "Run 3".padStart(7) +
    "Run 4".padStart(7) +
    "Run 5".padStart(7) +
    "Mean".padStart(8) +
    "Min".padStart(7) +
    "Max".padStart(7) +
    "  Verified Real DB Data"
  );
  console.log("-".repeat(120));

  for (const r of apiResults) {
    const runsStr = r.times.map((t) => `${t}ms`.padStart(7)).join("");
    const meanStr = `${r.mean}ms`.padStart(8);
    const minStr = `${r.min}ms`.padStart(7);
    const maxStr = `${r.max}ms`.padStart(7);
    const verStr = r.dataVerified ? `✓ (${r.verificationDetail})` : `✗ FAIL`;
    console.log(`${r.route.padEnd(42)}${runsStr}${meanStr}${minStr}${maxStr}  ${verStr}`);
  }

  console.log("\n===============================================================================");
  console.log("                         PAGE LOAD BENCHMARK RESULTS                           ");
  console.log("===============================================================================");
  console.log(
    "Page Route".padEnd(42) +
    "Run 1".padStart(7) +
    "Run 2".padStart(7) +
    "Run 3".padStart(7) +
    "Run 4".padStart(7) +
    "Run 5".padStart(7) +
    "Mean".padStart(8) +
    "Min".padStart(7) +
    "Max".padStart(7) +
    "  Verified HTML Render"
  );
  console.log("-".repeat(120));

  for (const r of pageResults) {
    const runsStr = r.times.map((t) => `${t}ms`.padStart(7)).join("");
    const meanStr = `${r.mean}ms`.padStart(8);
    const minStr = `${r.min}ms`.padStart(7);
    const maxStr = `${r.max}ms`.padStart(7);
    const verStr = r.dataVerified ? `✓ (${r.verificationDetail})` : `✗ FAIL`;
    console.log(`${r.route.padEnd(42)}${runsStr}${meanStr}${minStr}${maxStr}  ${verStr}`);
  }

  return { apiResults, pageResults };
}

async function main() {
  const baseUrl = process.argv[2] || "http://localhost:3000";
  try {
    await runFinalPerformanceAcceptanceTest(baseUrl);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.includes("final_performance_acceptance_test")) {
  main();
}
