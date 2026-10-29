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

/**
 * A SERVER NEEDS A POOL; A ONE-SHOT JOB DOES NOT.
 *
 * pg defaults to ten connections. That is reasonable for a long-lived server
 * answering concurrent requests, and wasteful for a scheduled job that runs a
 * handful of queries in series and exits -- it claims ten slots against a
 * shared limit for the duration.
 *
 * It stops being merely wasteful when such a job restarts in a loop, which is
 * how this surfaced: "Too many database connections opened", P2037, with the
 * web app and the scheduler competing for what was left.
 *
 * NEXT_RUNTIME is set inside Next and nowhere else, so the scripts get two.
 */
const isServer = process.env.NEXT_RUNTIME !== undefined;

const pool = new Pool({
  connectionString: databaseUrl,
  max: Number(process.env.DATABASE_POOL_MAX ?? (isServer ? 10 : 2)),
  // Hand idle connections back rather than holding a slot until the process
  // ends; a job that pauses 60s between credit windows would otherwise sit on
  // them for the whole wait.
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 15_000,
  // Explicitly set SSL for Prisma Postgres
  ssl: databaseUrl?.includes('prisma.io') ? { rejectUnauthorized: false } : undefined,
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



