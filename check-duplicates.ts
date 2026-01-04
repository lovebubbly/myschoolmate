
import { prisma } from './src/lib/prisma';

async function main() {
    const notices = await prisma.notice.findMany({
        select: { id: true, title: true, url: true }
    });

    const titleMap = new Map<string, string[]>();

    notices.forEach(n => {
        if (!titleMap.has(n.title)) {
            titleMap.set(n.title, []);
        }
        titleMap.get(n.title)?.push(n.url);
    });

    console.log("Duplicate Check:");
    let duplicateCount = 0;
    for (const [title, urls] of titleMap.entries()) {
        if (urls.length > 1) {
            console.log(`\nTitle: ${title}`);
            console.log(`Count: ${urls.length}`);
            urls.forEach(u => console.log(` - ${u}`));
            duplicateCount++;
        }
    }

    if (duplicateCount === 0) {
        console.log("No duplicates found by title.");
    }
}

main();
