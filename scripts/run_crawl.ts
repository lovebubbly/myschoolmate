
import 'dotenv/config';
import { crawlNotices } from '@/lib/crawler';

async function run() {
    console.log('Starting population...');
    await crawlNotices({ refreshExisting: true });
    console.log('Done.');
    process.exit(0);
}

run();
