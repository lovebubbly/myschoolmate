import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    getNoticeAutoCrawlerStatus,
    triggerNoticeCrawl,
} from '@/lib/noticeAutoCrawler';
import { requireAdminAction } from '@/lib/adminActionGuard';

export async function POST(request: Request) {
    const guard = requireAdminAction(request);
    if (!guard.ok) {
        return guard.response;
    }

    try {
        // 1. Run crawler with global lock
        const crawl = await triggerNoticeCrawl('api:notices:crawl', { refreshExisting: true });

        // 2. Fetch fresh data from DB
        const notices = await prisma.notice.findMany({
            orderBy: { id: 'desc' }
        });

        return NextResponse.json({
            success: true,
            notices: notices,
            crawl,
            autoCrawler: getNoticeAutoCrawlerStatus(),
        });
    } catch (error) {
        console.error('Crawl Error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
