import { NextResponse } from 'next/server';
import {
    applySessionCookieHeader,
    createNewSessionProfile,
} from '@/lib/sessionUser';
import { resolveUserProfile } from '@/lib/userProfileResolver';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await resolveUserProfile(request);
        const response = NextResponse.json({
            success: true,
            userId: session.userId,
            profile: session.profile,
            source: session.source,
        });
        applySessionCookieHeader(response, session.setCookie);
        return response;
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function POST() {
    try {
        const session = await createNewSessionProfile();
        const response = NextResponse.json({
            success: true,
            userId: session.userId,
            profile: session.profile,
        });
        applySessionCookieHeader(response, session.setCookie);
        return response;
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
