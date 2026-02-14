import { NextResponse } from 'next/server';

const TOKEN_HEADER = 'x-admin-token';
const TOKEN_QUERY = 'adminToken';
const TOKEN_COOKIE = 'admin_action_token';

function parseCookieValue(cookieHeader: string | null) {
    if (!cookieHeader) return null;

    const cookies = cookieHeader
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean);

    const tokenCookie = cookies
        .find((part) => part.startsWith(`${TOKEN_COOKIE}=`));

    if (!tokenCookie) return null;
    return tokenCookie.slice(`${TOKEN_COOKIE}=`.length);
}

function extractClientIp(request: Request): string {
    const headers = request.headers;
    const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const realIp = headers.get('x-real-ip')?.trim();
    return forwarded || realIp || headers.get('x-client-ip')?.trim() || request.headers.get('cf-connecting-ip')?.trim() || 'unknown';
}

function isLocalIp(ip: string) {
    return ip === '127.0.0.1' || ip === '::1' || ip.startsWith('::ffff:127.0.0.1') || ip === 'localhost';
}

export function getAdminAccessMetadata(request: Request) {
    const headers = request.headers;
    const envToken = process.env.ADMIN_ACTION_TOKEN?.trim();
    const route = new URL(request.url).pathname;
    const ip = extractClientIp(request);

    const headerToken = headers.get(TOKEN_HEADER)?.trim() || '';
    const queryToken = new URL(request.url).searchParams.get(TOKEN_QUERY)?.trim() || '';
    const cookieToken = parseCookieValue(headers.get('cookie') ?? '').trim();

    const source = headerToken ? 'header' : queryToken ? 'query' : cookieToken ? 'cookie' : 'none';
    const token = headerToken || queryToken || cookieToken;

    if (!envToken) {
        if (process.env.NODE_ENV !== 'production' || isLocalIp(ip)) {
            return { allowed: true, reason: 'dev-only-no-token', source: 'dev', token, route, ip };
        }
        return {
            allowed: false,
            reason: 'admin token is not configured',
            status: 401,
            source,
            token,
            route,
            ip,
        };
    }

    if (!token) {
        return {
            allowed: false,
            reason: 'admin token is missing',
            status: 401,
            source,
            token,
            route,
            ip,
        };
    }

    if (token !== envToken) {
        return {
            allowed: false,
            reason: 'admin token mismatch',
            status: 403,
            source,
            token,
            route,
            ip,
        };
    }

    return { allowed: true, reason: 'admin token valid', source, token, route, ip };
}

export function requireAdminAction(request: Request) {
    const meta = getAdminAccessMetadata(request);

    if (meta.allowed) {
        return { ok: true as const };
    }

    const { status, reason, source, token, route, ip } = meta;

    console.warn('admin action denied', {
        source,
        ip,
        route,
        reason,
        tokenProvided: Boolean(token),
    });

    return {
        ok: false as const,
        response: NextResponse.json(
            {
                success: false,
                error: reason,
                source,
                ip,
                route,
            },
            { status }
        ),
    };
}
