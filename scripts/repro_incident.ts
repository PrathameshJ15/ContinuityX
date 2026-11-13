import { prisma } from "../src/lib/db";
import { createSessionToken } from "../src/lib/auth";

async function testAllApis() {
  console.log("=== TESTING ALL APIS FROM REPRO SCRIPT ===");

  const user = await prisma.user.findFirst({ where: { email: "owner@demo.continuityx.com" } }) 
    ?? await prisma.user.findFirst();

  if (!user) {
    console.log("No user found!");
    return;
  }

  const token = await createSessionToken({
    id: user.id,
    email: user.email,
    name: user.name,
  });

  const cookieHeader = `continuityx_session=${token}`;
  const baseUrl = "http://localhost:3000";

  console.log(`User: ${user.name} (${user.email})`);

  // 1. GET /api/projects
  const pRes = await fetch(`${baseUrl}/api/projects`, {
    headers: { Cookie: cookieHeader },
  });
  console.log(`GET /api/projects -> Status: ${pRes.status}`);
  const pJson = await pRes.json();
  console.log("Projects response:", JSON.stringify(pJson).slice(0, 200));

  const projects = pJson.data?.projects;
  if (!projects || projects.length === 0) {
    console.log("ERROR: No projects returned from /api/projects!");
    return;
  }

  const projectId = projects[0].id;
  console.log(`\nTesting with Project ID: ${projectId} (${projects[0].name})\n`);

  const endpoints = [
    `/api/projects/${projectId}`,
    `/api/projects/${projectId}/documents`,
    `/api/projects/${projectId}/claims`,
    `/api/projects/${projectId}/conflicts`,
    `/api/projects/${projectId}/review/queue`,
    `/api/projects/${projectId}/radar`,
    `/api/projects/${projectId}/intelligence`,
    `/api/projects/${projectId}/entities`,
    `/api/projects/${projectId}/members`,
    `/api/projects/${projectId}/audit`,
  ];

  for (const ep of endpoints) {
    const res = await fetch(`${baseUrl}${ep}`, {
      headers: { Cookie: cookieHeader },
    });
    const json = await res.json();
    console.log(`GET ${ep} -> Status: ${res.status}`);
    if (!res.ok) {
      console.log(`  ERROR:`, JSON.stringify(json));
    } else {
      const keys = Object.keys(json.data || {});
      console.log(`  SUCCESS data keys: [${keys.join(", ")}]`);
      if (ep.includes("documents")) console.log(`  Documents count: ${json.data?.documents?.length}`);
      if (ep.includes("claims")) console.log(`  Claims count: ${json.data?.claims?.length}`);
      if (ep.includes("conflicts")) console.log(`  Conflicts count: ${json.data?.conflicts?.length}`);
      if (ep.includes("review/queue")) console.log(`  Queue count: ${json.data?.queue?.length}`);
      if (ep.includes("radar")) console.log(`  Radar alerts count: ${json.data?.alerts?.length}`);
      if (ep.includes("entities")) console.log(`  Entities count: ${json.data?.entities?.length}`);
      if (ep.includes("members")) console.log(`  Members count: ${json.data?.members?.length}`);
      if (ep.includes("audit")) console.log(`  Audit events count: ${json.data?.events?.length}`);
    }
  }
}

testAllApis()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
