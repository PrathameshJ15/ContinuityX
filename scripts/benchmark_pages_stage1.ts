import { prisma } from "../src/lib/db";
import { createSessionToken } from "../src/lib/auth";

const PROJECT_ID = "cmwdiir940003t1c4i0b29dtg";

interface Measurement {
  route: string;
  type: "PAGE" | "API";
  firstLoadMs: number;
  repeatLoadMs: number;
  status: number;
}

export async function measureRoutes(baseUrl: string): Promise<Measurement[]> {
  const user = await prisma.user.findFirst({ where: { email: "lead@continuityx.demo" } })
    ?? await prisma.user.findFirst();

  if (!user) throw new Error("No user found");

  const token = await createSessionToken({
    id: user.id,
    email: user.email,
    name: user.name,
  });

  const cookieHeader = `continuityx_session=${token}`;

  const routes = [
    { path: "/login", type: "PAGE" as const },
    { path: "/dashboard", type: "PAGE" as const },
    { path: `/projects/${PROJECT_ID}`, type: "PAGE" as const },
    { path: `/projects/${PROJECT_ID}/documents`, type: "PAGE" as const },
    { path: `/projects/${PROJECT_ID}/claims`, type: "PAGE" as const },
    { path: `/projects/${PROJECT_ID}/conflicts`, type: "PAGE" as const },
    { path: `/projects/${PROJECT_ID}/review`, type: "PAGE" as const },
    { path: `/projects/${PROJECT_ID}/radar`, type: "PAGE" as const },
    { path: `/projects/${PROJECT_ID}/intelligence`, type: "PAGE" as const },
    { path: `/projects/${PROJECT_ID}/entities`, type: "PAGE" as const },
    // Backing APIs
    { path: "/api/projects", type: "API" as const },
    { path: `/api/projects/${PROJECT_ID}`, type: "API" as const },
    { path: `/api/projects/${PROJECT_ID}/documents`, type: "API" as const },
    { path: `/api/projects/${PROJECT_ID}/claims`, type: "API" as const },
    { path: `/api/projects/${PROJECT_ID}/conflicts`, type: "API" as const },
    { path: `/api/projects/${PROJECT_ID}/review/queue`, type: "API" as const },
    { path: `/api/projects/${PROJECT_ID}/radar`, type: "API" as const },
    { path: `/api/projects/${PROJECT_ID}/intelligence`, type: "API" as const },
    { path: `/api/projects/${PROJECT_ID}/entities`, type: "API" as const },
  ];

  const results: Measurement[] = [];

  for (const r of routes) {
    const url = `${baseUrl}${r.path}`;

    // First load
    const t0 = performance.now();
    const res1 = await fetch(url, { headers: { Cookie: cookieHeader } });
    await res1.text();
    const firstLoadMs = performance.now() - t0;

    // Repeat load
    const t1 = performance.now();
    const res2 = await fetch(url, { headers: { Cookie: cookieHeader } });
    await res2.text();
    const repeatLoadMs = performance.now() - t1;

    results.push({
      route: r.path,
      type: r.type,
      firstLoadMs: Math.round(firstLoadMs),
      repeatLoadMs: Math.round(repeatLoadMs),
      status: res1.status,
    });
  }

  return results;
}

async function run() {
  const mode = process.argv[2] || "dev";
  const baseUrl = process.argv[3] || "http://localhost:3000";
  console.log(`\n=== BENCHMARKING ROUTES (${mode.toUpperCase()} on ${baseUrl}) ===`);

  try {
    const results = await measureRoutes(baseUrl);
    console.table(results);
  } catch (err) {
    console.error("Benchmark failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.includes("benchmark_pages_stage1")) {
  run();
}
