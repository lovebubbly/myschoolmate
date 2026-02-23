import { prisma } from '@/lib/prisma';
import { ensureSystemTables } from '@/lib/systemTables';

export type SystemMetaValue = Record<string, unknown>;

export async function getSystemMeta<T extends SystemMetaValue>(key: string, fallback: T): Promise<T> {
  try {
    await ensureSystemTables();
    const row = await prisma.systemMeta.findUnique({
      where: { key },
      select: { json: true },
    });
    if (!row?.json) return fallback;
    const parsed = JSON.parse(row.json) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export async function setSystemMeta(key: string, value: SystemMetaValue): Promise<void> {
  try {
    await ensureSystemTables();
    await prisma.systemMeta.upsert({
      where: { key },
      create: { key, json: JSON.stringify(value) },
      update: { json: JSON.stringify(value) },
    });
  } catch (error) {
    console.warn('[systemMeta] set failed:', String(error));
  }
}
