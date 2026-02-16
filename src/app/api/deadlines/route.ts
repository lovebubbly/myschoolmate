import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applySessionCookieHeader } from '@/lib/sessionUser';
import { resolveUserProfile } from '@/lib/userProfileResolver';
import {
  computeRelevance,
  normalizeActionState,
  normalizeRecommendationProfile,
  type NoticeActionState,
} from '@/lib/noticePersonalization';

export const dynamic = 'force-dynamic';

function normalizeLimit(raw: string | null, fallback: number) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  if (normalized <= 0) return fallback;
  return Math.min(200, normalized);
}

function normalizeWithinDays(raw: string | null) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 14;
  const normalized = Math.trunc(parsed);
  if (normalized <= 0) return 14;
  return Math.min(60, normalized);
}

export async function GET(request: Request) {
  try {
    const session = await resolveUserProfile(request);
    const { searchParams } = new URL(request.url);
    const withinDays = normalizeWithinDays(searchParams.get('withinDays'));
    const limit = normalizeLimit(searchParams.get('limit'), 30);

    const profile = normalizeRecommendationProfile({
      grade: session.profile.grade,
      income: session.profile.income,
      gpa: session.profile.gpa,
      trackId: session.profile.trackId,
    });

    const notices = await prisma.notice.findMany({
      where: {
        deadline: {
          not: null,
        },
      },
      include: {
        tags: {
          include: { tag: true },
        },
      },
      orderBy: { id: 'desc' },
      take: 400,
    });

    const noticeIds = notices.map((notice) => notice.id);
    const actions = noticeIds.length > 0
      ? await prisma.noticeAction.findMany({
        where: {
          userId: session.userId,
          noticeId: { in: noticeIds },
        },
        select: {
          noticeId: true,
          state: true,
        },
      })
      : [];
    const actionByNoticeId = new Map<number, NoticeActionState | null>(
      actions.map((action) => [action.noticeId, normalizeActionState(action.state)]),
    );

    const deadlines = notices
      .map((notice) => {
        const relevance = computeRelevance(
          {
            title: notice.title,
            category: notice.category,
            summary: notice.summary,
            scholarshipType: notice.scholarshipType,
            minGrade: notice.minGrade,
            maxIncome: notice.maxIncome,
            minGpa: notice.minGpa,
            deadline: notice.deadline,
            date: notice.date,
            tags: notice.tags.map((entry) => ({
              name: entry.tag?.name,
              slug: entry.tag?.slug,
            })),
          },
          profile,
        );

        if (relevance.dday === null) return null;
        if (relevance.dday < 0 || relevance.dday > withinDays) return null;

        return {
          id: notice.id,
          title: notice.title,
          url: notice.url,
          category: notice.category,
          deadline: notice.deadline,
          dday: relevance.dday,
          urgency: relevance.urgency,
          relevanceScore: relevance.score,
          relevanceReasons: relevance.reasons,
          isUrgent: relevance.isUrgent,
          actionState: actionByNoticeId.get(notice.id) ?? null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.dday - b.dday || b.relevanceScore - a.relevanceScore || b.id - a.id)
      .slice(0, limit);

    const response = NextResponse.json({
      success: true,
      withinDays,
      deadlines,
    });
    applySessionCookieHeader(response, session.setCookie);
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
