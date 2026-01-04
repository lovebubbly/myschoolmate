import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
    try {
        await prisma.notice.deleteMany({});
        return NextResponse.json({ success: true, message: 'All notices deleted.' });
    } catch (e) {
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}
