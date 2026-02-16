import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applySessionCookieHeader } from '@/lib/sessionUser';
import { resolveUserProfile } from '@/lib/userProfileResolver';
import { normalizeActionState } from '@/lib/noticePersonalization';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await resolveUserProfile(request);
    const body = await request.json().catch(() => ({} as Record<string, unknown>));

    const noticeId = Number((body as { noticeId?: unknown }).noticeId);
    const actionState = normalizeActionState((body as { state?: unknown }).state);

    if (!Number.isInteger(noticeId) || noticeId <= 0) {
      const invalidNoticeResponse = NextResponse.json({ success: false, error: 'noticeId must be a positive integer' }, { status: 400 });
      applySessionCookieHeader(invalidNoticeResponse, session.setCookie);
      return invalidNoticeResponse;
    }

    if (!actionState) {
      const invalidStateResponse = NextResponse.json(
        { success: false, error: 'state must be one of todo|in_progress|done|dismissed' },
        { status: 400 },
      );
      applySessionCookieHeader(invalidStateResponse, session.setCookie);
      return invalidStateResponse;
    }

    const notice = await prisma.notice.findUnique({
      where: { id: noticeId },
      select: { id: true },
    });
    if (!notice) {
      const notFoundResponse = NextResponse.json({ success: false, error: 'notice not found' }, { status: 404 });
      applySessionCookieHeader(notFoundResponse, session.setCookie);
      return notFoundResponse;
    }

    const action = await prisma.noticeAction.upsert({
      where: {
        userId_noticeId: {
          userId: session.userId,
          noticeId,
        },
      },
      update: { state: actionState },
      create: {
        userId: session.userId,
        noticeId,
        state: actionState,
      },
      select: {
        id: true,
        userId: true,
        noticeId: true,
        state: true,
        updatedAt: true,
      },
    });

    const response = NextResponse.json({ success: true, action });
    applySessionCookieHeader(response, session.setCookie);
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
