import { PrismaClient, ProjectRole, ProjectStatus } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("[Seed] Seeding synthetic demo data...");

  const passwordHash = await hash("DemoPassword123!", 10);

  // 1. Create or update Demo User A (Tech Lead / Owner)
  const userLead = await prisma.user.upsert({
    where: { email: "lead@continuityx.demo" },
    update: {
      name: "Arjun Mehta (Lead)",
      passwordHash,
    },
    create: {
      name: "Arjun Mehta (Lead)",
      email: "lead@continuityx.demo",
      passwordHash,
    },
  });

  // 2. Create or update Demo User B (Engineer / Reviewer)
  const userMember = await prisma.user.upsert({
    where: { email: "member@continuityx.demo" },
    update: {
      name: "Riya Sharma (Engineer)",
      passwordHash,
    },
    create: {
      name: "Riya Sharma (Engineer)",
      email: "member@continuityx.demo",
      passwordHash,
    },
  });

  // 3. Create Synthetic Demo Project
  const existingProject = await prisma.project.findFirst({
    where: {
      name: "Smart Attendance System (Synthetic Demo)",
      createdBy: userLead.id,
    },
  });

  let project = existingProject;

  if (!project) {
    project = await prisma.project.create({
      data: {
        name: "Smart Attendance System (Synthetic Demo)",
        description:
          "[SYNTHETIC FIXTURE] Automated attendance recording platform combining RFID badge scans and facial verification. Used for benchmark and demo testing.",
        status: ProjectStatus.ACTIVE,
        createdBy: userLead.id,
        members: {
          create: [
            {
              userId: userLead.id,
              role: ProjectRole.OWNER,
            },
            {
              userId: userMember.id,
              role: ProjectRole.REVIEWER,
            },
          ],
        },
      },
    });

    console.log(`[Seed] Created synthetic demo project: ${project.id}`);
  } else {
    console.log(`[Seed] Synthetic demo project already exists: ${project.id}`);
  }

  console.log("[Seed] Synthetic demo seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("[Seed] Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
