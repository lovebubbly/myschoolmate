
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
    body?: string;
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
            console.log(`Crawling ${board.name}: ${board.url}`);
            try {
                await safeNavigate(page, board.url);
            } catch (err) {
                console.error(`Failed to navigate to board ${board.name}`, err);
                continue;
            }

            // Wait for list
            await page.waitForSelector('table tbody tr', { timeout: 10000 }).catch(() => console.log(`Timeout waiting for table on ${board.name}`));

            const links = await page.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('table tbody tr'));
                // Skip notices (공지) tags if they persist, usually they have a special class or icon
                // For now, take top 15 regular or pinned
                return rows.slice(0, 100).map(row => {
                    const linkEl = row.querySelector('td.subject a') || row.querySelector('td.td_subject a') || row.querySelector('a');
                    const dateEl = row.querySelectorAll('td')[row.querySelectorAll('td').length - 2];

                    if (!linkEl) return null;

                    const title = linkEl.textContent?.trim() || '';
                    const href = linkEl.getAttribute('href');
                    const date = dateEl?.textContent?.trim() || '';

                    if (!href) return null;

                    return {
                        title: title.replace(/^\[공지\]\s*/, ''),
                        url: href.startsWith('http') ? href : `https://inform.chungbuk.ac.kr${href}`,
                        date
                    };
                }).filter(l => l !== null);
            });

            // Deep Crawl for Content
            for (const link of links) {
                if (!link) continue;

                // Incremental Check: If already processed, we stop for THIS board because they are chronological
                const existing = await prisma.notice.findUnique({ where: { url: link.url } });
                if (existing && existing.processed) {
                    console.log(`Board ${board.name}: Reached already processed notice [${link.title}]. Stopping board crawl.`);
                    break;
                }

                try {
                    const detailPage = await context.newPage();
                    await safeNavigate(detailPage, link.url);

                    // Extract Body Text
                    const bodyContent = await detailPage.evaluate(() => {
                        const contentDiv = (document.querySelector('.xe_content') || document.querySelector('.rd_body') || document.querySelector('.read_body')) as HTMLElement;
                        if (!contentDiv) return null;

                        // 1. Handle Tables
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
                            const placeholder = document.createTextNode(tableMd);
                            table.parentNode?.replaceChild(placeholder, table);
                        });

                        let text = contentDiv.innerText;
                        text = text.replace(/\n\s*\n\s*\n+/g, '\n\n');
                        return text.trim();
                    });

                    await detailPage.close();

                    // Format content with Gemini for clean markdown (tables, lists, etc.)
                    console.log(`Formatting: ${link.title}`);
                    const formattedContent = bodyContent ? await formatNoticeContent(bodyContent) : null;

                    // Analyze with Gemini
                    console.log(`Analyzing: ${link.title}`);
                    const analysis = await analyzeNotice(link.title, bodyContent || '');

                    const noticeData: NoticeData = {
                        title: link.title,
                        url: link.url,
                        category: board.name,
                        date: link.date,
                        body: formattedContent?.slice(0, 15000) || bodyContent?.slice(0, 10000),
                        ...analysis
                    };

                    allNotices.push(noticeData);

                    // Upsert notice
                    await prisma.notice.upsert({
                        where: { url: link.url },
                        update: {
                            title: noticeData.title,
                            date: noticeData.date,
                            category: noticeData.category,
                            content: bodyContent,
                            summary: analysis.summary,
                            minGrade: noticeData.minGrade,
                            maxIncome: noticeData.maxIncome,
                            scholarshipType: noticeData.scholarshipType,
                            deadline: noticeData.applicationDeadline,
                            processed: true
                        },
                        create: {
                            title: noticeData.title,
                            url: noticeData.url,
                            date: noticeData.date,
                            category: noticeData.category,
                            content: bodyContent,
                            summary: analysis.summary,
                            minGrade: noticeData.minGrade,
                            maxIncome: noticeData.maxIncome,
                            scholarshipType: noticeData.scholarshipType,
                            deadline: noticeData.applicationDeadline,
                            processed: true
                        }
                    });

                } catch (err) {
                    console.error(`Failed to crawl detail ${link.url}`, err);
                }
            }
        }

    } catch (e) {
        console.error("Crawl Loop Error", e);
    } finally {
        await browser.close();
    }

    return allNotices;
}
