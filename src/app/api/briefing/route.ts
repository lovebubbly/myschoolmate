
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAIBriefing } from '@/lib/gemini';
import {
    applySessionCookieHeader,
} from '@/lib/sessionUser';
import { resolveUserProfile } from '@/lib/userProfileResolver';

export const dynamic = 'force-dynamic';

type BriefingOptions = {
    maxItems?: number;
    recentDays?: number;
};

function toFiniteNumber(value: unknown): number | undefined {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return undefined;
    return Math.trunc(parsed);
}

function resolveBriefingOptions(dashboardState: string | null | undefined): BriefingOptions {
    if (!dashboardState) return {};

    try {
        const parsed = JSON.parse(dashboardState);
        const raw = parsed?.briefing ?? parsed?.briefingOptions ?? parsed?.briefingSettings ?? parsed;
        if (!raw) return {};

        const maxItems = toFiniteNumber(raw.maxItems ?? raw.max_items ?? raw.briefingMaxItems ?? raw.maxCount);
        const recentDays = toFiniteNumber(
            raw.recentDays ?? raw.recent_days ?? raw.briefingRecentDays ?? raw.recentWindowDays,
        );

        return {
            maxItems,
            recentDays,
        };
    } catch {
        return {};
    }
}

export async function GET(request: Request) {
    try {
        const session = await resolveUserProfile(request);
        const userId = session.userId;
        const profile = session.profile;
        const briefingOptions = resolveBriefingOptions(profile.dashboardState ?? undefined);

        // 1. Check Cache (DailyBriefing)
        // Get today's date in KST (YYYY-MM-DD)
        const today = new Date().toLocaleDateString('ko-KR', {
            year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul'
        }).replace(/\. /g, '-').replace(/\./g, '');

        const cached = await prisma.dailyBriefing.findFirst({
            where: {
                userId,
                date: today
            }
        });

        if (cached) {
            // Check if profile was updated AFTER the briefing was created
            if (new Date(profile.updatedAt) > new Date(cached.createdAt)) {
                // Profile changed, so we need to regenerate
                await prisma.dailyBriefing.delete({ where: { id: cached.id } });
            } else {
                const response = NextResponse.json({ success: true, briefing: cached.content, cached: true });
                applySessionCookieHeader(response, session.setCookie);
                return response;
            }
        }

        // 2. Generate New
        const notices = await prisma.notice.findMany({
            orderBy: { date: 'desc' },  // Sort by date, not ID (crawler order may differ)
            take: 80, // Look at broader range for better filtering
            include: {
                tags: {
                    include: { tag: true },
                },
            },
        });

        const preparedNotices = notices.map((notice) => ({
            title: notice.title,
            summary: notice.summary || '',
            url: notice.url,
            date: notice.date,
            category: notice.category,
            minGrade: notice.minGrade,
            maxIncome: notice.maxIncome,
            minGpa: notice.minGpa,
            scholarshipType: notice.scholarshipType,
            deadline: notice.deadline || '',
            tags: notice.tags.map((entry) => entry.tag.name),
        }));

        const briefing = await getAIBriefing(preparedNotices, {
            grade: profile.grade,
            income: profile.income,
            gpa: profile.gpa,
            trackId: profile.trackId,
            raw: `학년: ${profile.grade}학년, 소득분위: ${profile.income}구간, GPA: ${profile.gpa || '미입력'}, 트랙: ${profile.trackId || '미선택'}`,
        }, briefingOptions);

        // 3. Save Cache
        await prisma.dailyBriefing.create({
            data: {
                userId,
                content: briefing,
                date: today
            }
        });

        const response = NextResponse.json({ success: true, briefing, cached: false });
        applySessionCookieHeader(response, session.setCookie);
        return response;
    } catch (e) {
        console.error(e);
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}
