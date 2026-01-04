
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAIBriefing } from '@/lib/gemini';

export async function GET() {
    try {
        const USER_ID = 1;

        // 1. Get User Profile
        const profile = await prisma.userProfile.findUnique({ where: { id: USER_ID } });
        if (!profile) {
            return NextResponse.json({ success: false, message: 'Profile not found' });
        }

        // 2. Check Cache (DailyBriefing)
        // Get today's date in KST (YYYY-MM-DD)
        const today = new Date().toLocaleDateString('ko-KR', {
            year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul'
        }).replace(/\. /g, '-').replace(/\./g, '');

        const cached = await prisma.dailyBriefing.findFirst({
            where: {
                userId: USER_ID,
                date: today
            }
        });

        if (cached) {
            // Check if profile was updated AFTER the briefing was created
            if (new Date(profile.updatedAt) > new Date(cached.createdAt)) {
                // Profile changed, so we need to regenerate
                await prisma.dailyBriefing.delete({ where: { id: cached.id } });
            } else {
                return NextResponse.json({ success: true, briefing: cached.content, cached: true });
            }
        }

        // 3. Generate New
        const notices = await prisma.notice.findMany({
            orderBy: { id: 'desc' },
            take: 30 // Look at more notices
        });

        const profileStr = `학년: ${profile.grade}학년, 소득분위: ${profile.income}구간, GPA: ${profile.gpa || '미입력'}, 트랙: ${profile.trackId || '미선택'}`;
        const briefing = await getAIBriefing(notices, profileStr);

        // 4. Save Cache
        await prisma.dailyBriefing.create({
            data: {
                userId: USER_ID,
                content: briefing,
                date: today
            }
        });

        return NextResponse.json({ success: true, briefing, cached: false });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}
