import { prisma } from "../src/lib/db";
import { createSessionToken } from "../src/lib/auth";

async function testFrontendPages() {
  console.log("=== TESTING FRONTEND PAGE RENDERING ===");

  const user = await prisma.user.findFirst({
    where: { email: "lead@continuityx.demo" },
  });

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

  const project = await prisma.project.findFirst({
    where: { name: { contains: "Smart Attendance" } },
  });

  if (!project) {
    console.log("No project found!");
    return;
  }

  const pages = [
    "/dashboard",
    `/projects/${project.id}`,
    `/projects/${project.id}/documents`,
    `/projects/${project.id}/claims`,
    `/projects/${project.id}/conflicts`,
    `/projects/${project.id}/review`,
    `/projects/${project.id}/radar`,
    `/projects/${project.id}/intelligence`,
    `/projects/${project.id}/handover`,
    `/projects/${project.id}/entities`,
    `/projects/${project.id}/members`,
    `/projects/${project.id}/audit`,
  ];

  for (const page of pages) {
    const res = await fetch(`${baseUrl}${page}`, {
      headers: { Cookie: cookieHeader },
    });
    console.log(`Page ${page} -> Status: ${res.status}`);
    const text = await res.text();
    console.log(`  HTML length: ${text.length} bytes`);
    if (text.includes("Error") || text.includes("error")) {
      console.log(`  Contains 'Error' string: yes`);
    }
  }
}

testFrontendPages().catch(console.error).finally(() => prisma.$disconnect());
