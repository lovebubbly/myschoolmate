import { NextResponse } from 'next/server';
import { requireAdminAction } from '@/lib/adminActionGuard';
import { getOpsSnapshot } from '@/lib/opsSnapshot';

export async function GET(request: Request) {
  const guard = requireAdminAction(request);
  if (!guard.ok) {
    return guard.response;
  }

  try {
    const snapshot = await getOpsSnapshot();
    return NextResponse.json({ success: true, snapshot });
  } catch (error) {
    console.error('[ops-snapshot] failed', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
