import { NextResponse } from 'next/server';
import { resolveUserProfile } from '@/lib/userProfileResolver';
import { applySessionCookieHeader } from '@/lib/sessionUser';
import { isSmtpConfigured, sendEmail } from '@/lib/emailSender';

export const dynamic = 'force-dynamic';

function parseEmail(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
    return normalized;
}

export async function POST(request: Request) {
    try {
        const session = await resolveUserProfile(request);
        const body = await request.json().catch(() => ({}));
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            const invalidResponse = NextResponse.json({
                success: false,
                error: 'Invalid request body.',
            }, { status: 400 });
            applySessionCookieHeader(invalidResponse, session.setCookie);
            return invalidResponse;
        }
        const bodyEmail = parseEmail((body as { email?: unknown }).email);
        const hasBodyEmail = Object.prototype.hasOwnProperty.call(body, 'email');
        const profileEmail = parseEmail(session.profile.notificationEmail) ?? parseEmail(session.profile.email);
        if (hasBodyEmail && bodyEmail === null) {
            return NextResponse.json({
                success: false,
                error: 'Invalid email format.',
            }, { status: 400 });
        }

        const to = bodyEmail ?? profileEmail;

        if (!to) {
            const noEmailResponse = NextResponse.json({
                success: false,
                error: 'notificationEmail이 설정되어 있지 않습니다.',
            }, { status: 400 });
            applySessionCookieHeader(noEmailResponse, session.setCookie);
            return noEmailResponse;
        }

        const nowKst = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
        const subject = '[MySchoolMate] 메일 알림 테스트';
        const text = [
            'MySchoolMate 테스트 메일입니다.',
            '',
            `발송 시각(KST): ${nowKst}`,
            `사용자 ID: ${session.userId}`,
            '',
            '이 메일을 받았다면 메일 알림 채널이 정상입니다.',
        ].join('\n');

        const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5;">
                <h2 style="margin: 0 0 12px;">MySchoolMate 테스트 메일</h2>
                <p>메일 알림 채널 연결 테스트입니다.</p>
                <ul>
                    <li>발송 시각(KST): ${nowKst}</li>
                    <li>사용자 ID: ${session.userId}</li>
                </ul>
                <p>이 메일을 받았다면 설정이 정상입니다.</p>
            </div>
        `;

        const sendResult = await sendEmail({ to, subject, text, html });
        const response = NextResponse.json({
            success: sendResult.ok,
            mode: sendResult.mode,
            smtpConfigured: isSmtpConfigured(),
            to,
            messageId: sendResult.messageId ?? null,
            error: sendResult.error ?? null,
        }, { status: sendResult.ok ? 200 : 500 });
        applySessionCookieHeader(response, session.setCookie);
        return response;
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
