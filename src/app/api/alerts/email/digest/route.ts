import type { UserProfile } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveUserProfile } from '@/lib/userProfileResolver';
import { applySessionCookieHeader } from '@/lib/sessionUser';
import { getAIBriefing } from '@/lib/gemini';
import { isSmtpConfigured, sendEmail } from '@/lib/emailSender';

export const dynamic = 'force-dynamic';

type DigestScope = 'me' | 'all';

function parseEmail(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
    return normalized;
}

function getTodayKst() {
    return new Date()
        .toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: 'Asia/Seoul',
        })
        .replace(/\. /g, '-')
        .replace(/\./g, '');
}

function profileToPrompt(profile: UserProfile) {
    return `학년: ${profile.grade}학년, 소득분위: ${profile.income}구간, GPA: ${profile.gpa || '미입력'}, 트랙: ${profile.trackId || '미선택'}`;
}

function fallbackBriefing(noticeRows: Array<{ title: string; url: string; date: string }>) {
    if (noticeRows.length === 0) {
        return '오늘은 새로운 공지가 아직 없습니다.';
    }

    const top = noticeRows.slice(0, 5);
    const lines = top.map((notice, idx) => `${idx + 1}. ${notice.title} (${notice.date})\n${notice.url}`);
    return `오늘의 공지 요약(대체 모드)\n\n${lines.join('\n\n')}`;
}

function escapeHtml(raw: string) {
    return raw
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

async function getOrCreateBriefing(profile: UserProfile, today: string) {
    const cached = await prisma.dailyBriefing.findFirst({
        where: { userId: profile.id, date: today },
        orderBy: { id: 'desc' },
    });

    if (cached?.content) {
        return cached.content;
    }

    const notices = await prisma.notice.findMany({
        orderBy: { date: 'desc' },
        take: 30,
        select: {
            title: true,
            summary: true,
            url: true,
            date: true,
        },
    });

    let content: string;
    try {
        content = await getAIBriefing(notices, profileToPrompt(profile));
    } catch {
        content = fallbackBriefing(notices.map((item) => ({
            title: item.title,
            url: item.url,
            date: item.date,
        })));
    }

    await prisma.dailyBriefing.create({
        data: {
            userId: profile.id,
            date: today,
            content,
        },
    });

    return content;
}

export async function POST(request: Request) {
    try {
        const session = await resolveUserProfile(request);
        const body = await request.json().catch(() => ({} as Record<string, unknown>));
        const requestedScope: DigestScope = body.scope === 'all' ? 'all' : 'me';
        const force = body.force === true;
        const today = getTodayKst();
        const adminToken = process.env.EMAIL_ALERT_ADMIN_TOKEN?.trim();
        const headerToken = request.headers.get('x-alert-admin-token')?.trim();
        const canUseAllScope = Boolean(adminToken) && adminToken === headerToken;
        const scope: DigestScope = requestedScope === 'all' && canUseAllScope ? 'all' : 'me';

        let targets: UserProfile[] = [];
        if (scope === 'all') {
            targets = await prisma.userProfile.findMany({
                where: {
                    emailAlertsEnabled: true,
                    notificationEmail: { not: null },
                },
            });
        } else {
            const me = await prisma.userProfile.findUnique({ where: { id: session.userId } });
            if (me) targets = [me];
        }

        let attempted = 0;
        let sent = 0;
        let dryRun = 0;
        let failed = 0;
        let skippedDisabled = 0;
        let skippedNoEmail = 0;
        let skippedAlreadySent = 0;

        for (const profile of targets) {
            if (!profile.emailAlertsEnabled) {
                skippedDisabled += 1;
                continue;
            }

            const to = parseEmail(profile.notificationEmail ?? profile.email);
            if (!to) {
                skippedNoEmail += 1;
                continue;
            }

            if (!force && profile.lastEmailedBriefingDate === today) {
                skippedAlreadySent += 1;
                continue;
            }

            const briefing = await getOrCreateBriefing(profile, today);
            const subject = `[MySchoolMate] ${today} 맞춤 브리핑`;
            const text = [
                'MySchoolMate 오늘의 브리핑입니다.',
                '',
                briefing,
                '',
                '앱에서 상세 공지를 바로 확인할 수 있습니다.',
            ].join('\n');

            const html = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6;">
                    <h2 style="margin: 0 0 12px;">${today} 맞춤 브리핑</h2>
                    <pre style="white-space: pre-wrap; background: #f8fafc; border-radius: 8px; padding: 14px; margin: 0;">${escapeHtml(briefing)}</pre>
                </div>
            `;

            attempted += 1;
            const result = await sendEmail({ to, subject, text, html });
            if (result.ok) {
                if (result.mode === 'smtp') {
                    sent += 1;
                    await prisma.userProfile.update({
                        where: { id: profile.id },
                        data: { lastEmailedBriefingDate: today },
                    });
                } else {
                    dryRun += 1;
                }
            } else {
                failed += 1;
            }
        }

        const response = NextResponse.json({
            success: true,
            requestedScope,
            scope,
            downgradedScope: requestedScope === 'all' && scope === 'me',
            force,
            smtpConfigured: isSmtpConfigured(),
            summary: {
                totalTargets: targets.length,
                attempted,
                sent,
                dryRun,
                failed,
                skippedDisabled,
                skippedNoEmail,
                skippedAlreadySent,
            },
        });
        applySessionCookieHeader(response, session.setCookie);
        return response;
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
