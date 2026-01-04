
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Hardcoded Single User for MVP
const USER_ID = 1;

export async function GET() {
    try {
        let profile = await prisma.userProfile.findUnique({
            where: { id: USER_ID }
        });

        if (!profile) {
            // Create default if not exists
            profile = await prisma.userProfile.create({
                data: {
                    grade: 1,
                    income: 10,
                    gpa: 0.0
                }
            });
        }

        return NextResponse.json({ success: true, profile });
    } catch (e) {
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { grade, income, gpa, trackId } = body;

        const profile = await prisma.userProfile.upsert({
            where: { id: USER_ID },
            update: {
                grade: parseInt(grade),
                income: parseInt(income),
                gpa: gpa !== undefined ? parseFloat(gpa) : undefined,
                trackId: trackId ? parseInt(trackId) : null
            },
            create: {
                id: USER_ID,
                grade: parseInt(grade),
                income: parseInt(income),
                gpa: gpa !== undefined ? parseFloat(gpa) : 0.0,
                trackId: trackId ? parseInt(trackId) : null
            }
        });

        return NextResponse.json({ success: true, profile });
    } catch (e) {
        console.error('API POST /api/user/profile - Error:', e);
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}
