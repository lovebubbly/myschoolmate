
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const tracks = await prisma.track.findMany({
            include: {
                courses: true
            }
        });

        // Also fetch all courses for a "General" view or if track is unselected
        // But simplified, just return tracks.

        return NextResponse.json({ success: true, tracks });
    } catch (e) {
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}
