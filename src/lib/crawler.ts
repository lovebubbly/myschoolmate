
import { chromium, Page } from 'playwright';
import { prisma } from '@/lib/prisma';
import { analyzeNotice, formatNoticeContent } from './gemini';

export interface NoticeData {
    title: string;
    url: string;
    category: string;
    date: string;
    summary?: string;
    minGrade?: number | null;
    maxIncome?: number | null;
    scholarshipType?: string;
    applicationDeadline?: string | null;
    minGpa?: number | null;
    body?: string;
    isPinned: boolean;
}

const BOARDS = [
    { name: 'Academic/Scholarship', url: 'https://inform.chungbuk.ac.kr/cisub5_1' },
    { name: 'General', url: 'https://inform.chungbuk.ac.kr/cisub5_2' },
    { name: 'Employment', url: 'https://inform.chungbuk.ac.kr/cisub5_3' },
    { name: 'News', url: 'https://inform.chungbuk.ac.kr/cisub5_4' }
];

export async function crawlNotices(targetBoard?: string, targetPage?: string): Promise<NoticeData[]> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    let allNotices: NoticeData[] = [];

    // Helper for navigation with retries
    async function safeNavigate(page: Page, url: string, retries = 2) {
        for (let i = 0; i <= retries; i++) {
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                return;
            } catch (e) {
                if (i === retries) throw e;
                console.log(`Retry navigating to ${url} (${i + 1}/${retries})`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }

    try {
        for (const board of BOARDS) {
            let pageNum = 1;
            let boardProcessedCount = 0;
            const MAX_NOTICES_PER_BOARD = 100;
            let stopBoard = false;

            while (boardProcessedCount < MAX_NOTICES_PER_BOARD && !stopBoard) {
                const pageUrl = `${board.url}?page=${pageNum}`;
                console.log(`Crawling ${board.name} (Page ${pageNum}): ${pageUrl}`);

                try {
                    await safeNavigate(page, pageUrl);
                } catch (err) {
                    console.error(`Failed to navigate to board ${board.name} page ${pageNum}`, err);
                    break; // Move to next board if page fails
                }

                // Wait for list
                try {
                    await page.waitForSelector('table tbody tr', { timeout: 10000 });
                } catch (e) {
                    console.log(`Timeout waiting for table on ${board.name} page ${pageNum} (Method 1). Checking empty state...`);
                    // If no table, maybe empty page or wrong selector? simpler break for now
                    break;
                }

                const links = await page.evaluate(() => {
                    const rows = Array.from(document.querySelectorAll('table tbody tr'));
                    // ... logic to extract ...
                    return rows.map(row => {
                        const linkEl = row.querySelector('td.subject a') || row.querySelector('td.td_subject a') || row.querySelector('a');
                        const dateEl = row.querySelectorAll('td')[row.querySelectorAll('td').length - 2];

                        if (!linkEl) return null;

                        const title = linkEl.textContent?.trim() || '';
                        const href = linkEl.getAttribute('href');
                        const date = dateEl?.textContent?.trim() || '';
                        const firstTd = row.querySelector('td');
                        const firstTdText = firstTd ? firstTd.innerText.trim() : '';

                        if (!href) return null;

                        // Check if it's a "Notice" (Gongji) pinned item by checking an icon or structure if possible.
                        // Ideally we only want new regular items on pages > 1, but pinned items appear on every page.
                        // Simple heuristic: If title starts with "[공지]", it might be pinned. 
                        // But we remove [공지] text below.
                        // Let's just grab them all; the "processed" check handles duplicates efficiently.


                        const isPinned = row.classList.contains('notice') || firstTdText === '공지';

                        return {
                            title: title.replace(/^\[공지\]\s*/, ''),
                            url: href.startsWith('http') ? href : `https://inform.chungbuk.ac.kr${href}`,
                            date,
                            isPinned
                        };
                    }).filter(l => l !== null);
                });

                if (links.length === 0) {
                    console.log(`No links found on ${board.name} page ${pageNum}. Stopping board.`);
                    break;
                }

                // Deep Crawl for Content
                let newItemsOnThisPage = 0;

                for (const link of links) {
                    if (!link) continue;
                    if (boardProcessedCount >= MAX_NOTICES_PER_BOARD) {
                        stopBoard = true;
                        break;
                    }


                    // Incremental Check
                    // Normalize URL by removing 'page' parameter
                    const normalizeUrl = (rawUrl: string) => {
                        try {
                            const u = new URL(rawUrl);
                            u.searchParams.delete('page');
                            return u.toString();
                        } catch (e) {
                            return rawUrl;
                        }
                    };

                    const normalizedUrl = normalizeUrl(link.url);

                    const existing = await prisma.notice.findFirst({
                        where: {
                            OR: [
                                { url: link.url },
                                { url: normalizedUrl }
                            ]
                        }
                    });

                    if (existing && existing.processed) {
                        // Update isPinned status even if already processed
                        if (existing.isPinned !== link.isPinned) {
                            await prisma.notice.update({
                                where: { id: existing.id },
                                data: { isPinned: link.isPinned }
                            });
                        }
                        console.log(`Skipping existing: ${link.title}`);
                        continue;
                    }

                    // ... (rest of the loop) ...

                    try {
                        const detailPage = await context.newPage();
                        await safeNavigate(detailPage, link.url);

                        // ... (content extraction) ...

                        const bodyContent = await detailPage.evaluate(() => {
                            const contentDiv = (document.querySelector('.xe_content') || document.querySelector('.rd_body') || document.querySelector('.read_body')) as HTMLElement;
                            if (!contentDiv) return null;

                            // Table handling
                            const tables = Array.from(contentDiv.querySelectorAll('table'));
                            tables.forEach(table => {
                                let tableMd = '\n\n';
                                const rows = Array.from(table.rows);
                                rows.forEach((row, i) => {
                                    const cells = Array.from(row.cells).map(c => c.textContent?.trim().replace(/\|/g, '\\|') || '');
                                    tableMd += '| ' + cells.join(' | ') + ' |\n';
                                    if (i === 0) {
                                        tableMd += '| ' + cells.map(() => '---').join(' | ') + ' |\n';
                                    }
                                });
                                tableMd += '\n';
                                const placeholder = document.createElement('div');
                                placeholder.innerHTML = tableMd.replace(/\n/g, '<br>');
                                table.parentNode?.replaceChild(placeholder, table);
                            });

                            let text = contentDiv.innerText;
                            text = text.replace(/\n\s*\n\s*\n+/g, '\n\n');
                            return text.trim();
                        });

                        await detailPage.close();

                        // Format content with Gemini for clean markdown (tables, lists, etc.)
                        // console.log(`Formatting: ${link.title}`); // Removed as per original instruction, but was present in the original code. Keeping it removed as per the provided diff.
                        // const formattedContent = bodyContent ? await formatNoticeContent(bodyContent) : null; // Removed as per original instruction, but was present in the original code. Keeping it removed as per the provided diff.

                        // Analyze with Gemini
                        console.log(`Analyzing (${boardProcessedCount + 1}/${MAX_NOTICES_PER_BOARD}): ${link.title}`);
                        const analysis = await analyzeNotice(link.title, bodyContent || '');

                        const noticeData: NoticeData = {
                            title: link.title,
                            url: link.url,
                            category: board.name,
                            date: link.date,
                            body: bodyContent?.slice(0, 10000),
                            isPinned: link.isPinned,
                            ...analysis
                        };

                        allNotices.push(noticeData);

                        // Upsert notice
                        // Use normalized URL for storage to prevent duplicates
                        await prisma.notice.upsert({
                            where: { url: normalizedUrl },
                            update: {
                                title: noticeData.title,
                                date: noticeData.date,
                                category: noticeData.category,
                                content: bodyContent,
                                summary: analysis.summary,
                                minGrade: noticeData.minGrade,
                                maxIncome: noticeData.maxIncome,
                                minGpa: noticeData.minGpa,
                                scholarshipType: noticeData.scholarshipType,
                                deadline: noticeData.applicationDeadline,
                                processed: true,
                                isPinned: link.isPinned
                            },
                            create: {
                                title: noticeData.title,
                                url: normalizedUrl, // Save normalized URL
                                date: noticeData.date,
                                category: noticeData.category,
                                content: bodyContent,
                                summary: analysis.summary,
                                minGrade: noticeData.minGrade,
                                maxIncome: noticeData.maxIncome,
                                minGpa: noticeData.minGpa,
                                scholarshipType: noticeData.scholarshipType,
                                deadline: noticeData.applicationDeadline,
                                processed: true,
                                isPinned: link.isPinned
                            }
                        });

                        boardProcessedCount++;
                        newItemsOnThisPage++;

                    } catch (err) {
                        console.error(`Failed to crawl detail ${link.url}`, err);
                    }
                } // end for links

                // If no new items were processed on this page, and we processed at least one page...
                // Maybe we are just looking at a page full of existing items (pinned or overlap).
                // But if we truly scraped 0 new items on a full page of 15 items, we probably hit the history.
                // However, Pinned items (usually 3-5) might be existing. Regular items (10+) should be new if we are going back in time.
                // If ALL items on the page are existing, we should probably stop.
                // But let's be safe: If we processed 0 items, and we are deep in pages, stop.
                if (newItemsOnThisPage === 0 && links.length > 0) {
                    // Check if they were ALL existing. 
                    // Since we `continue` on existing, if we reach here with newItemsOnThisPage=0, it means all were existing (or failed).
                    // So we can probably stop for this board.
                    console.log(`Page ${pageNum} had no new items. Assuming we reached known history. Stopping board.`);
                    stopBoard = true;
                }

                pageNum++;
            } // end while loop per board
        }

    } catch (e) {
        console.error("Crawl Loop Error", e);
    } finally {
        await browser.close();
    }

    return allNotices;
}
