import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseDeadlineDate } from '@/lib/noticePersonalization';
import { extractApplicationDeadlineFromText } from '@/lib/deadlineExtractor';

export const dynamic = 'force-dynamic';

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function formatDateOnly(date: Date) {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
}

function formatUtcStamp(date: Date) {
  return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`;
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function extractNoticeIdFromPath(url: string): number {
  const { pathname } = new URL(url);
  const match = pathname.match(/\/api\/notices\/(\d+)\/calendar\.ics$/);
  if (!match) return NaN;
  return Number(match[1]);
}

export async function GET(request: Request) {
  try {
    const noticeId = extractNoticeIdFromPath(request.url);
    if (!Number.isInteger(noticeId) || noticeId <= 0) {
      return NextResponse.json({ success: false, error: 'invalid notice id' }, { status: 400 });
    }

    const notice = await prisma.notice.findUnique({
      where: { id: noticeId },
      select: {
        id: true,
        title: true,
        url: true,
        deadline: true,
        content: true,
      },
    });
    if (!notice) {
      return NextResponse.json({ success: false, error: 'notice not found' }, { status: 404 });
    }

    const deadlineRaw = notice.deadline || extractApplicationDeadlineFromText(`${notice.title} ${notice.content || ''}`);
    const deadlineDate = parseDeadlineDate(deadlineRaw);
    if (!deadlineDate) {
      return NextResponse.json(
        { success: false, error: 'deadline not available for this notice' },
        { status: 400 },
      );
    }

    const endDate = new Date(deadlineDate);
    endDate.setDate(endDate.getDate() + 1);

    const stamp = formatUtcStamp(new Date());
    const startDateOnly = formatDateOnly(deadlineDate);
    const endDateOnly = formatDateOnly(endDate);
    const title = escapeIcsText(`${notice.title} (마감)`);
    const description = escapeIcsText(`MySchoolMate 공지 마감 일정\n원문: ${notice.url}`);
    const url = escapeIcsText(notice.url);
    const uid = `notice-${notice.id}@myschoolmate.local`;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MySchoolMate//Notice Calendar//KO',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${startDateOnly}`,
      `DTEND;VALUE=DATE:${endDateOnly}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${description}`,
      `URL:${url}`,
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ].join('\r\n');

    return new NextResponse(icsContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="notice-${notice.id}-deadline.ics"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
