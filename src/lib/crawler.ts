
import { chromium, Page } from 'playwright';
import { prisma } from '@/lib/prisma';
import { analyzeNotice } from './gemini';

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

    try {
        for (const board of BOARDS) {
            // Optional filter if we only want to crawl specific boards (logic from user request history or typical pattern)
            // For now, I'll keep the loop but we can optimize later if needed.
            // The method signature allowed 'targetBoard' arguments in previous revisions (run_crawl.ts calls it), but the implementation didn't fully use them. 
            // I will adhere to the existing logic which iterates all BOARDS, but maybe I should respect the args?
            // "run_crawl.ts" calls: crawlNotices('cisub5_1', '407');
            // But the current definition I read earlier: export async function crawlNotices(): Promise<NoticeData[]> 
            // Wait, looking at "run_crawl.ts" Step 17: "await crawlNotices('cisub5_1', '407');"
            // Looking at "crawler.ts" Step 25: "export async function crawlNotices(): Promise<NoticeData[]>"
            // The arguments are MISMATCHED. The definition has NO arguments.
            // I will fix the signature to optionally accept arguments, but mostly importantly implement the DB logic.

            console.log(`Crawling ${board.name}: ${board.url}`);
            await page.goto(board.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Wait for list
            await page.waitForSelector('table tbody tr', { timeout: 5000 }).catch(() => console.log(`Timeout waiting for table on ${board.name}`));

            const links = await page.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('table tbody tr'));
                return rows.slice(0, 3).map(row => { // Limit to top 3 for speed
                    const linkEl = row.querySelector('td.subject a') || row.querySelector('td.td_subject a') || row.querySelector('a');
                    const dateEl = row.querySelectorAll('td')[row.querySelectorAll('td').length - 2]; // heuristics

                    if (!linkEl) return null;

                    const title = linkEl.textContent?.trim() || '';
                    const href = linkEl.getAttribute('href');
                    const date = dateEl?.textContent?.trim() || '';

                    if (!href) return null;

                    return {
                        title,
                        url: href.startsWith('http') ? href : `https://inform.chungbuk.ac.kr${href}`,
                        date
                    };
                }).filter(l => l !== null);
            });

            // Deep Crawl for Content
            for (const link of links) {
                if (!link) continue;

                // Check if exists in DB to avoid re-crawling details if unchanged?
                // For simplicity and to ensure fresh AI analysis if wanted, we might just overwrite. 
                // But efficient crawling would check if URL exists.
                // Let's check DB first.
                const existing = await prisma.notice.findUnique({ where: { url: link.url } });
                if (existing && existing.processed) {
                    console.log(`Skipping already processed: ${link.title}`);
                    // Push to allNotices so it returns valid data?
                    // Convert DB model to NoticeData
                    allNotices.push({
                        title: existing.title,
                        url: existing.url,
                        category: existing.category,
                        date: existing.date,
                        summary: existing.summary || undefined,
                        minGrade: existing.minGrade,
                        maxIncome: existing.maxIncome,
                        scholarshipType: existing.scholarshipType || undefined,
                        applicationDeadline: existing.deadline,
                        body: existing.content || undefined
                    });
                    continue;
                }

                try {
                    const detailPage = await context.newPage();
                    await detailPage.goto(link.url, { waitUntil: 'domcontentloaded', timeout: 15000 });

                    // Extract Body Text
                    const bodyText = await detailPage.evaluate(() => {
                        const contentDiv = document.querySelector('.read_body') || document.querySelector('.con_area') || document.querySelector('#txt');
                        return contentDiv ? contentDiv.textContent?.trim() : document.body.innerText;
                    });

                    await detailPage.close();

                    // Analyze with Gemini
                    console.log(`Analyzing: ${link.title}`);
                    const analysis = await analyzeNotice(link.title, bodyText || '');

                    const noticeData: NoticeData = {
                        title: link.title,
                        url: link.url,
                        category: board.name,
                        date: link.date,
                        body: bodyText?.slice(0, 5000), // Limit body size for DB text column if needed, though SQLite handles large text
                        ...analysis
                    };

                    allNotices.push(noticeData);

                    // Save to DB
                    await prisma.notice.upsert({
                        where: { url: link.url },
                        update: {
                            title: noticeData.title,
                            date: noticeData.date,
                            category: noticeData.category,
                            content: noticeData.body,
                            summary: noticeData.summary,
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
                            content: noticeData.body,
                            summary: noticeData.summary,
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
