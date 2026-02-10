import { NextResponse } from 'next/server';
import { sendNotification } from '@/lib/farcaster/sendNotification';

/**
 * POST /api/farcaster/notify
 *
 * Trigger a push notification to all opted-in mini-app users.
 * Protected by CRON_SECRET via Bearer token.
 *
 * curl -X POST https://rl80.com/api/farcaster/notify \
 *   -H "Authorization: Bearer <CRON_SECRET>" \
 *   -H "Content-Type: application/json" \
 *   -d '{"body": "A new collectible just dropped in the Gachapon!"}'
 */
export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, body, targetUrl } = await request.json().catch(() => ({}));

    const result = await sendNotification({ title, body, targetUrl });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[notify] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send notification' },
      { status: 500 }
    );
  }
}
