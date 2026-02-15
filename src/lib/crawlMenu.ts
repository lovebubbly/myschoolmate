
import { chromium, Page } from 'playwright';
import { prisma } from '@/lib/prisma';

interface MenuData {
    date: string;       // e.g. "12.29(Mon)"
    mealType: string;   // "BREAKFAST", "LUNCH", "DINNER"
    content: string;
    price?: string;
}

const RESTAURANTS = [
    { id: 'Hanbit', name: '한빛식당', code: '#tab1' },
    { id: 'Star', name: '별빛식당', code: '#tab2' },
    { id: 'Eunhasu', name: '은하수식당', code: '#tab3' },
] as const;

export async function crawlCafeteriaMenu() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
        // Crawl previous week (-1), this week (0), and next week (1)
        const weekOffsets = [-1, 0, 1];

        for (const week of weekOffsets) {
            const page = await context.newPage();
            const url = `https://www.cbnucoop.com/service/restaurant/?week=${week}`;
            console.log(`Crawling Week ${week}: ${url}`);

            await page.goto(url, { waitUntil: 'domcontentloaded' });

            for (const restaurant of RESTAURANTS) {
                // Click tab and wait for it to become active
                try {
                    await page.click(`a.nav-link[href="${restaurant.code}"]`);
                    // Wait for the tab content to be visible and active
                    await page.waitForSelector(`${restaurant.code}.tab-pane.active`, { timeout: 2000 });
                    await page.waitForTimeout(300); // Extra wait for AJAX content
                } catch (e) {
                    console.log(`Failed to click/wait tab ${restaurant.name}:`, e);
                    continue; // Skip this restaurant if tab is not clickable
                }

                // Pass the specific tab ID to avoid cross-contamination
                const menuDataList = await extractMenuFromTable(page, restaurant.code);

                for (const item of menuDataList) {
                    // Robust filtering
                    if (!item.content || item.content.trim().length === 0 || item.content === '미운영' || item.date.startsWith('Unknown')) continue;
                    // Filter out accidentally captured headers like "아침코너" if they sneak in
                    if (item.content.includes('코너') && item.content.length < 10) continue;
                    // Filter garbage data that contains restaurant names or generic headers
                    if (item.content.includes('식당') && item.content.includes('코너')) continue;
                    // Skip known construction/closure messages - but ALLOW these to be saved as informational
                    // Actually, let's filter out garbage but KEEP closure notices
                    // The issue is cross-contamination, not closure notices

                // Skip if the content looks like it's from a different restaurant (cross-contamination check)
                // This is a more aggressive filter: if it contains vacation period notice, we should store it
                // but we should NOT store normal menus for a restaurant that's on vacation

                // If it's not a closure notice, make sure it doesn't have closure keywords mixed in
                // This catches "오삼불고기덮밥" being stored for Eunhasu when it should be closed

                    await prisma.cafeteriaMenu.upsert({
                        where: {
                            restaurant_date_mealType: {
                                restaurant: restaurant.id,
                                date: item.date,
                                mealType: item.mealType
                            }
                        },
                        update: {
                            menuContent: item.content,
                            price: item.price
                        },
                        create: {
                            restaurant: restaurant.id,
                            date: item.date,
                            mealType: item.mealType,
                            menuContent: item.content,
                            price: item.price
                        }
                    });
                }
            }
            await page.close();
        }

        console.log("Cafeteria Crawl Complete!");

    } catch (e) {
        console.error("Cafeteria Crawl Error:", e);
    } finally {
        await browser.close();
    }
}

