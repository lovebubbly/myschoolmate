import { chromium, type Page } from 'playwright';
import { createHash } from 'crypto';
import { getSystemMeta, setSystemMeta } from '@/lib/systemMeta';
import { releaseSystemLock, tryAcquireSystemLock } from '@/lib/systemLock';

export type NoticeBoard = {
    name: string;
    slug: string;
    url: string;
};

export type SelectorHealth = {
    hasTable: boolean;
    hasTbody: boolean;
    rowCount: number;
    headerCellCount: number;
    sampleRowCellCounts: number[];
    hasSubjectCell: boolean;
    hasSubjectLink: boolean;
    hasNoticeRow: boolean;
    hasPagination: boolean;
    error?: string;
};

export type DomFingerprintSnapshot = {
    hash: string;
    capturedAt: string;
    url: string;
    selectorHealth: SelectorHealth;
    sampleTitle?: string | null;
};

export type DomFingerprintMeta = {
    current: DomFingerprintSnapshot | null;
    previous: DomFingerprintSnapshot | null;
};

export type DomFingerprintStatus = DomFingerprintMeta & {
    board: NoticeBoard;
    changed: boolean;
};

export const NOTICE_DOM_BOARDS: NoticeBoard[] = [
    { name: 'Academic/Scholarship', slug: 'academic-scholarship', url: 'https://inform.chungbuk.ac.kr/cisub5_1' },
    { name: 'General', slug: 'general', url: 'https://inform.chungbuk.ac.kr/cisub5_2' },
    { name: 'Employment', slug: 'employment', url: 'https://inform.chungbuk.ac.kr/cisub5_3' },
    { name: 'News', slug: 'news', url: 'https://inform.chungbuk.ac.kr/cisub5_4' },
];

const DEFAULT_META: DomFingerprintMeta = {
    current: null,
    previous: null,
};

const LOCK_NAME = 'noticeDomFingerprint:capture';
const LOCK_TTL_MS = 10 * 60 * 1000;

function metaKey(slug: string) {
    return `noticeDomFingerprint:${slug}`;
}

async function safeNavigate(page: Page, url: string, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            return;
        } catch (error) {
            if (attempt === retries) throw error;
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
    }
}

function buildSelectorHealth(raw?: Partial<SelectorHealth>): SelectorHealth {
    return {
        hasTable: Boolean(raw?.hasTable),
        hasTbody: Boolean(raw?.hasTbody),
        rowCount: Number.isFinite(raw?.rowCount) ? (raw?.rowCount as number) : 0,
        headerCellCount: Number.isFinite(raw?.headerCellCount) ? (raw?.headerCellCount as number) : 0,
        sampleRowCellCounts: Array.isArray(raw?.sampleRowCellCounts)
            ? (raw?.sampleRowCellCounts as number[]).filter((value) => Number.isFinite(value))
            : [],
        hasSubjectCell: Boolean(raw?.hasSubjectCell),
        hasSubjectLink: Boolean(raw?.hasSubjectLink),
        hasNoticeRow: Boolean(raw?.hasNoticeRow),
        hasPagination: Boolean(raw?.hasPagination),
        error: raw?.error ? String(raw.error) : undefined,
    };
}

async function getBoardMeta(board: NoticeBoard): Promise<DomFingerprintMeta> {
    return getSystemMeta<DomFingerprintMeta>(metaKey(board.slug), DEFAULT_META);
}

function formatStatus(board: NoticeBoard, meta: DomFingerprintMeta): DomFingerprintStatus {
    const currentHash = meta.current?.hash;
    const previousHash = meta.previous?.hash;
    return {
        board,
        current: meta.current,
        previous: meta.previous,
        changed: Boolean(currentHash && previousHash && currentHash !== previousHash),
    };
}

async function persistSnapshot(board: NoticeBoard, snapshot: DomFingerprintSnapshot): Promise<DomFingerprintMeta> {
    const existing = await getBoardMeta(board);
    const next: DomFingerprintMeta = {
        current: snapshot,
        previous: existing.current ?? existing.previous ?? null,
    };
    await setSystemMeta(metaKey(board.slug), next);
    return next;
}

function hashFingerprint(source: string) {
    return createHash('sha256').update(source).digest('hex');
}

