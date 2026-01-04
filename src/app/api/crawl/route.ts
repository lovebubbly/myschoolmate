
import { NextResponse } from 'next/server';
import { crawlNotices } from '@/lib/crawler';

export async function GET() {
    try {
        // Crawl ALL boards (Academic/Scholarship, General, Employment, News)
        const notices = await crawlNotices();

        return NextResponse.json({
            success: true,
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
