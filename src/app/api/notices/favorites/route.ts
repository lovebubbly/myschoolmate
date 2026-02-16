import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applySessionCookieHeader } from '@/lib/sessionUser';
import { resolveUserProfile } from '@/lib/userProfileResolver';

export const dynamic = 'force-dynamic';

function normalizeBoolean(raw: unknown): boolean | null {
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true;
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false;
  return null;
}

export async function POST(request: Request) {
  try {
    const session = await resolveUserProfile(request);
    const body = await request.json().catch(() => ({} as Record<string, unknown>));

    const noticeId = Number((body as { noticeId?: unknown }).noticeId);
    const explicitFavorite = normalizeBoolean((body as { isFavorite?: unknown }).isFavorite);

    if (!Number.isInteger(noticeId) || noticeId <= 0) {
      const invalidNoticeResponse = NextResponse.json(
        { success: false, error: 'noticeId must be a positive integer' },
        { status: 400 },
      );
      applySessionCookieHeader(invalidNoticeResponse, session.setCookie);
      return invalidNoticeResponse;
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

    const favoriteKey = {
      userId_noticeId: {
        userId: session.userId,
        noticeId,
      },
    };

    let isFavorite = false;
    if (explicitFavorite === null) {
      const existing = await prisma.noticeFavorite.findUnique({
        where: favoriteKey,
        select: { id: true },
      });
      if (existing) {
        await prisma.noticeFavorite.delete({
          where: favoriteKey,
        });
        isFavorite = false;
      } else {
        await prisma.noticeFavorite.create({
          data: {
            userId: session.userId,
            noticeId,
          },
        });
        isFavorite = true;
      }
    } else if (explicitFavorite) {
      await prisma.noticeFavorite.upsert({
        where: favoriteKey,
        update: {},
        create: {
          userId: session.userId,
          noticeId,
        },
      });
      isFavorite = true;
    } else {
      await prisma.noticeFavorite.deleteMany({
        where: {
          userId: session.userId,
          noticeId,
        },
      });
      isFavorite = false;
    }

    const response = NextResponse.json({
      success: true,
      noticeId,
      isFavorite,
    });
    applySessionCookieHeader(response, session.setCookie);
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
