import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

/**
 * Required at runtime, deliberately NOT during a build.
 *
 * This module is imported by every API route, and Next imports every route
 * while collecting page data, so a bare module-level throw fails the BUILD
 * rather than a request -- on Vercel, in Docker, and in CI, each time with
 * "Failed to collect page data" naming whichever route happened to be first.
 *
 * Nothing connects during a build: collecting page data only loads modules.
 * So the check moves to the first real use, where a missing URL is a genuine
 * misconfiguration rather than an artefact of how Next compiles.
 */
const BUILDING = process.env.NEXT_PHASE === 'phase-production-build';

if (!databaseUrl && !BUILDING) {
  throw new Error('DATABASE_URL is not defined in environment variables');
}

const pool = new Pool({ 
  connectionString: databaseUrl,
  // Explicitly set SSL for Prisma Postgres
  ssl: databaseUrl?.includes('prisma.io') ? { rejectUnauthorized: false } : undefined
});

const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;