async function captureBoardFingerprint(page: Page, board: NoticeBoard): Promise<DomFingerprintSnapshot> {
    const capturedAt = new Date().toISOString();

    try {
        await safeNavigate(page, board.url);
        try {
            await page.waitForSelector('table tbody tr', { timeout: 10000 });
        } catch {
            // Continue even if selector is missing; we'll record selector health below.
        }

        // NOTE: Use string-eval to avoid build-tool helper leakage (e.g. `__name`) into browser context.
        const raw = (await page.evaluate(`(() => {
            const normalizeText = (value) => (value || '').replace(/\\s+/g, ' ').trim();
            const normalizeClass = (value) => (value || '').split(/\\s+/).filter(Boolean).sort().join('.');
            const serializeCell = (cell) => {
                const tag = cell.tagName.toLowerCase();
                const className = normalizeClass(cell.className || '');
                const classSuffix = className ? '.' + className : '';
                const hasLink = Boolean(cell.querySelector('a'));
                const hasImg = Boolean(cell.querySelector('img'));
                const colSpan = cell.getAttribute('colspan');
                const rowSpan = cell.getAttribute('rowspan');
                return tag + classSuffix + (hasLink ? '[a]' : '') + (hasImg ? '[img]' : '') + (colSpan ? '[colspan=' + colSpan + ']' : '') + (rowSpan ? '[rowspan=' + rowSpan + ']' : '');
            };

            const table = document.querySelector('table');
            const tableId = (table && table.getAttribute('id')) || '';
            const tableClass = normalizeClass((table && table.getAttribute('class')) || '');
            const tbody = (table && table.querySelector('tbody')) || document.querySelector('tbody');
            const rowRoot = tbody || table;
            const rows = rowRoot ? Array.from(rowRoot.querySelectorAll('tr')) : [];
            const sampleRows = rows.slice(0, 5);

            const rowSignature = sampleRows
                .map((row) => Array.from(row.querySelectorAll('th, td')).map(serializeCell).join('|'))
                .join('||');

            const headerCells = Array.from((table && table.querySelectorAll('thead th, thead td')) || []);
            const headerSignature = headerCells.map(serializeCell).join('|');
            const headerText = normalizeText(headerCells.map((cell) => cell.textContent || '').join(' '));
            const sampleTitle = normalizeText(((sampleRows[0] && sampleRows[0].querySelector('td.subject a, td.td_subject a, a')) || {}).textContent || '');

            const selectorHealth = {
                hasTable: Boolean(table),
                hasTbody: Boolean(tbody),
                rowCount: rows.length,
                headerCellCount: headerCells.length,
                sampleRowCellCounts: sampleRows.map((row) => row.querySelectorAll('th, td').length),
                hasSubjectCell: Boolean(document.querySelector('td.subject, td.td_subject')),
                hasSubjectLink: Boolean(document.querySelector('td.subject a, td.td_subject a')),
                hasNoticeRow: Boolean(document.querySelector('tr.notice')),
                hasPagination: Boolean(document.querySelector('.pagination, .page_navigation, .bd_pg')),
            };

            return {
                tableId,
                tableClass,
                headerText,
                headerSignature,
                rowSignature,
                sampleTitle,
                selectorHealth,
            };
        })()`)) as {
            tableId: string;
            tableClass: string;
            headerText: string;
            headerSignature: string;
            rowSignature: string;
            sampleTitle: string;
            selectorHealth: SelectorHealth;
        };

        const selectorHealth = buildSelectorHealth(raw.selectorHealth);
        const fingerprintPayload = {
            table: {
                id: raw.tableId || null,
                className: raw.tableClass || null,
                headerText: raw.headerText || '',
                headerSignature: raw.headerSignature || '',
            },
            rows: raw.rowSignature || '',
            selectors: selectorHealth,
        };
        const source = JSON.stringify(fingerprintPayload);
        const hash = hashFingerprint(source);

        return {
            hash,
            capturedAt,
            url: page.url(),
            selectorHealth,
            sampleTitle: raw.sampleTitle || null,
        };
    } catch (error) {
        const selectorHealth = buildSelectorHealth({ error: String(error) });
        const source = JSON.stringify({ error: selectorHealth.error || 'unknown' });
        const hash = hashFingerprint(source);
        return {
            hash,
            capturedAt,
            url: board.url,
            selectorHealth,
            sampleTitle: null,
        };
    }
}

export async function getDomFingerprintStatus(): Promise<DomFingerprintStatus[]> {
    const results = await Promise.all(
        NOTICE_DOM_BOARDS.map(async (board) => {
            const meta = await getBoardMeta(board);
            return formatStatus(board, meta);
        })
    );

    return results;
}

export async function runDomFingerprintCapture(): Promise<DomFingerprintStatus[]> {
    const acquired = await tryAcquireSystemLock(LOCK_NAME, LOCK_TTL_MS);
    if (!acquired) {
        return getDomFingerprintStatus();
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const results: DomFingerprintStatus[] = [];

    try {
        for (const board of NOTICE_DOM_BOARDS) {
            const snapshot = await captureBoardFingerprint(page, board);
            const meta = await persistSnapshot(board, snapshot);
            results.push(formatStatus(board, meta));
        }
    } finally {
        await page.close();
        await context.close();
        await browser.close();
        await releaseSystemLock(LOCK_NAME);
    }

    return results;
}
