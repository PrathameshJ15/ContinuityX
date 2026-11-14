import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
  });

// Always reuse the same PrismaClient singleton in all environments to prevent connection pool exhaustion on Neon
globalForPrisma.prisma = prisma;

export default prisma;
