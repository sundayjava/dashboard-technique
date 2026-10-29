import { Prisma } from '@prisma/client';

/**
 * Retry a read that failed for a transient connection reason.
 *
 * This database is Prisma Postgres reached through a proxy, and it drops
 * idle connections and occasionally fails DNS. Both surface as a thrown
 * Prisma error rather than a slow query, and both succeed immediately on a
 * second attempt. Without this, every blip is a 500 the member sees -- which
 * is what "sometimes it shows a server error" on a page that otherwise works
 * actually is.
 *
 * ONLY TRANSPORT FAILURES ARE RETRIED. A constraint violation, a missing
 * record or a bad query is a real answer and retrying it would just produce
 * the same answer a moment later while doubling the latency of the failure.
 *
 * Reads only. A write that failed mid-flight may or may not have landed, and
 * replaying it could double a contribution or a credit; those belong in a
 * transaction with an idempotency key, not in a retry helper.
 */

/** Prisma codes that mean "the connection went away", not "the query is wrong". */
const TRANSIENT_CODES = new Set([
  'P1001', // Can't reach database server
  'P1002', // Database server timed out
  'P1017', // Server has closed the connection
  'P2024', // Timed out fetching a connection from the pool
]);

function isTransient(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return TRANSIENT_CODES.has(error.code);
  }
  // Initialisation failures and DNS blips arrive as a different class, or as
  // a plain Error carrying the resolver's message.
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Error) {
    return /EAI_AGAIN|ECONNRESET|ETIMEDOUT|Server has closed the connection/i.test(
      error.message,
    );
  }
  return false;
}

export async function withDbRetry<T>(
  operation: () => Promise<T>,
  { attempts = 2, delayMs = 150 }: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !isTransient(error)) throw error;
      console.warn(
        `[db-retry] transient failure on attempt ${attempt}/${attempts}: ` +
          `${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }

  throw lastError;
}
