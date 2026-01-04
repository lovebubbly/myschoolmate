
import { prisma } from './src/lib/prisma';

async function main() {
    console.log("Starting cleanup...");

    // Get all notices
    const notices = await prisma.notice.findMany({
        orderBy: { createdAt: 'desc' } // Keep newest or oldest? Maybe oldest has stable URL? Actually newest might be better?
        // Let's keep the one that looks "normalized" if possible, or just the first one.
    });

    const parsedMap = new Map<string, typeof notices[0]>();
    const toDeleteIds: number[] = [];

    const normalizeUrl = (rawUrl: string) => {
        try {
            const u = new URL(rawUrl);
            u.searchParams.delete('page');
            return u.toString();
        } catch (e) {
            return rawUrl;
        }
    };

    for (const notice of notices) {
        const normUrl = normalizeUrl(notice.url);

        if (parsedMap.has(normUrl)) {
            // Duplicate! Mark for deletion
            toDeleteIds.push(notice.id);
        } else {
            parsedMap.set(normUrl, notice);
        }
    }

    console.log(`Found ${toDeleteIds.length} duplicates to delete.`);

    if (toDeleteIds.length > 0) {
        await prisma.notice.deleteMany({
            where: { id: { in: toDeleteIds } }
        });
        console.log("Deleted duplicates.");
    }

    // Also, update the remaining ones to have normalized URLs?
    // If we don't, next crawl might duplicate them again if it normalizes.
    // Yes, we should update them.

    console.log("Normalizing URLs for remaining notices...");
    for (const [normUrl, notice] of parsedMap.entries()) {
        if (notice.url !== normUrl) {
            try {
                await prisma.notice.update({
                    where: { id: notice.id },
                    data: { url: normUrl }
                });
            } catch (e) {
                console.log(`Failed to update URL for ${notice.id} (maybe conflict?):`, e);
            }
        }
    }
    console.log("Cleanup done!");
}

main();
