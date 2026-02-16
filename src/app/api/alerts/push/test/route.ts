import { NextResponse } from 'next/server';
import { resolveUserProfile } from '@/lib/userProfileResolver';
import { applySessionCookieHeader } from '@/lib/sessionUser';
import { isWebPushConfigured } from '@/lib/webPush';
import { sendPushToUser } from '@/lib/pushAlerts';

export const dynamic = 'force-dynamic';

function toText(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

export async function POST(request: Request) {
  try {
    const session = await resolveUserProfile(request);
    if (!isWebPushConfigured()) {
      const unavailableResponse = NextResponse.json(
        { success: false, error: 'web push is not configured' },
        { status: 503 },
      );
      applySessionCookieHeader(unavailableResponse, session.setCookie);
      return unavailableResponse;
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const payload = {
      title: toText(body.title, 'MySchoolMate 푸시 테스트'),
      body: toText(body.body, '웹 푸시 알림이 정상적으로 동작합니다.'),
      url: toText(body.url, '/'),
      tag: `push-test-${Date.now()}`,
    };

    const result = await sendPushToUser(session.userId, payload);
    const response = NextResponse.json({
      success: true,
      result,
    });
    applySessionCookieHeader(response, session.setCookie);
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
