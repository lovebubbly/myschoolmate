import { prisma } from '@/lib/prisma';
import { ensureSystemTables } from '@/lib/systemTables';

const DEFAULT_LOCK_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function tryAcquireSystemLock(name: string, ttlMs: number = DEFAULT_LOCK_TTL_MS): Promise<boolean> {
  await ensureSystemTables();

  const now = new Date();
  const lockedUntil = new Date(now.getTime() + ttlMs);
  const lockedBy = process.env.HOSTNAME || process.env.VERCEL_REGION || 'local';

  try {
    return await prisma.$transaction(async (tx) => {
      // Ensure row exists.
      await tx.systemLock.upsert({
        where: { name },
        create: { name, lockedUntil: new Date(0), lockedBy },
        update: {},
      });

      const result = await tx.systemLock.updateMany({
        where: {
          name,
          OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
        },
        data: { lockedUntil, lockedBy },
      });

      return result.count > 0;
    });
  } catch (error) {
    console.warn('[systemLock] acquire failed:', String(error));
    return false;
  }
}

export async function releaseSystemLock(name: string): Promise<void> {
  try {
    await ensureSystemTables();
    await prisma.systemLock.update({
      where: { name },
      data: { lockedUntil: new Date(0) },
    });
  } catch {
    // ignore
  }
}

export async function getSystemLock(name: string): Promise<{ lockedUntil: Date | null; lockedBy: string | null } | null> {
  try {
    await ensureSystemTables();
    const row = await prisma.systemLock.findUnique({
      where: { name },
      select: { lockedUntil: true, lockedBy: true },
    });
    if (!row) return null;
    return {
      lockedUntil: row.lockedUntil ?? null,
      lockedBy: row.lockedBy ?? null,
    };
  } catch (error) {
    console.warn('[systemLock] get failed:', String(error));
    return null;
  }
}
