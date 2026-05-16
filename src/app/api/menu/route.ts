
import { NextResponse } from 'next/server';
import { crawlCafeteriaMenu } from '@/lib/crawlMenu';
import { prisma } from '@/lib/prisma';
import { requireAdminAction } from '@/lib/adminActionGuard';
import { getSystemMeta, setSystemMeta } from '@/lib/systemMeta';
import { releaseSystemLock, tryAcquireSystemLock } from '@/lib/systemLock';

const MENU_REFRESH_META_KEY = 'cafeteriaMenuRefresh';
const MENU_REFRESH_LOCK_NAME = 'cafeteriaMenu:refresh';
const MENU_REFRESH_LOCK_TTL_MS = 90_000;

function envSeconds(name: string, fallbackSeconds: number) {
    const parsed = Number(process.env[name]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed * 1000 : fallbackSeconds * 1000;
}

const MENU_REFRESH_COOLDOWN_MS = envSeconds('MENU_REFRESH_COOLDOWN_SECONDS', 180);

type MenuRefreshMeta = {
    lastAttemptAt: number;
    lastSuccessAt: string | null;
    lastFailureReason: string | null;
};

const defaultRefreshMeta: MenuRefreshMeta = {
    lastAttemptAt: 0,
    lastSuccessAt: null,
    lastFailureReason: null,
};

async function refreshMenuSafely() {
    const now = Date.now();
    const meta = await getSystemMeta<MenuRefreshMeta>(MENU_REFRESH_META_KEY, defaultRefreshMeta);
    if (now - meta.lastAttemptAt < MENU_REFRESH_COOLDOWN_MS) {
        return { refreshed: false, refreshError: false, refreshSkippedReason: 'cooldown' as const };
    }

    const acquired = await tryAcquireSystemLock(MENU_REFRESH_LOCK_NAME, MENU_REFRESH_LOCK_TTL_MS);
    if (!acquired) {
        return { refreshed: false, refreshError: false, refreshSkippedReason: 'already-running' as const };
    }

    try {
        await setSystemMeta(MENU_REFRESH_META_KEY, {
            ...meta,
            lastAttemptAt: now,
        });
        await crawlCafeteriaMenu();
        await setSystemMeta(MENU_REFRESH_META_KEY, {
            lastAttemptAt: now,
            lastSuccessAt: new Date().toISOString(),
            lastFailureReason: null,
        });
        return { refreshed: true, refreshError: false, refreshSkippedReason: null };
    } catch (error) {
        console.error('[api/menu] public refresh failed:', error);
        await setSystemMeta(MENU_REFRESH_META_KEY, {
            ...meta,
            lastAttemptAt: now,
            lastFailureReason: 'MENU_REFRESH_FAILED',
        });
        return { refreshed: false, refreshError: true, refreshSkippedReason: 'failed' as const };
    } finally {
        await releaseSystemLock(MENU_REFRESH_LOCK_NAME);
    }
}

export async function POST(request: Request) {
    const guard = requireAdminAction(request);
    if (!guard.ok) {
        return guard.response;
    }

    try {
        const crawl = await crawlCafeteriaMenu();
        return NextResponse.json({ success: true, message: 'Menu crawled successfully', crawl });
    } catch (error) {
        console.error('Menu Crawl Error:', error);
        return NextResponse.json({ success: false, error: '학식 메뉴를 갱신하지 못했습니다.' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        // Get date from query or default to today's date in "MM.DD" format or similar?
        // The crawled data stores date as "12.29(월)". We need to fuzzy match or just return all for this week?
        // Let's return ALL menus and let frontend filter by "Today".
        // Or filter by substring of Date.now().

        // Simple approach: Get all menus created recently.
        // Or just get all form DB since it's small? No, we should limit.

        const { searchParams } = new URL(request.url);
        const dateQuery = searchParams.get('date'); // "12.30" etc.
        const refreshRequested = ['1', 'true', 'yes', 'on'].includes((searchParams.get('refresh') || '').toLowerCase());
        let refreshed = false;
        let refreshError = false;
        let refreshSkippedReason: 'cooldown' | 'already-running' | 'failed' | null = null;

        if (refreshRequested) {
            const refresh = await refreshMenuSafely();
            refreshed = refresh.refreshed;
            refreshError = refresh.refreshError;
            refreshSkippedReason = refresh.refreshSkippedReason;
        }

        let whereClause = {};
        if (dateQuery) {
            whereClause = {
                date: {
                    contains: dateQuery
                }
            };
        }

        const menus = await prisma.cafeteriaMenu.findMany({
            where: whereClause,
            orderBy: [
                { date: 'asc' },
                { restaurant: 'asc' }
            ]
        });

        return NextResponse.json({ success: true, menus, refreshed, refreshError, refreshSkippedReason });
    } catch (error) {
        console.error('Menu Read Error:', error);
        return NextResponse.json({ success: false, error: '학식 메뉴를 불러오지 못했습니다.' }, { status: 500 });
    }
}
