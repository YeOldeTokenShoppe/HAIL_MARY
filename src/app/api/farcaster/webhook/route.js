/**
 * Farcaster Mini-App Webhook Handler (Phase 2)
 *
 * Handles events from Farcaster:
 * - miniapp_added: User added the mini-app
 * - miniapp_removed: User removed the mini-app
 * - notifications_enabled: User opted into notifications
 * - notifications_disabled: User opted out of notifications
 *
 * Stores notification tokens in Firebase for sending push notifications.
 */

import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { event, data } = body;

    switch (event) {
      case 'miniapp_added': {
        console.log('[Farcaster Webhook] Mini-app added by FID:', data?.fid);
        // TODO Phase 2: Store user record in Firebase
        break;
      }

      case 'miniapp_removed': {
        console.log('[Farcaster Webhook] Mini-app removed by FID:', data?.fid);
        // TODO Phase 2: Clean up notification tokens
        break;
      }

      case 'notifications_enabled': {
        console.log('[Farcaster Webhook] Notifications enabled by FID:', data?.fid);
        // TODO Phase 2: Store notification token in Firebase `farcasterNotifications` collection
        // data.notificationDetails contains { url, token }
        break;
      }

      case 'notifications_disabled': {
        console.log('[Farcaster Webhook] Notifications disabled by FID:', data?.fid);
        // TODO Phase 2: Remove notification token from Firebase
        break;
      }

      default: {
        console.log('[Farcaster Webhook] Unknown event:', event);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Farcaster Webhook] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
