
import { NextResponse } from 'next/server';
import { crawlNotices } from '@/lib/crawler';

export async function GET() {
    try {
        // Crawl both academic and scholarship
        // 407: Academic, 408: Scholarship
        const aca = await crawlNotices('cisub5_1', '407');
        const schol = await crawlNotices('cisub5_1', '408');

        return NextResponse.json({
            success: true,
            academic: aca.count,
            scholarship: schol.count
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
