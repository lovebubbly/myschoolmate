
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { triggerNoticeCrawl } from '@/lib/noticeAutoCrawler';

export async function GET() {
    try {
        // Crawl ALL boards (Academic/Scholarship, General, Employment, News)
        const crawl = await triggerNoticeCrawl('api:crawl', { refreshExisting: true });
        const notices = await prisma.notice.findMany({
            orderBy: { id: 'desc' }
        });

        return NextResponse.json({
            success: true,
            crawl,
            total: notices.length,
            byCategory: {
                academic: notices.filter(n => n.category === 'Academic/Scholarship').length,
                general: notices.filter(n => n.category === 'General').length,
                employment: notices.filter(n => n.category === 'Employment').length,
                news: notices.filter(n => n.category === 'News').length
            }
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
