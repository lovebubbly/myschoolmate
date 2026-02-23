import { NextResponse } from 'next/server';
import { requireAdminAction } from '@/lib/adminActionGuard';
import { getDomFingerprintStatus } from '@/lib/noticeDomFingerprint';

export async function GET(request: Request) {
    const guard = requireAdminAction(request);
    if (!guard.ok) {
        return guard.response;
    }

    try {
        const boards = await getDomFingerprintStatus();
        return NextResponse.json({ success: true, boards });
    } catch (error) {
        console.error('[dom-fingerprint] status failed', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
