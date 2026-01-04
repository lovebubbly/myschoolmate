
import { NextResponse } from 'next/server';
import { crawlNotices } from '@/lib/crawler';

// User's frontend expects GET /api/notices/crawl (based on page.tsx)
// But page.tsx code: fetch('/api/notices/crawl') -> default GET.
// Let's implement GET.

export async function GET() {
    try {
        const notices = await crawlNotices();
        return NextResponse.json({
            success: true,
            notices: notices
        });
    } catch (error) {
        console.error('Crawl Error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
