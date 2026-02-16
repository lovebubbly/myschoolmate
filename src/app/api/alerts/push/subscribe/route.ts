import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveUserProfile } from '@/lib/userProfileResolver';
import { applySessionCookieHeader } from '@/lib/sessionUser';
import { isWebPushConfigured } from '@/lib/webPush';

export const dynamic = 'force-dynamic';

type PushSubscriptionBody = {
  endpoint?: unknown;
  keys?: {
    p256dh?: unknown;
    auth?: unknown;
  } | null;
};

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
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
    const subscriptionRaw = (
      typeof body.subscription === 'object' && body.subscription !== null
        ? body.subscription
        : body
    ) as PushSubscriptionBody;

    const endpoint = toNonEmptyString(subscriptionRaw.endpoint);
    const p256dh = toNonEmptyString(subscriptionRaw.keys?.p256dh);
    const auth = toNonEmptyString(subscriptionRaw.keys?.auth);

    if (!endpoint || !p256dh || !auth) {
      const invalidResponse = NextResponse.json(
        { success: false, error: 'invalid push subscription payload' },
        { status: 400 },
      );
      applySessionCookieHeader(invalidResponse, session.setCookie);
      return invalidResponse;
    }

    const userAgent = toNonEmptyString(request.headers.get('user-agent'));

    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId: session.userId,
        p256dh,
        auth,
        userAgent,
      },
      create: {
        userId: session.userId,
        endpoint,
        p256dh,
        auth,
        userAgent,
      },
      select: {
        id: true,
        endpoint: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const response = NextResponse.json({
      success: true,
      subscription,
    });
    applySessionCookieHeader(response, session.setCookie);
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
