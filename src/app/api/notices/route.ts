import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { extractApplicationDeadlineFromText } from '@/lib/deadlineExtractor';
import {
  ensureFreshNotices,
  getNoticeAutoCrawlerStatus,
  startNoticeAutoCrawler,
} from '@/lib/noticeAutoCrawler';
import { applySessionCookieHeader } from '@/lib/sessionUser';
import { resolveUserProfile } from '@/lib/userProfileResolver';
import {
  computeEligibility,
  computeRelevance,
  computeDday,
  normalizeActionState,
  normalizeRecommendationProfile,
  parseDeadlineDate,
  parseNoticeDate,
  type NoticeActionState,
  type RelevanceReason,
} from '@/lib/noticePersonalization';

export const dynamic = 'force-dynamic'; // Ensure no caching for latest data
const DEFAULT_NOTICE_LIMIT = 200;
const MAX_NOTICE_LIMIT = 500;

type NoticeSortMode = 'latest' | 'relevance' | 'deadline';
type NormalizedCategory = 'Academic' | 'Scholarship' | 'General' | 'Employment' | 'News';
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const ELIGIBILITY_EXPLAIN_ENABLED =
  process.env.FEATURE_ELIGIBILITY_EXPLAIN === '1' || process.env.NODE_ENV !== 'production';
const WATCHLIST_ENABLED =
  process.env.FEATURE_WATCHLIST === '1' || process.env.NODE_ENV !== 'production';
const WATCHLIST_MAX_ITEMS = 30;
const WATCHLIST_MAX_LENGTH = 40;

function normalizeNoticeLimit(raw: string | null) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_NOTICE_LIMIT;
  const normalized = Math.trunc(parsed);
  if (normalized <= 0) return DEFAULT_NOTICE_LIMIT;
  if (normalized > MAX_NOTICE_LIMIT) return MAX_NOTICE_LIMIT;
  return normalized;
}

function normalizeSort(raw: string | null): NoticeSortMode {
  if (raw === 'relevance') return 'relevance';
  if (raw === 'deadline') return 'deadline';
  return 'latest';
}

function normalizePositiveInt(raw: string | null): number | null {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.trunc(parsed);
  if (normalized <= 0) return null;
  return normalized;
}

function normalizeBooleanFlag(raw: string | null): boolean {
  if (!raw) return false;
  const value = raw.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function computeFreshnessBoost(dateValue?: string | null): number {
  const publishedAt = parseNoticeDate(dateValue);
  if (!publishedAt) return 0;

  const ageDays = Math.floor((Date.now() - publishedAt.getTime()) / MS_PER_DAY);
  if (ageDays <= 1) return 10;
  if (ageDays <= 3) return 7;
  if (ageDays <= 7) return 5;
  if (ageDays <= 14) return 3;
  if (ageDays <= 30) return 1;
  return 0;
}

function normalizeCategory(raw: string): NormalizedCategory | null {
  const value = raw.trim().toLowerCase();
  if (!value || value === 'all' || value === '전체') return null;
  if (value === 'academic' || value === '학사') return 'Academic';
  if (value === 'scholarship' || value === '장학') return 'Scholarship';
  if (value === 'general' || value === '일반') return 'General';
  if (value === 'employment' || value === '취업') return 'Employment';
  if (value === 'news' || value === '뉴스' || value === '소식') return 'News';
  return null;
}

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .map((item) => String(item || '').trim())
        .filter(Boolean),
    ),
  );
}

function parseJsonStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    return normalizeStringArray(JSON.parse(raw));
  } catch {
    return [];
  }
}

function parseProfileOverrides(raw: string | null | undefined) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const overrides: Record<string, unknown> = {};
    if (Object.prototype.hasOwnProperty.call(parsed, 'grade')) overrides.grade = parsed.grade;
    if (Object.prototype.hasOwnProperty.call(parsed, 'income')) overrides.income = parsed.income;
    if (Object.prototype.hasOwnProperty.call(parsed, 'gpa')) overrides.gpa = parsed.gpa;
    if (Object.prototype.hasOwnProperty.call(parsed, 'trackId')) overrides.trackId = parsed.trackId;
    return overrides;
  } catch {
    return {};
  }
}

type WatchlistState = {
  keywords: string[];
  tags: string[];
};

type WatchlistMatcher = {
  keywords: string[];
  tagSet: Set<string>;
};

function normalizeWatchlistItems(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const cleaned = raw
    .map((item) => String(item ?? '').trim())
    .filter((item) => item.length > 0 && item.length <= WATCHLIST_MAX_LENGTH);
  return Array.from(new Set(cleaned)).slice(0, WATCHLIST_MAX_ITEMS);
}

