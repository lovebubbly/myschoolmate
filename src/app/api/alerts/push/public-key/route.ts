import { NextResponse } from 'next/server';
import { getWebPushPublicKey, isWebPushConfigured } from '@/lib/webPush';

export const dynamic = 'force-dynamic';

export async function GET() {
  const publicKey = getWebPushPublicKey();
  return NextResponse.json({
    success: true,
    enabled: isWebPushConfigured(),
    publicKey,
  });
}
