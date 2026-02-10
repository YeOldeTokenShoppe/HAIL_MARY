/**
 * Farcaster Mini-App Webhook Handler
 *
 * Neynar manages notification token storage, so this route
 * only needs to log events for debugging/monitoring.
 *
 * Events: miniapp_added, miniapp_removed,
 *         notifications_enabled, notifications_disabled
 */

import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { event, data } = body;

    console.log(`[Farcaster Webhook] ${event} — FID: ${data?.fid}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Farcaster Webhook] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
