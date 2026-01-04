
import 'dotenv/config';
import { crawlNotices } from '@/lib/crawler';

async function run() {
    console.log('Starting population...');
    await crawlNotices('cisub5_1', '407'); // Academic
    await crawlNotices('cisub5_1', '408'); // Scholarship
    console.log('Done.');
    process.exit(0);
}

run();
