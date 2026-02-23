import 'dotenv/config';

async function run() {
    // Avoid Prisma query logs and keep CLI output clean.
    (process.env as Record<string, string | undefined>).NODE_ENV = process.env.NODE_ENV || 'production';

    // If the consumer closes the pipe early (e.g. `| head`), exit quietly.
    process.stdout.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EPIPE') process.exit(0);
        throw error;
    });

    const { prisma } = await import('@/lib/prisma');
    const { runDomFingerprintCapture } = await import('@/lib/noticeDomFingerprint');

    try {
        const boards = await runDomFingerprintCapture();
        console.log(JSON.stringify({ success: true, boards }, null, 2));
    } finally {
        await prisma.$disconnect();
    }
}

run().catch((error) => {
    console.error('[dom_fingerprint] failed', error);
    process.exitCode = 1;
});
