import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    getNoticeAutoCrawlerStatus,
    triggerNoticeCrawl,
} from '@/lib/noticeAutoCrawler';
import { requireAdminAction } from '@/lib/adminActionGuard';
import type { Prisma } from '@prisma/client';

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

        const rawId = (rawTag as { id?: number }).id;
        deduped.set(slug, {
            id: typeof rawId === 'number' && Number.isFinite(rawId) ? rawId : undefined,
            slug,
            name: resolvedName,
        });
    }

    return Array.from(deduped.values());
}

export async function POST(request: Request) {
    const guard = requireAdminAction(request);
    if (!guard.ok) {
        return guard.response;
    }

    try {
        // 1. Run crawler with global lock
        const crawl = await triggerNoticeCrawl('api:notices:crawl', { refreshExisting: true });

        // 2. Fetch fresh data from DB
        const notices = await prisma.notice.findMany({
            include: {
                tags: {
                    include: { tag: true },
                },
            },
            orderBy: { id: 'desc' }
        });

        const serializedNotices = notices.map((notice: Prisma.NoticeGetPayload<{
            include: { tags: { include: { tag: true } } };
        }>) => ({
            ...notice,
            tags: serializeNoticeTags(notice.tags || []),
            tagNames: (notice.tags || []).map((entry) => entry.tag.name).filter((name): name is string => Boolean(name)),
        }));

        return NextResponse.json({
            success: true,
            notices: serializedNotices,
            crawl,
            autoCrawler: getNoticeAutoCrawlerStatus(),
        });
    } catch (error) {
        console.error('Crawl Error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
