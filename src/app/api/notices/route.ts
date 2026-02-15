import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { extractApplicationDeadlineFromText } from '@/lib/deadlineExtractor';
import {
    ensureFreshNotices,
    getNoticeAutoCrawlerStatus,
    startNoticeAutoCrawler,
} from '@/lib/noticeAutoCrawler';

export const dynamic = 'force-dynamic'; // Ensure no caching for latest data
const DEFAULT_NOTICE_LIMIT = 200;
const MAX_NOTICE_LIMIT = 500;

function normalizeNoticeLimit(raw: string | null) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_NOTICE_LIMIT;
    const normalized = Math.trunc(parsed);
    if (normalized <= 0) return DEFAULT_NOTICE_LIMIT;
    if (normalized > MAX_NOTICE_LIMIT) return MAX_NOTICE_LIMIT;
    return normalized;
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
        const autoCrawl = searchParams.get('autoCrawl') !== '0';
        const limit = normalizeNoticeLimit(searchParams.get('limit'));

        const rawTags = searchParams.getAll('tags');
        const tagMode = (searchParams.get('mode') || searchParams.get('tagMode') || 'any').toLowerCase() === 'all' ? 'all' : 'any';
        const tags = (rawTags.length ? rawTags : (searchParams.get('tags') || '').split(','))
            .flatMap((value) => value.split(','))
            .map((value) => value.trim())
            .filter(Boolean);
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
            await ensureFreshNotices('api:notices');
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
            orderBy: { id: 'desc' }, // or createdAt desc
        });

        const normalizedNotices = notices.map((notice) => {
            if (!notice.content) return notice;
            const extracted = extractApplicationDeadlineFromText(`${notice.title} ${notice.content}`);
            if (!extracted || extracted === notice.deadline) return notice;
            return {
                ...notice,
                deadline: extracted,
            };
        });
        type NoticeWithTags = Prisma.NoticeGetPayload<{
            include: { tags: { include: { tag: true } } };
        }>;

        const serializedNotices = (normalizedNotices as NoticeWithTags[]).map((notice) => ({
            ...notice,
            tags: serializeNoticeTags(notice.tags || []),
            tagNames: Array.isArray(notice.tags) ? notice.tags.map((entry) => entry.tag?.name).filter((name): name is string => typeof name === 'string' && name.length > 0) : [],
        }));

        return NextResponse.json({
            success: true,
            notices: serializedNotices,
            autoCrawler: getNoticeAutoCrawlerStatus(),
        });
    } catch (error) {
        console.error('Read Error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
