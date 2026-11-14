import { prisma } from "../src/lib/db";
import { createSessionToken } from "../src/lib/auth";

async function test() {
  const user = await prisma.user.findFirst({ where: { email: "lead@continuityx.demo" } });
  if (!user) throw new Error("No user");
  const project = await prisma.project.findFirst({ where: { name: "Smart Attendance System (Synthetic Demo)" } });
  if (!project) throw new Error("No project");
  const token = await createSessionToken({ id: user.id, email: user.email, name: user.name });

  const res = await fetch("http://localhost:3000/projects/" + project.id, {
    headers: { Cookie: "continuityx_session=" + token }
  });
  console.log("Page Status:", res.status);
  const html = await res.text();
  console.log("Full HTML length:", html.length);
  // Search for error in HTML
  if (html.includes("error") || html.includes("Error") || res.status !== 200) {
    console.log("HTML:", html.slice(0, 1000));
  }
}

test().catch(console.error).finally(() => prisma.$disconnect());
