import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractApplicationDeadlineFromText } from '@/lib/deadlineExtractor';
import { computeDday, parseDeadlineDate } from '@/lib/noticePersonalization';

export const dynamic = 'force-dynamic';

function normalizePositiveInt(raw: string | null, fallback: number, max: number) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  if (normalized <= 0) return fallback;
  return Math.min(max, normalized);
}

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const withinDays = normalizePositiveInt(searchParams.get('withinDays'), 60, 365);
    const limit = normalizePositiveInt(searchParams.get('limit'), 120, 400);

    const notices = await prisma.notice.findMany({
      where: {
        deadline: { not: null },
      },
      select: {
        id: true,
        title: true,
        url: true,
        deadline: true,
        content: true,
        category: true,
      },
      orderBy: { id: 'desc' },
      take: 700,
    });

    const events = notices
      .map((notice) => {
        const deadlineRaw = notice.deadline || extractApplicationDeadlineFromText(`${notice.title} ${notice.content || ''}`);
        const deadlineDate = parseDeadlineDate(deadlineRaw);
        if (!deadlineDate) return null;

        const dday = computeDday(deadlineDate);
        if (dday < 0 || dday > withinDays) return null;

        const endDate = new Date(deadlineDate);
        endDate.setDate(endDate.getDate() + 1);

        return {
          id: notice.id,
          title: notice.title,
          url: notice.url,
          category: notice.category,
          dday,
          startDateOnly: formatDateOnly(deadlineDate),
          endDateOnly: formatDateOnly(endDate),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.dday - b.dday || b.id - a.id)
      .slice(0, limit);

    const stamp = formatUtcStamp(new Date());
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MySchoolMate//Deadline Feed//KO',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:MySchoolMate 마감 캘린더',
      'X-WR-TIMEZONE:Asia/Seoul',
    ];

    for (const event of events) {
      const summary = escapeIcsText(`${event.title} (마감)`);
      const description = escapeIcsText(`[${event.category}] 마감 D-${event.dday}\n원문: ${event.url}`);
      lines.push(
        'BEGIN:VEVENT',
        `UID:deadline-feed-${event.id}@myschoolmate.local`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${event.startDateOnly}`,
        `DTEND;VALUE=DATE:${event.endDateOnly}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        `URL:${escapeIcsText(event.url)}`,
        'END:VEVENT',
      );
    }

    lines.push('END:VCALENDAR', '');

    return new NextResponse(lines.join('\r\n'), {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="myschoolmate-deadlines.ics"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
