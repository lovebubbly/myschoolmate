import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveUserProfile } from '@/lib/userProfileResolver';
import { applySessionCookieHeader } from '@/lib/sessionUser';

export const dynamic = 'force-dynamic';

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export async function POST(request: Request) {
  try {
    const session = await resolveUserProfile(request);
    const body = await request.json().catch(() => ({} as Record<string, unknown>));

    const endpoint = toNonEmptyString(
      (body as { endpoint?: unknown; subscription?: { endpoint?: unknown } | null }).endpoint
      ?? (body as { subscription?: { endpoint?: unknown } | null }).subscription?.endpoint,
    );

    if (!endpoint) {
      const invalidResponse = NextResponse.json(
        { success: false, error: 'endpoint is required' },
        { status: 400 },
      );
      applySessionCookieHeader(invalidResponse, session.setCookie);
      return invalidResponse;
    }

    const removed = await prisma.pushSubscription.deleteMany({
      where: {
        userId: session.userId,
        endpoint,
      },
    });

    const response = NextResponse.json({
      success: true,
      removed: removed.count,
    });
    applySessionCookieHeader(response, session.setCookie);
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