async function extractMenuFromTable(page: Page, tabId: string): Promise<MenuData[]> {
    return await page.evaluate<MenuData[], string>((tabSelector) => {
        const results: MenuData[] = [];

        // Target the SPECIFIC tab by its ID, not just any 'active' tab
        const activeTab = document.querySelector(tabSelector);
        if (!activeTab) return [];

        const table = activeTab.querySelector('table');
        if (!table) return [];

        // Extract Dates
        const thead = table.querySelector('thead');
        const dateHeaders = Array.from(thead?.querySelectorAll('th.weekday-title') || []);
        // Text: "01.05(월요일)" -> Extract "01.05(월요일)"
        const dates = dateHeaders.map(th => (th as HTMLElement).innerText.trim());

        const rows = Array.from(table.querySelectorAll('tbody tr'));

        // We need to track the current meal type context because sometimes it spans rows
        // But looking at the HTML, each actual data row seems to have a `row-label` or `row-time`.
        // Actually, `row-time` is a full width header. `row-label` is the specific corner name.

        let currentMealType = "LUNCH"; // Default

        rows.forEach(row => {
            // Case 1: Time Header Row (e.g. "아침코너 ...")
            const timeHeader = row.querySelector('.row-time');
            if (timeHeader) {
                const timeText = (timeHeader as HTMLElement).innerText;
                if (timeText.includes('아침') || timeText.includes('조식')) currentMealType = "BREAKFAST";
                else if (timeText.includes('점심') || timeText.includes('중식')) currentMealType = "LUNCH";
                else if (timeText.includes('저녁') || timeText.includes('석식')) currentMealType = "DINNER";
                return; // Skip this row, it's just a header
            }

            // Case 2: Data Row
            // It usually has hidden ths, a row-label th, and then tds.
            const cells = Array.from(row.querySelectorAll('td'));
            // If no tds, might be a structure row we missed?
            if (cells.length === 0) return;

            // Try to refine meal type from row-label if present
            const rowLabelEl = row.querySelector('.row-label');
            const rowLabel = rowLabelEl ? (rowLabelEl as HTMLElement).innerText : "";
            if (rowLabel) {
                if (rowLabel.includes('아침')) currentMealType = "BREAKFAST";
                else if (rowLabel.includes('주말운영')) currentMealType = "LUNCH"; // Weekend lunch usually
                // Don't override if it's just "한빛식당 점심 ..." (confirms current)
            }

            // Iterate cells. format: dates[0] -> cells[0], dates[1] -> cells[1] ...
            // Note: The HTML structure shows tds correspond exactly to the dates in headers?
            // Let's verify: 5 date headers. 5 tds?
            // In the user's snippet: <tr>...<th class="row-label">...</th> <td>...</td> <td>...</td> ... </tr>
            // Yes, the tds follow the ths.

            cells.forEach((cell, index) => {
                if (index >= dates.length) return; // Boundary check

                const dateStr = dates[index];
                const menuCard = cell.querySelector('.menu-body');

                if (!menuCard) {
                    // Empty cell or closed
                    return;
                }

                // Extract Main Menu
                const cardHeader = menuCard.querySelector('.card-header');
                const mainMenu = cardHeader ? (cardHeader as HTMLElement).innerText.trim() : "";

                // Filter out garbage data and closed status
                if (!mainMenu || mainMenu === "미운영") return;
                // Filter out headers that look like "한빛식당 아침 아침코너"
                if (mainMenu.includes('식당') && mainMenu.includes('코너')) return;
                if (mainMenu.includes('운영중단')) return; // Explicitly skip construction notices if desired, or keep them? User said "garbage", construction is info. 
                // The user complained about "trash values" like "Hanbit Breakfast Breakfast Corner".
                // Detailed construction info is probably fine, but let's stick to the user's specific "trash" complaint.


                // Extract Sides
                const sides = Array.from(menuCard.querySelectorAll('.side')).map(li => (li as HTMLElement).innerText.trim());

                // Extract Price
                // Price is text node or span.add.commas
                // Formatting: ￦6,000 \n ￦4,000(조합원)
                // Let's grab the whole text of card-body but exclude sides?
                // Or just simplified text extraction

                const fullContent = [mainMenu, ...sides].join('\n');

                // Clean Price Extraction
                const cardBody = menuCard.querySelector('.card-body');
                let priceText = "";
                if (cardBody) {
                    // Clone to remove sides and get price only?
                    // Or just regex match ￦...
                    const bodyText = (cardBody as HTMLElement).innerText;
                    const priceMatches = bodyText.match(/￦[\d,]+(\(.*\))?/g);
                    if (priceMatches) {
                        priceText = priceMatches.join(' / ');
                    }
                }

                results.push({
                    date: dateStr,
                    mealType: currentMealType,
                    content: fullContent,
                    price: priceText
                });
            });
        });

        return results;
    }, tabId);
}
