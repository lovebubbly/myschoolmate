import { chromium } from 'playwright';

export interface NoticeData {
    title: string;
    url: string;
    category: string;
    date: string;
}

export async function crawlNotices(): Promise<NoticeData[]> {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Target: General Notices
    // URL: https://inform.chungbuk.ac.kr/cisub5_2
    const targetUrl = 'https://inform.chungbuk.ac.kr/cisub5_2';

    console.log(`Navigating to ${targetUrl}...`);
    try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait for the table to appear. The user mentioned structure for curriculum, but for notices it's likely similar.
        // Let's inspect generic table rows first or print body if fails.
        // Common k-uni board structure: table tbody tr
        await page.waitForSelector('table tbody tr', { timeout: 5000 });

        const notices = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('table tbody tr'));

            return rows.map(row => {
                // Try to find title and date. 
                // This is a "blind" selector attempt based on common structures.
                // We will refine this after seeing the first successful run output.
                const links = row.querySelectorAll('a');
                let title = '';
                let linkUrl = '';

                // Usually the title is the text of the main link
                for (const link of links) {
                    if (link.textContent && link.textContent.trim().length > 5) {
                        title = link.textContent.trim();
                        linkUrl = link.getAttribute('href') || '';
                        break;
                    }
                }

                // Date is often in the last or second to last column
                const cells = row.querySelectorAll('td');
                const date = cells[cells.length - 2]?.textContent?.trim() || // 2nd to last often date
                    cells[cells.length - 1]?.textContent?.trim() || // last often hits or date
                    '';

                const category = 'General';

                if (!title) return null;

                return {
                    title,
                    url: linkUrl.startsWith('http') ? linkUrl : `https://inform.chungbuk.ac.kr${linkUrl}`,
                    date,
                    category
                };
            }).filter(n => n !== null) as NoticeData[];
        });

        console.log(`Found ${notices.length} notices.`);
        await browser.close();
        return notices.slice(0, 5);

    } catch (error) {
        console.error("Error during crawling:", error);
        // Capture page content for debugging if it fails
        // const content = await page.content(); 
        // console.log("Page Content Snippet:", content.slice(0, 500));
        await browser.close();
        throw error;
    }
}
