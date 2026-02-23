import { NextResponse } from 'next/server';
import { requireAdminAction } from '@/lib/adminActionGuard';
import { runDomFingerprintCapture } from '@/lib/noticeDomFingerprint';

export async function POST(request: Request) {
    const guard = requireAdminAction(request);
    if (!guard.ok) {
        return guard.response;
    }

    try {
        const boards = await runDomFingerprintCapture();
        return NextResponse.json({ success: true, boards });
    } catch (error) {
        console.error('[dom-fingerprint] run failed', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
