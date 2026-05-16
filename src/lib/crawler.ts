import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
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

type BoardLink = {
    title: string;
    url: string;
    normalizedUrl: string;
    date: string;
    isPinned: boolean;
};

const INFORM_BASE_URL = 'https://inform.chungbuk.ac.kr';
const REQUEST_TIMEOUT_MS = 15000;
const MAX_PAGES_PER_BOARD = Number(process.env.NOTICE_CRAWL_MAX_PAGES_PER_BOARD || 1);
const MAX_NOTICES_PER_BOARD = Number(process.env.NOTICE_CRAWL_MAX_NOTICES_PER_BOARD || 8);

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

function resolveNoticeUrl(rawUrl: string) {
    try {
        return new URL(rawUrl, INFORM_BASE_URL).toString();
    } catch {
        return rawUrl;
    }
}

function normalizeCellText(value: string | null | undefined) {
    return (value || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\r/g, '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join('<br>')
        .replace(/\|/g, '\\|');
}

function normalizeBlockText(value: string | null | undefined) {
    return (value || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\r/g, '')
        .replace(/\n\s*\n\s*\n+/g, '\n\n')
        .trim();
}

function normalizeInlineText(value: string | null | undefined) {
    return normalizeBlockText(value)
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function toTagSlug(rawName: string) {
    return rawName
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function fetchHtml(url: string, retries = 2) {
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.7,en;q=0.6',
                    'User-Agent':
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }

            return await response.text();
        } catch (error) {
            lastError = error;
            if (attempt >= retries) break;
            await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
        } finally {
            clearTimeout(timeout);
        }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function tableToMarkdown($: cheerio.CheerioAPI, table: Element) {
    const grid: string[][] = [];

    $(table)
        .find('tr')
        .each((rowIndex, row) => {
            if (!grid[rowIndex]) grid[rowIndex] = [];
            let colIndex = 0;

            $(row)
                .find('th, td')
                .each((_, cell) => {
                    while (grid[rowIndex][colIndex] !== undefined) colIndex += 1;

                    const cellValue = normalizeCellText($(cell).text()) || '-';
                    const rowSpan = Math.max(1, Number($(cell).attr('rowspan') || '1'));
                    const colSpan = Math.max(1, Number($(cell).attr('colspan') || '1'));

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
}

function parseBoardLinks(html: string, boardUrl: string): BoardLink[] {
    const $ = cheerio.load(html);
    const links: BoardLink[] = [];
    const seen = new Set<string>();

    $('table tbody tr').each((_, row) => {
        const $row = $(row);
        const $link = $row.find('td.title a').first().length
            ? $row.find('td.title a').first()
            : $row.find('td.subject a').first().length
                ? $row.find('td.subject a').first()
                : $row.find('td.td_subject a').first();

        if ($link.length === 0) return;

        const rawHref = $link.attr('href');
        if (!rawHref) return;

        const title = normalizeInlineText($link.text()).replace(/^\[공지\]\s*/, '');
        if (!title) return;

        const rowCells = $row.find('td');
        const date =
            normalizeInlineText($row.find('td.time').first().text()) ||
            normalizeInlineText(rowCells.eq(Math.max(0, rowCells.length - 2)).text());
        const url = resolveNoticeUrl(rawHref.startsWith('/') ? rawHref : new URL(rawHref, boardUrl).toString());
        const normalizedUrl = normalizeNoticeUrl(url);
        if (seen.has(normalizedUrl)) return;
        seen.add(normalizedUrl);

        links.push({
            title,
            url,
            normalizedUrl,
            date,
            isPinned: $row.hasClass('notice') || normalizeInlineText(rowCells.first().text()) === '공지',
        });
    });

    return links;
}

async function extractBodyContent(detailUrl: string) {
    const html = await fetchHtml(detailUrl);
    const $ = cheerio.load(html);
    const $content = $('.xe_content').first().length
        ? $('.xe_content').first()
        : $('.rd_body').first().length
            ? $('.rd_body').first()
            : $('.read_body').first();

    if ($content.length === 0) return null;

    const $clone = $content.clone();
    $clone.find('table').each((_, table) => {
        const tableMd = tableToMarkdown($, table);
        if (!tableMd) return;
        $(table).replaceWith(`\n${tableMd}\n`);
    });

    return normalizeBlockText($clone.text());
}

async function analyzeNoticeSafely(title: string, body: string, category: string) {
    try {
        return await analyzeNotice(title, body, category);
    } catch (error) {
        console.error('Notice analysis failed, falling back to regex extraction:', error);
        const tags = extractTagsByRegex({ title, body, category });
        return {
            summary: body ? normalizeInlineText(body).slice(0, 180) : 'AI 분석 없이 원문 기준으로 수집된 공지입니다.',
            minGrade: null,
            maxIncome: null,
            scholarshipType: 'Other',
            applicationDeadline: extractApplicationDeadlineFromText(`${title} ${body}`),
            minGpa: null,
            tags,
        };
    }
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
    const refreshExisting = options?.refreshExisting === true;
    const allNotices: NoticeData[] = [];

    for (const board of BOARDS) {
        let boardProcessedCount = 0;
        let stopBoard = false;

        for (let pageNum = 1; pageNum <= MAX_PAGES_PER_BOARD && boardProcessedCount < MAX_NOTICES_PER_BOARD && !stopBoard; pageNum += 1) {
            const pageUrl = `${board.url}?page=${pageNum}`;
            console.log(`Crawling ${board.name} (Page ${pageNum}): ${pageUrl}`);

            let uniqueLinks: BoardLink[];
            try {
                uniqueLinks = parseBoardLinks(await fetchHtml(pageUrl), board.url);
            } catch (error) {
                console.error(`Failed to fetch board ${board.name} page ${pageNum}`, error);
                break;
            }

            if (uniqueLinks.length === 0) {
                console.log(`No links found on ${board.name} page ${pageNum}. Stopping board.`);
                break;
            }

            const urlCandidates = new Set<string>();
            for (const link of uniqueLinks) {
                urlCandidates.add(link.normalizedUrl);
                urlCandidates.add(link.url);
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

            let newItemsOnThisPage = 0;

            for (const link of uniqueLinks) {
                if (boardProcessedCount >= MAX_NOTICES_PER_BOARD) {
                    stopBoard = true;
                    break;
                }

                const existing = existingNoticeMap.get(link.normalizedUrl) || existingNoticeMap.get(link.url);

                if (existing && existing.processed) {
                    const hasMetadataChanged = existing.title !== link.title || existing.date !== link.date || existing.category !== board.name;

                    if (!refreshExisting) {
                        if (existing.isPinned !== link.isPinned || hasMetadataChanged || existing.url !== link.normalizedUrl) {
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
                        if (existing.isPinned !== link.isPinned || existing.url !== link.normalizedUrl) {
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
                        } else if (hasMetadataChanged || existing.isPinned !== link.isPinned || existing.url !== link.normalizedUrl) {
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
                        if (hasMetadataChanged || existing.isPinned !== link.isPinned || existing.url !== link.normalizedUrl) {
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

                    console.log(`Analyzing (${boardProcessedCount + 1}/${MAX_NOTICES_PER_BOARD}): ${link.title}`);
                    const analysis = await analyzeNoticeSafely(link.title, bodyContent || '', board.name);

                    const noticeData: NoticeData = {
                        title: link.title,
                        url: link.normalizedUrl,
                        category: board.name,
                        date: link.date,
                        body: bodyContent?.slice(0, 10000),
                        isPinned: link.isPinned,
                        ...analysis,
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

                    boardProcessedCount += 1;
                    newItemsOnThisPage += 1;
                } catch (err) {
                    console.error(`Failed to crawl detail ${link.url}`, err);
                }
            }

            if (newItemsOnThisPage === 0 && uniqueLinks.length > 0) {
                console.log(`Page ${pageNum} had no new items. Assuming known history. Stopping board.`);
                stopBoard = true;
            }
        }
    }

    return allNotices;
}
