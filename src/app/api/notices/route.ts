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

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const autoCrawl = searchParams.get('autoCrawl') !== '0';

        const rawTags = searchParams.getAll('tags');
        const tagMode = (searchParams.get('mode') || searchParams.get('tagMode') || 'any').toLowerCase() === 'all' ? 'all' : 'any';
        const tags = (rawTags.length ? rawTags : (searchParams.get('tags') || '').split(','))
            .flatMap((value) => value.split(','))
            .map((value) => value.trim())
            .filter(Boolean);

        if (autoCrawl) {
            startNoticeAutoCrawler();
            await ensureFreshNotices('api:notices');
        }

        const where: Prisma.NoticeWhereInput = tags.length
            ? tagMode === 'all'
                ? { AND: tags.map((tag) => ({ tags: { some: { tag: { name: tag } } } })) }
                : { tags: { some: { tag: { name: { in: tags } } } } }
            : {};

        const notices = await prisma.notice.findMany({
            where,
            include: {
                tags: {
                    include: { tag: true },
                },
            },
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
            tags: Array.isArray(notice.tags) ? notice.tags.map((entry) => entry.tag.name) : [],
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