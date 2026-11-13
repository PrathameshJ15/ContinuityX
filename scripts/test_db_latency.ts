import net from "net";
import { prisma } from "../src/lib/db";

async function testLatency() {
  const host = "ep-misty-morning-bd6go3sz-pooler.c-8.us-east-2.aws.neon.tech";
  const port = 5432;

  console.log(`[TCP] Testing TCP connect to ${host}:${port}...`);
  const tcpPromise = new Promise<number>((resolve, reject) => {
    const start = performance.now();
    const socket = net.createConnection({ host, port }, () => {
      const elapsed = performance.now() - start;
      socket.end();
      resolve(elapsed);
    });
    socket.setTimeout(10000, () => {
      socket.destroy();
      reject(new Error("TCP connection timeout after 10s"));
    });
    socket.on("error", reject);
  });

  const tcpTime = await tcpPromise;
  console.log(`[TCP] TCP Connect time: ${tcpTime.toFixed(2)} ms`);

  // Direct raw query vs Prisma query
  console.log("\n[Prisma] Testing warm Prisma raw $queryRaw `SELECT 1` (5 iterations)...");
  for (let i = 1; i <= 5; i++) {
    const qStart = performance.now();
    await prisma.$queryRaw`SELECT 1 as result`;
    const qEnd = performance.now();
    console.log(`[Prisma Query ${i}] $queryRaw SELECT 1: ${(qEnd - qStart).toFixed(2)} ms`);
  }

  // Testing direct URL vs pooler URL
  console.log("\nDone latency test.");
}

testLatency()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
