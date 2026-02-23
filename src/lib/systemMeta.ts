import { prisma } from '@/lib/prisma';

export type SystemMetaValue = Record<string, unknown>;

export async function getSystemMeta<T extends SystemMetaValue>(key: string, fallback: T): Promise<T> {
  try {
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
  await prisma.systemMeta.upsert({
    where: { key },
    create: { key, json: JSON.stringify(value) },
    update: { json: JSON.stringify(value) },
  });
}
