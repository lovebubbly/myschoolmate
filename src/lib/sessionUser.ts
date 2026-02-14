import type { UserProfile } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const SESSION_COOKIE_NAME = 'myschoolmate_uid';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function parseUserIdFromCookie(cookieHeader: string | null): number | null {
    if (!cookieHeader) return null;

    const pairs = cookieHeader.split(';').map((part) => part.trim());
    const entry = pairs.find((pair) => pair.startsWith(`${SESSION_COOKIE_NAME}=`));
    if (!entry) return null;

    const value = entry.slice(`${SESSION_COOKIE_NAME}=`.length);
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
}

function buildSessionCookie(userId: number) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return `${SESSION_COOKIE_NAME}=${userId}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax; HttpOnly${secure}`;
}

function defaultProfileData() {
    return {
        grade: 1,
        income: 10,
        gpa: 0.0,
    };
}

export type SessionProfileResult = {
    userId: number;
    profile: UserProfile;
    setCookie?: string;
};

export async function getOrCreateSessionProfile(request: Request): Promise<SessionProfileResult> {
    const cookieUserId = parseUserIdFromCookie(request.headers.get('cookie'));

    if (cookieUserId) {
        const existing = await prisma.userProfile.findUnique({ where: { id: cookieUserId } });
        if (existing) {
            return { userId: existing.id, profile: existing };
        }
    }

    const profile = await prisma.userProfile.create({ data: defaultProfileData() });
    return {
        userId: profile.id,
        profile,
        setCookie: buildSessionCookie(profile.id),
    };
}

export async function createNewSessionProfile(): Promise<SessionProfileResult> {
    const profile = await prisma.userProfile.create({ data: defaultProfileData() });
    return {
        userId: profile.id,
        profile,
        setCookie: buildSessionCookie(profile.id),
    };
}

export function applySessionCookieHeader(response: Response, setCookie?: string) {
    if (!setCookie) return;
    response.headers.append('Set-Cookie', setCookie);
}
