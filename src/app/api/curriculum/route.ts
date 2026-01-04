import { NextResponse } from 'next/server';
import curriculum from '@/lib/curriculum.json';

export async function GET() {
    try {
        // curriculum.json에서 트랙 정보 읽기
        const tracksData = (curriculum as any).tracks;

        const tracks = Object.entries(tracksData).map(([id, track]: [string, any], index) => ({
            id: index + 1,
            key: id,
            name: track.name,
            required: track.required
        }));

        return NextResponse.json({ success: true, tracks });
    } catch (e) {
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}
