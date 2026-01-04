
import { crawlNotices } from './src/lib/crawler';
import { prisma } from './src/lib/prisma';

async function main() {
    console.log("Starting test crawl...");
    try {
        const results = await crawlNotices();
        console.log("Crawl finished. Total results:", results.length);
        console.log("Details:", JSON.stringify(results.map(r => ({ title: r.title, url: r.url })), null, 2));
    } catch (e) {
        console.error("Crawl failed:", e);
    }
}

main();
