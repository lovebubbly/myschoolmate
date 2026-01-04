
import { NextResponse } from 'next/server';
import { getAIBriefing } from '@/lib/gemini';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const { userProfile } = await req.json();

        // Fetch relevant notices from DB (e.g. today or last 3 days)
        // For prototype, fetch last 10 notices
        const notices = await prisma.notice.findMany({
            take: 10,
            orderBy: { date: 'desc' },
            select: { title: true, category: true, date: true }
        });

        const briefing = await getAIBriefing(notices, userProfile);

        return NextResponse.json({ briefing });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
