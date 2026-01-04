import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic'; // Ensure no caching for latest data

export async function GET() {
    try {
        const notices = await prisma.notice.findMany({
            orderBy: { id: 'desc' } // or createdAt desc
        });

        return NextResponse.json({
            success: true,
            notices: notices
        });
    } catch (error) {
        console.error('Read Error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