function parseWatchlistState(rawState: string | null | undefined): WatchlistState {
  if (!rawState) return { keywords: [], tags: [] };
  try {
    const parsed = JSON.parse(rawState) as Record<string, unknown>;
    const watchlist = parsed?.watchlist;
    if (!watchlist || typeof watchlist !== 'object' || Array.isArray(watchlist)) {
      return { keywords: [], tags: [] };
    }

    const watchlistRaw = watchlist as Record<string, unknown>;
    return {
      keywords: normalizeWatchlistItems(watchlistRaw.keywords),
      tags: normalizeWatchlistItems(watchlistRaw.tags),
    };
  } catch {
    return { keywords: [], tags: [] };
  }
}

function buildWatchlistMatcher(rawState: string | null | undefined): WatchlistMatcher {
  const state = parseWatchlistState(rawState);
  const keywords = state.keywords
    .map((keyword) => keyword.toLowerCase())
    .filter(Boolean);
  const tagSet = new Set(state.tags.map((tag) => toTagSlug(tag)).filter(Boolean));
  return { keywords, tagSet };
}

function matchesWatchlist(
  notice: {
    title: string;
    summary?: string | null;
    content?: string | null;
    tags?: Array<{ tag?: { name?: string | null; slug?: string | null } }>;
  },
  matcher: WatchlistMatcher,
) {
  if (matcher.keywords.length === 0 && matcher.tagSet.size === 0) return false;

  if (matcher.keywords.length > 0) {
    const haystack = [notice.title, notice.summary, notice.content]
      .map((value) => (typeof value === 'string' ? value : ''))
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (haystack && matcher.keywords.some((keyword) => haystack.includes(keyword))) {
      return true;
    }
  }

  if (matcher.tagSet.size === 0) return false;
  for (const entry of notice.tags ?? []) {
    const rawName = typeof entry.tag?.name === 'string' ? entry.tag?.name : '';
    const rawSlug = typeof entry.tag?.slug === 'string' ? entry.tag?.slug : '';
    const normalizedName = rawName ? toTagSlug(rawName) : '';
    const normalizedSlug = rawSlug ? toTagSlug(rawSlug) : '';
    if ((normalizedName && matcher.tagSet.has(normalizedName)) || (normalizedSlug && matcher.tagSet.has(normalizedSlug))) {
      return true;
    }
  }

  return false;
}

function isScholarshipSignal(notice: {
  title: string;
  scholarshipType?: string | null;
}) {
  return (
    (notice.scholarshipType &&
      notice.scholarshipType !== 'Other' &&
      notice.scholarshipType !== 'Program' &&
      notice.scholarshipType !== 'Job') ||
    notice.title.includes('장학') ||
    notice.title.includes('지원금') ||
    notice.title.includes('성적장학')
  );
}

function matchesCategory(notice: {
  category: string;
  title: string;
  scholarshipType?: string | null;
}, category: NormalizedCategory) {
  const lowerCat = String(notice.category || '').toLowerCase();
  const mixed = lowerCat.includes('academic') && lowerCat.includes('scholarship');

  if (category === 'Academic') {
    if (mixed) return !isScholarshipSignal(notice);
    return lowerCat.includes('academic');
  }

  if (category === 'Scholarship') {
    if (mixed) return isScholarshipSignal(notice);
    return lowerCat.includes('scholarship');
  }

  if (category === 'General') return lowerCat.includes('general');
  if (category === 'Employment') return lowerCat.includes('employment');
  return lowerCat.includes('news');
}

