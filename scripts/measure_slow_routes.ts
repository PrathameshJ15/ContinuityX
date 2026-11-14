import { env } from "../src/lib/env";

async function measure() {
  console.log("=== MEASURING API TIMINGS ===");
  
  // 1. Login
  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "lead@continuityx.demo",
      password: "DemoPassword123!",
    }),
  });
  
  const cookie = loginRes.headers.get("set-cookie") || "";
  console.log("Login HTTP:", loginRes.status, "Cookie obtained:", cookie ? "Yes" : "No");

  const projectId = "cmwdiir940003t1c4i0b29dtg";
  const routes = [
    `/api/projects/${projectId}/documents`,
    `/api/projects/${projectId}/entities`,
    `/api/projects/${projectId}/intelligence`,
    `/api/projects/${projectId}/handovers/draft`,
    `/api/projects/${projectId}/conflicts`,
    `/api/projects/${projectId}/radar`,
    `/api/projects/${projectId}/review/queue`,
  ];

  for (const r of routes) {
    const t0 = performance.now();
    const res = await fetch(`http://localhost:3000${r}`, {
      headers: { cookie },
    });
    const dur1 = Math.round(performance.now() - t0);
    const json = await res.json().catch(() => ({}));
    
    // Repeat immediately to check warm cache
    const t1 = performance.now();
    const res2 = await fetch(`http://localhost:3000${r}`, {
      headers: { cookie },
    });
    const dur2 = Math.round(performance.now() - t1);

    console.log(`${r}:`);
    console.log(`  First: ${dur1} ms (status ${res.status}) | Repeat: ${dur2} ms (status ${res2.status})`);
  }
}

measure().catch(console.error);
