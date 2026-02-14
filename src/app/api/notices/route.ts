import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractApplicationDeadlineFromText } from '@/lib/deadlineExtractor';
import {
    ensureFreshNotices,
    getNoticeAutoCrawlerStatus,
    startNoticeAutoCrawler,
} from '@/lib/noticeAutoCrawler';

export const dynamic = 'force-dynamic'; // Ensure no caching for latest data

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const autoCrawl = searchParams.get('autoCrawl') !== '0';

        if (autoCrawl) {
            startNoticeAutoCrawler();
            await ensureFreshNotices('api:notices');
        }

        const notices = await prisma.notice.findMany({
            orderBy: { id: 'desc' } // or createdAt desc
        });

        const normalizedNotices = notices.map((notice) => {
            if (!notice.content) return notice;
            const extracted = extractApplicationDeadlineFromText(`${notice.title} ${notice.content}`);
            if (!extracted || extracted === notice.deadline) return notice;
            return {
                ...notice,
                deadline: extracted,
            };
        });

        return NextResponse.json({
            success: true,
            notices: normalizedNotices,
            autoCrawler: getNoticeAutoCrawlerStatus(),
        });
    } catch (error) {
        console.error('Read Error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