function toTagSlug(rawName: string) {
  return rawName
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type SerializedNoticeTag = {
  id?: number;
  slug: string;
  name: string;
};

function serializeNoticeTags(tags: Array<{ tag?: { id?: number; slug?: string; name?: string } }>): SerializedNoticeTag[] {
  const deduped = new Map<string, SerializedNoticeTag>();

  for (const entry of tags) {
    const rawTag = entry.tag;
    if (!rawTag) continue;
    const name = typeof rawTag.name === 'string' ? rawTag.name.trim() : '';
    const rawSlug = typeof rawTag.slug === 'string' ? rawTag.slug.trim() : '';
    const resolvedName = name || rawSlug;
    const slug = toTagSlug(rawSlug || resolvedName);
    if (!resolvedName || !slug) continue;

    if (deduped.has(slug)) continue;
    deduped.set(slug, {
      id: typeof rawTag.id === 'number' && Number.isFinite(rawTag.id) ? rawTag.id : undefined,
      slug,
      name: resolvedName,
    });
  }

  return Array.from(deduped.values());
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const session = await resolveUserProfile(request);
    const autoCrawl = searchParams.get('autoCrawl') !== '0';
    const limit = normalizeNoticeLimit(searchParams.get('limit'));
    const sort = normalizeSort(searchParams.get('sort'));
    const deadlineWithinDays = normalizePositiveInt(searchParams.get('deadlineWithinDays'));
    const favoriteOnly = normalizeBooleanFlag(searchParams.get('favoriteOnly'));
    const eligibilityExplainEnabled = ELIGIBILITY_EXPLAIN_ENABLED;
    const eligibleOnly = eligibilityExplainEnabled && normalizeBooleanFlag(searchParams.get('eligibleOnly'));
    const watchlistOnly = WATCHLIST_ENABLED && normalizeBooleanFlag(searchParams.get('watchlistOnly'));
    const watchlistMatcher = WATCHLIST_ENABLED ? buildWatchlistMatcher(session.profile.dashboardState) : null;

    const rawTags = searchParams.getAll('tags');
    const tagMode = (searchParams.get('mode') || searchParams.get('tagMode') || 'any').toLowerCase() === 'all' ? 'all' : 'any';
    const tagsFromQuery = normalizeStringArray(
      (rawTags.length ? rawTags : (searchParams.get('tags') || '').split(','))
        .flatMap((value) => String(value).split(',')),
    );

    const rawCategories = searchParams.getAll('categories');
    const categoryFromQuery = normalizeStringArray(
      (rawCategories.length ? rawCategories : (searchParams.get('category') || '').split(','))
        .flatMap((value) => String(value).split(',')),
    )
      .map((category) => normalizeCategory(category))
      .filter((category): category is NormalizedCategory => category !== null);

    const presetId = normalizePositiveInt(searchParams.get('presetId'));
    const preset = presetId
      ? await prisma.noticePreset.findFirst({
        where: {
          id: presetId,
          userId: session.userId,
        },
      })
      : null;

    const presetTags = parseJsonStringArray(preset?.tags);
    const presetCategories = parseJsonStringArray(preset?.categories)
      .map((category) => normalizeCategory(category))
      .filter((category): category is NormalizedCategory => category !== null);
    const presetProfileOverrides = parseProfileOverrides(preset?.profileOverrides);

    const tags = Array.from(new Set([...tagsFromQuery, ...presetTags]));
    const categories = Array.from(new Set([...categoryFromQuery, ...presetCategories]));

    const previewProfileOverrides: Record<string, unknown> = {};
    if (searchParams.has('previewGrade')) previewProfileOverrides.grade = searchParams.get('previewGrade');
    if (searchParams.has('previewIncome')) previewProfileOverrides.income = searchParams.get('previewIncome');
    if (searchParams.has('previewGpa')) previewProfileOverrides.gpa = searchParams.get('previewGpa');
    if (searchParams.has('previewTrackId')) previewProfileOverrides.trackId = searchParams.get('previewTrackId');

    const recommendationProfile = normalizeRecommendationProfile({
      grade: session.profile.grade,
      income: session.profile.income,
      gpa: session.profile.gpa,
      trackId: session.profile.trackId,
      ...presetProfileOverrides,
      ...previewProfileOverrides,
    });

    const tagFilter = (tag: string): Prisma.NoticeWhereInput => ({
      tags: {
        some: {
          tag: {
            OR: [{ name: tag }, { slug: tag }],
          },
        },
      },
    });

    if (autoCrawl) {
      startNoticeAutoCrawler();
      void ensureFreshNotices('api:notices').catch((error) => {
        console.error('[api/notices] autoCrawl failed:', error);
      });
    }

    const where: Prisma.NoticeWhereInput = tags.length
      ? tagMode === 'all'
        ? { AND: tags.map((tag) => tagFilter(tag)) }
        : { OR: tags.map((tag) => tagFilter(tag)) }
      : {};

    const notices = await prisma.notice.findMany({
      where,
      include: {
        tags: {
          include: { tag: true },
        },
      },
      take: limit,
      orderBy: { id: 'desc' },
    });

    const normalizedNotices = notices
      .map((notice) => {
        if (!notice.content) return notice;
        const extracted = extractApplicationDeadlineFromText(`${notice.title} ${notice.content}`);
        if (!extracted || extracted === notice.deadline) return notice;
        return {
          ...notice,
          deadline: extracted,
        };
      })
      .filter((notice) => {
        if (categories.length === 0) return true;
        return categories.some((category) => matchesCategory(notice, category));
      });

    const noticeIds = normalizedNotices.map((notice) => notice.id);
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
    const favorites = noticeIds.length > 0
      ? await prisma.noticeFavorite.findMany({
        where: {
          userId: session.userId,
          noticeId: { in: noticeIds },
        },
        select: {
          noticeId: true,
        },
      })
      : [];
    const favoriteNoticeIdSet = new Set<number>(favorites.map((favorite) => favorite.noticeId));
    const favoriteCounts = noticeIds.length > 0
      ? await prisma.noticeFavorite.groupBy({
        by: ['noticeId'],
        where: {
          noticeId: { in: noticeIds },
        },
        _count: {
          noticeId: true,
        },
      })
      : [];
    const favoriteCountByNoticeId = new Map<number, number>(
      favoriteCounts.map((entry) => [entry.noticeId, entry._count.noticeId]),
    );

    type NoticeWithTags = Prisma.NoticeGetPayload<{
      include: { tags: { include: { tag: true } } };
    }>;

    const serializedNotices = (normalizedNotices as NoticeWithTags[])
      .map((notice) => {
        const actionState = actionByNoticeId.get(notice.id) ?? null;
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
          recommendationProfile,
        );
        const eligibility = eligibilityExplainEnabled
          ? computeEligibility(
              {
                minGrade: notice.minGrade,
                maxIncome: notice.maxIncome,
                minGpa: notice.minGpa,
              },
              recommendationProfile,
            )
          : null;

        if (deadlineWithinDays !== null && relevance.dday !== null) {
          if (relevance.dday < 0 || relevance.dday > deadlineWithinDays) return null;
        } else if (deadlineWithinDays !== null && relevance.dday === null) {
          return null;
        }

        if (eligibleOnly && eligibility?.status !== 'eligible') return null;

        const watchlistMatched = watchlistMatcher ? matchesWatchlist(notice, watchlistMatcher) : false;
        if (watchlistOnly && !watchlistMatched) return null;

        const isFavorite = favoriteNoticeIdSet.has(notice.id);
        if (favoriteOnly && !isFavorite) return null;
        const favoriteCount = favoriteCountByNoticeId.get(notice.id) ?? 0;
        const isActionPending = actionState !== 'done' && actionState !== 'dismissed';
        const isDeadlineNear = typeof relevance.dday === 'number' && relevance.dday >= 0 && relevance.dday <= 5;
        const lowEngagement = favoriteCount <= 1;
        const isEasyToMiss = Boolean(isDeadlineNear && lowEngagement && isActionPending && !notice.isPinned);
        const publishedAtTs = parseNoticeDate(notice.date)?.getTime() ?? 0;
        const freshnessBoost = computeFreshnessBoost(notice.date);

        return {
          ...notice,
          tags: serializeNoticeTags(notice.tags || []),
          tagNames: Array.isArray(notice.tags)
            ? notice.tags
              .map((entry) => entry.tag?.name)
              .filter((name): name is string => typeof name === 'string' && name.length > 0)
            : [],
          relevanceScore: relevance.score,
          relevanceReasons: relevance.reasons as RelevanceReason[],
          isUrgent: relevance.isUrgent,
          urgency: relevance.urgency,
          dday: relevance.dday,
          ...(WATCHLIST_ENABLED ? { matchesWatchlist: watchlistMatched } : {}),
          ...(eligibilityExplainEnabled && eligibility
            ? { eligibilityStatus: eligibility.status, eligibilityReasons: eligibility.reasons }
            : {}),
          actionState,
          isFavorite,
          favoriteCount,
          isEasyToMiss,
          publishedAtTs,
          freshnessBoost,
        };
      })
      .filter((notice): notice is NonNullable<typeof notice> => notice !== null)
      .sort((a, b) => {
        const aOverdue = typeof a.dday === 'number' && a.dday < 0;
        const bOverdue = typeof b.dday === 'number' && b.dday < 0;

        if (sort === 'relevance') {
          if (aOverdue !== bOverdue) return aOverdue ? 1 : -1;
          const aRank = a.relevanceScore + a.freshnessBoost;
          const bRank = b.relevanceScore + b.freshnessBoost;
          return bRank - aRank || b.publishedAtTs - a.publishedAtTs || b.id - a.id;
        }

        if (sort === 'deadline') {
          const aDeadline = parseDeadlineDate(a.deadline);
          const bDeadline = parseDeadlineDate(b.deadline);
          if (!aDeadline && !bDeadline) return b.id - a.id;
          if (!aDeadline) return 1;
          if (!bDeadline) return -1;
          const aDday = computeDday(aDeadline);
          const bDday = computeDday(bDeadline);
          return aDday - bDday || b.relevanceScore - a.relevanceScore || b.id - a.id;
        }

        return b.publishedAtTs - a.publishedAtTs || b.id - a.id;
      })
      .map((notice) => {
        const { freshnessBoost, publishedAtTs, ...serializedNotice } = notice;
        void freshnessBoost;
        void publishedAtTs;
        return serializedNotice;
      });

    const response = NextResponse.json({
      success: true,
      notices: serializedNotices,
      sort,
      recommendationProfile,
      favoriteOnly,
      appliedPreset: preset
        ? {
          id: preset.id,
          name: preset.name,
          categories,
          tags,
        }
        : null,
      autoCrawler: await getNoticeAutoCrawlerStatus(),
    });
    applySessionCookieHeader(response, session.setCookie);
    return response;
  } catch (error) {
    console.error('Read Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
