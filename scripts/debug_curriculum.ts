
import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();
    const url = 'https://inform.chungbuk.ac.kr/index.php?mid=cisub2_1';

    try {
        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle' }); // Wait for network idle
        console.log("Page loaded.");

        await page.screenshot({ path: 'debug_screenshot.png' });
        const content = await page.content();
        fs.writeFileSync('debug_page.html', content);

        console.log("Saved debug_screenshot.png and debug_page.html");

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
