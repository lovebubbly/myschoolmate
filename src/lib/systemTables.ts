import { prisma } from '@/lib/prisma';

const globalForSystemTables = globalThis as typeof globalThis & {
  __myschoolmateEnsureSystemTables?: Promise<void>;
};

async function createSystemMetaTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS SystemMeta (
      key TEXT PRIMARY KEY,
      json TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function createSystemLockTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS SystemLock (
      name TEXT PRIMARY KEY,
      lockedUntil DATETIME,
      lockedBy TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function ensureSystemTables(): Promise<void> {
  if (!globalForSystemTables.__myschoolmateEnsureSystemTables) {
    globalForSystemTables.__myschoolmateEnsureSystemTables = (async () => {
      try {
        await createSystemMetaTable();
        await createSystemLockTable();
      } catch (error) {
        // In read-only DB or restricted environments, fail soft.
        console.warn('[systemTables] ensure failed:', String(error));
      }
    })();
  }

  await globalForSystemTables.__myschoolmateEnsureSystemTables;
}
