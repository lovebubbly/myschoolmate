
import { NextResponse } from 'next/server';
import { crawlCafeteriaMenu } from '@/lib/crawlMenu';
import { prisma } from '@/lib/prisma';

export async function POST() {
    try {
        await crawlCafeteriaMenu();
        return NextResponse.json({ success: true, message: 'Menu crawled successfully' });
    } catch (error) {
        console.error('Menu Crawl Error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
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

        return NextResponse.json({ success: true, menus });
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
