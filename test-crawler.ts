import { crawlNotices } from './src/lib/crawler';

async function main() {
    try {
        console.log('Starting crawler test...');
        const notices = await crawlNotices();
        console.log('Crawling completed. Results:');
        console.log(JSON.stringify(notices, null, 2));
    } catch (error) {
        console.error('Crawling failed:', error);
    }
}

main();
