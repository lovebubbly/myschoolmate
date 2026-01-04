import path from 'path';
import dotenv from 'dotenv';

// Explicitly load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { crawlNotices } from './crawler';

async function main() {
    console.log('Starting crawler test...');
    console.log('CWD:', process.cwd());
    console.log('Env Path:', path.resolve(process.cwd(), '.env'));
    const envConfig = dotenv.config({ path: path.resolve(process.cwd(), '.env') });
    console.log('Dotenv parsed keys:', envConfig.parsed ? Object.keys(envConfig.parsed) : 'None');
    console.log('API Key Present:', !!process.env.GEMINI_API_KEY);
    if (!process.env.GEMINI_API_KEY) {
        console.error('ERROR: GEMINI_API_KEY is missing. Please check your .env file.');
        process.exit(1);
    }
    try {
        const notices = await crawlNotices();
        console.log('Crawled notices:', notices.length);
        console.log('First notice:', JSON.stringify(notices[0], null, 2));
    } catch (e) {
        console.error('Test failed:', e);
    }
}

main();
