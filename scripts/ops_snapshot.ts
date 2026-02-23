import 'dotenv/config';

async function main() {
  // Avoid Prisma query logs and keep CLI output clean.
  (process.env as Record<string, string | undefined>).NODE_ENV = process.env.NODE_ENV || 'production';

  // If the consumer closes the pipe early (e.g. `| head`), exit quietly.
  process.stdout.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EPIPE') process.exit(0);
    throw error;
  });

  const { prisma } = await import('@/lib/prisma');
  try {
    const { getOpsSnapshot } = await import('@/lib/opsSnapshot');
    const snapshot = await getOpsSnapshot();
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[ops_snapshot] failed:', error);
  process.exitCode = 1;
});
