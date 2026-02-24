
import { chromium, Page } from 'playwright';
import { prisma } from '@/lib/prisma';
import { analyzeNotice } from './gemini';
import { extractApplicationDeadlineFromText } from '@/lib/deadlineExtractor';
import { extractTagsByRegex, normalizeTags } from './tagging';

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
    tags?: string[];
    isPinned: boolean;
}

const INFORM_BASE_URL = 'https://inform.chungbuk.ac.kr';

const BOARDS = [
    { name: 'Academic/Scholarship', url: `${INFORM_BASE_URL}/cisub5_1` },
    { name: 'General', url: `${INFORM_BASE_URL}/cisub5_2` },
    { name: 'Employment', url: `${INFORM_BASE_URL}/cisub5_3` },
    { name: 'News', url: `${INFORM_BASE_URL}/cisub5_4` },
];

function normalizeNoticeUrl(rawUrl: string) {
    try {
        const u = new URL(rawUrl);
        u.searchParams.delete('page');
        return u.toString();
    } catch {
        return rawUrl;
    }
}

function toTagSlug(rawName: string) {
    return rawName
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function syncNoticeTags(noticeId: number, tags: string[]) {
    const normalized = normalizeTags(tags || []);
    await prisma.noticeTagOnNotice.deleteMany({ where: { noticeId } });
    if (normalized.length === 0) return;

    const existingTags = await prisma.noticeTag.findMany({
        where: { name: { in: normalized } },
    });
    const existingNames = new Set(existingTags.map((tag) => tag.name));
    const toCreate = normalized.filter((name) => !existingNames.has(name));

    if (toCreate.length > 0) {
        await prisma.noticeTag.createMany({
            data: toCreate.map((name) => ({
                name,
                slug: toTagSlug(name),
            })),
        });
    }

    const finalTags = await prisma.noticeTag.findMany({
        where: { name: { in: normalized } },
    });

    if (finalTags.length === 0) return;

    await prisma.noticeTagOnNotice.createMany({
        data: finalTags.map((tag) => ({ noticeId, tagId: tag.id })),
    });
}

export async function crawlNotices(options?: { refreshExisting?: boolean }): Promise<NoticeData[]> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const refreshExisting = options?.refreshExisting === true;

    const allNotices: NoticeData[] = [];

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

    async function extractBodyContent(detailUrl: string) {
        const detailPage = await context.newPage();
        try {
            await safeNavigate(detailPage, detailUrl);
            return await detailPage.evaluate(() => {
                const contentDiv = (document.querySelector('.xe_content') || document.querySelector('.rd_body') || document.querySelector('.read_body')) as HTMLElement;
                if (!contentDiv) return null;

                const normalizeCellText = (value: string | null | undefined) =>
                    (value || '')
                        .replace(/\u00A0/g, ' ')
                        .replace(/\r/g, '')
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .join('<br>')
                        .replace(/\|/g, '\\|');

                const tableToMarkdown = (table: HTMLTableElement) => {
                    const rows = Array.from(table.querySelectorAll('tr'));
                    const grid: string[][] = [];

                    rows.forEach((row, rowIndex) => {
                        if (!grid[rowIndex]) grid[rowIndex] = [];
                        let colIndex = 0;
                        const cells = Array.from(row.querySelectorAll('th, td')) as HTMLTableCellElement[];

                        cells.forEach((cell) => {
                            while (grid[rowIndex][colIndex] !== undefined) colIndex += 1;

                            const cellValue = normalizeCellText(cell.textContent) || '-';
                            const rowSpan = Math.max(1, Number(cell.getAttribute('rowspan') || '1'));
                            const colSpan = Math.max(1, Number(cell.getAttribute('colspan') || '1'));

                            for (let r = 0; r < rowSpan; r += 1) {
                                const targetRow = rowIndex + r;
                                if (!grid[targetRow]) grid[targetRow] = [];
                                for (let c = 0; c < colSpan; c += 1) {
                                    grid[targetRow][colIndex + c] = cellValue;
                                }
                            }

                            colIndex += colSpan;
                        });
                    });

                    const maxColumns = grid.reduce((acc, row) => Math.max(acc, row.length), 0);
                    if (maxColumns === 0 || grid.length === 0) return '';

                    const normalizedRows = grid.map((row) => {
                        const nextRow = [...row];
                        for (let i = 0; i < maxColumns; i += 1) {
                            if (!nextRow[i] || !nextRow[i].trim()) nextRow[i] = '-';
                        }
                        return nextRow;
                    });

                    const header = normalizedRows[0];
                    const lines = [
                        `| ${header.join(' | ')} |`,
                        `| ${header.map(() => '---').join(' | ')} |`,
                    ];

                    for (let i = 1; i < normalizedRows.length; i += 1) {
                        lines.push(`| ${normalizedRows[i].join(' | ')} |`);
                    }

                    return lines.join('\n');
                };

                const tables = Array.from(contentDiv.querySelectorAll('table'));
                tables.forEach((table) => {
                    const tableMd = tableToMarkdown(table as HTMLTableElement);
                    if (!tableMd) return;

                    const placeholder = document.createElement('pre');
                    placeholder.textContent = `\n${tableMd}\n`;
                    placeholder.style.whiteSpace = 'pre-wrap';
                    placeholder.style.margin = '0';
                    table.parentNode?.replaceChild(placeholder, table);
                });

                let text = contentDiv.innerText;
                text = text.replace(/\n\s*\n\s*\n+/g, '\n\n');
                return text.trim();
            });
        } finally {
            await detailPage.close();
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
                } catch {
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

                const uniqueLinks = [];
                const seenUrls = new Set<string>();
                for (const link of links) {
                    if (!link) continue;

                    const normalizedUrl = normalizeNoticeUrl(link.url);
                    if (!normalizedUrl || seenUrls.has(normalizedUrl)) continue;

                    seenUrls.add(normalizedUrl);
                    uniqueLinks.push({
                        ...link,
                        url: normalizedUrl !== link.url ? link.url : normalizedUrl,
                        normalizedUrl,
                    });
                }

                if (uniqueLinks.length === 0) {
                    console.log(`No unique links found on ${board.name} page ${pageNum}. Stopping board.`);
                    break;
                }

                const urlCandidates = new Set<string>();
                for (const link of uniqueLinks) {
                    urlCandidates.add(link.normalizedUrl);
                    if (link.url !== link.normalizedUrl) {
                        urlCandidates.add(link.url);
                    }
                }

                const existingNotices = await prisma.notice.findMany({
                    where: {
                        url: { in: Array.from(urlCandidates) },
                    },
                    select: {
                        id: true,
                        title: true,
                        date: true,
                        category: true,
                        content: true,
                        deadline: true,
                        processed: true,
                        isPinned: true,
                        url: true,
                    },
                });
                const existingNoticeMap = new Map<string, (typeof existingNotices)[number]>();
                for (const existingNotice of existingNotices) {
                    existingNoticeMap.set(existingNotice.url, existingNotice);
                }

                // Deep Crawl for Content
                let newItemsOnThisPage = 0;

                for (const link of uniqueLinks) {
                    if (!link) continue;
                    if (boardProcessedCount >= MAX_NOTICES_PER_BOARD) {
                        stopBoard = true;
                        break;
                    }

                    const existing = existingNoticeMap.get(link.normalizedUrl) || existingNoticeMap.get(link.url);

                    if (existing && existing.processed) {
                        const hasMetadataChanged = existing.title !== link.title || existing.date !== link.date || existing.category !== board.name;

                        if (!refreshExisting) {
                            if (existing.isPinned !== link.isPinned || hasMetadataChanged) {
                                await prisma.notice.update({
                                    where: { id: existing.id },
                                    data: {
                                        title: link.title,
                                        date: link.date,
                                        category: board.name,
                                        url: link.normalizedUrl,
                                        isPinned: link.isPinned,
                                    },
                                });
                            }
                            console.log(`Skipping existing: ${link.title}`);
                            continue;
                        }

                        if (!hasMetadataChanged) {
                            if (existing.isPinned !== link.isPinned) {
                                await prisma.notice.update({
                                    where: { id: existing.id },
                                    data: { isPinned: link.isPinned, url: link.normalizedUrl },
                                });
                            }
                            console.log(`Skipping existing: ${link.title}`);
                            continue;
                        }

                        try {
                            const refreshedBodyContent = await extractBodyContent(link.url);
                            const shouldUpdateContent = Boolean(refreshedBodyContent) && refreshedBodyContent !== existing.content;
                            const refreshedDeadline = refreshedBodyContent
                                ? extractApplicationDeadlineFromText(`${link.title} ${refreshedBodyContent}`)
                                : null;
                            const shouldUpdateDeadline = refreshedDeadline !== null && refreshedDeadline !== existing.deadline;

                            if (shouldUpdateContent || shouldUpdateDeadline) {
                                await prisma.notice.update({
                                    where: { id: existing.id },
                                    data: {
                                        title: link.title,
                                        date: link.date,
                                        category: board.name,
                                        url: link.normalizedUrl,
                                        content: refreshedBodyContent || existing.content,
                                        deadline: shouldUpdateDeadline ? refreshedDeadline : existing.deadline,
                                        isPinned: link.isPinned,
                                    },
                                });

                                const refreshedTags = extractTagsByRegex({
                                    title: link.title,
                                    body: refreshedBodyContent || existing.content || '',
                                    category: board.name,
                                });
                                await syncNoticeTags(existing.id, refreshedTags);

                                console.log(`Refreshed existing: ${link.title}`);
                            } else if (hasMetadataChanged || existing.isPinned !== link.isPinned) {
                                await prisma.notice.update({
                                    where: { id: existing.id },
                                    data: {
                                        title: link.title,
                                        date: link.date,
                                        category: board.name,
                                        url: link.normalizedUrl,
                                        isPinned: link.isPinned,
                                    },
                                });
                                console.log(`Updated metadata: ${link.title}`);
                            } else {
                                console.log(`Skipping existing: ${link.title}`);
                            }
                        } catch (err) {
                            console.error(`Failed to refresh existing detail ${link.url}`, err);
                            if (hasMetadataChanged || existing.isPinned !== link.isPinned) {
                                try {
                                    await prisma.notice.update({
                                        where: { id: existing.id },
                                        data: {
                                            title: link.title,
                                            date: link.date,
                                            category: board.name,
                                            url: link.normalizedUrl,
                                            isPinned: link.isPinned,
                                        },
                                    });
                                } catch (fallbackError) {
                                    console.error(`Failed metadata fallback for existing notice ${link.url}`, fallbackError);
                                }
                            }
                        }
                        continue;
                    }

                    try {
                        const bodyContent = await extractBodyContent(link.url);

                        // Analyze with Gemini
                        console.log(`Analyzing (${boardProcessedCount + 1}/${MAX_NOTICES_PER_BOARD}): ${link.title}`);
                        const analysis = await analyzeNotice(link.title, bodyContent || '', board.name);

                        const noticeData: NoticeData = {
                            title: link.title,
                            url: link.normalizedUrl,
                            category: board.name,
                            date: link.date,
                            body: bodyContent?.slice(0, 10000),
                            isPinned: link.isPinned,
                            ...analysis
                        };

                        allNotices.push(noticeData);

                        const upsertData = {
                            title: noticeData.title,
                            url: noticeData.url,
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
                            isPinned: link.isPinned,
                        };

                        const storedNotice = existing
                            ? await prisma.notice.update({
                                where: { id: existing.id },
                                data: upsertData,
                                select: { id: true },
                            })
                            : await prisma.notice.create({
                                data: upsertData,
                                select: { id: true },
                            });

                        await syncNoticeTags(storedNotice.id, noticeData.tags || []);

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
                if (newItemsOnThisPage === 0 && uniqueLinks.length > 0) {
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
