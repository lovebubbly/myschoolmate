import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAction } from '@/lib/adminActionGuard';

export async function POST(request: Request) {
    const guard = requireAdminAction(request);
    if (!guard.ok) {
        return guard.response;
    }

    try {
        await prisma.notice.deleteMany({});
        return NextResponse.json({ success: true, message: 'All notices deleted.' });
    } catch (e) {
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}
