import { PrismaClient } from "@prisma/client";

async function testDirect() {
  const p = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL } },
  });

  const c = await p.document.count();
  console.log("Direct doc count:", c);
  const docs = await p.document.findMany({ select: { fileName: true, processingStatus: true } });
  console.log("Docs:", docs);
  await p.$disconnect();
}

testDirect().catch(console.error);
