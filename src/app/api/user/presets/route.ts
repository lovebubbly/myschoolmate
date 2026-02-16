import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applySessionCookieHeader } from '@/lib/sessionUser';
import { resolveUserProfile } from '@/lib/userProfileResolver';

export const dynamic = 'force-dynamic';

type PresetProfileOverrides = {
  grade?: number;
  income?: number;
  gpa?: number;
  trackId?: number | null;
};

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .map((item) => String(item || '').trim())
        .filter(Boolean),
    ),
  );
}

function parseProfileOverrides(raw: unknown): PresetProfileOverrides | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const output: PresetProfileOverrides = {};

  if (Object.prototype.hasOwnProperty.call(input, 'grade')) {
    const grade = Number(input.grade);
    if (!Number.isInteger(grade) || grade < 1 || grade > 4) return null;
    output.grade = grade;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'income')) {
    const income = Number(input.income);
    if (!Number.isInteger(income) || income < 0 || income > 10) return null;
    output.income = income;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'gpa')) {
    const gpa = Number(input.gpa);
    if (!Number.isFinite(gpa) || gpa < 0 || gpa > 4.5) return null;
    output.gpa = gpa;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'trackId')) {
    if (input.trackId === null) {
      output.trackId = null;
    } else {
      const trackId = Number(input.trackId);
      if (!Number.isInteger(trackId) || trackId < 1) return null;
      output.trackId = trackId;
    }
  }

  return output;
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    return normalizeStringArray(JSON.parse(raw));
  } catch {
    return [];
  }
}

function parseJsonObject(raw: string | null): PresetProfileOverrides | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parseProfileOverrides(parsed);
  } catch {
    return null;
  }
}

function serializePreset(preset: {
  id: number;
  userId: number;
  name: string;
  categories: string | null;
  tags: string | null;
  profileOverrides: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: preset.id,
    userId: preset.userId,
    name: preset.name,
    categories: parseJsonArray(preset.categories),
    tags: parseJsonArray(preset.tags),
    profileOverrides: parseJsonObject(preset.profileOverrides),
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt,
  };
}

export async function GET(request: Request) {
  try {
    const session = await resolveUserProfile(request);
    const presets = await prisma.noticePreset.findMany({
      where: { userId: session.userId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });

    const response = NextResponse.json({
      success: true,
      presets: presets.map(serializePreset),
    });
    applySessionCookieHeader(response, session.setCookie);
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await resolveUserProfile(request);
    const body = await request.json().catch(() => ({} as Record<string, unknown>));

    const id = body && typeof body === 'object' ? Number((body as { id?: unknown }).id) : NaN;
    const name = String((body as { name?: unknown }).name || '').trim();
    const categories = normalizeStringArray((body as { categories?: unknown }).categories);
    const tags = normalizeStringArray((body as { tags?: unknown }).tags);
    const profileOverrides = parseProfileOverrides((body as { profileOverrides?: unknown }).profileOverrides);

    if (!name) {
      const invalidNameResponse = NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
      applySessionCookieHeader(invalidNameResponse, session.setCookie);
      return invalidNameResponse;
    }
    if (name.length > 40) {
      const invalidLengthResponse = NextResponse.json({ success: false, error: 'name must be 40 chars or fewer' }, { status: 400 });
      applySessionCookieHeader(invalidLengthResponse, session.setCookie);
      return invalidLengthResponse;
    }
    if ((body as { profileOverrides?: unknown }).profileOverrides !== undefined && profileOverrides === null) {
      const invalidOverridesResponse = NextResponse.json({ success: false, error: 'invalid profileOverrides' }, { status: 400 });
      applySessionCookieHeader(invalidOverridesResponse, session.setCookie);
      return invalidOverridesResponse;
    }

    const payload = {
      name,
      categories: categories.length > 0 ? JSON.stringify(categories) : null,
      tags: tags.length > 0 ? JSON.stringify(tags) : null,
      profileOverrides: profileOverrides ? JSON.stringify(profileOverrides) : null,
    };

    const preset = Number.isInteger(id) && id > 0
      ? await prisma.noticePreset.updateMany({
        where: { id, userId: session.userId },
        data: payload,
      }).then(async (result) => {
        if (result.count === 0) return null;
        return prisma.noticePreset.findFirst({
          where: { id, userId: session.userId },
        });
      })
      : await prisma.noticePreset.create({
        data: {
          userId: session.userId,
          ...payload,
        },
      });

    if (!preset) {
      const notFoundResponse = NextResponse.json({ success: false, error: 'preset not found' }, { status: 404 });
      applySessionCookieHeader(notFoundResponse, session.setCookie);
      return notFoundResponse;
    }

    const response = NextResponse.json({
      success: true,
      preset: serializePreset(preset),
    });
    applySessionCookieHeader(response, session.setCookie);
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await resolveUserProfile(request);
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));

    if (!Number.isInteger(id) || id <= 0) {
      const invalidIdResponse = NextResponse.json({ success: false, error: 'id must be a positive integer' }, { status: 400 });
      applySessionCookieHeader(invalidIdResponse, session.setCookie);
      return invalidIdResponse;
    }

    const deleted = await prisma.noticePreset.deleteMany({
      where: {
        id,
        userId: session.userId,
      },
    });

    if (deleted.count === 0) {
      const notFoundResponse = NextResponse.json({ success: false, error: 'preset not found' }, { status: 404 });
      applySessionCookieHeader(notFoundResponse, session.setCookie);
      return notFoundResponse;
    }

    const response = NextResponse.json({ success: true, deletedId: id });
    applySessionCookieHeader(response, session.setCookie);
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
