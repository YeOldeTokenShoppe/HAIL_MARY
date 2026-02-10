/**
 * Farcaster Mini-App Push Notification Sender via Neynar
 *
 * Broadcasts notifications to all users who have opted in.
 * Neynar manages notification token storage — we just call their API.
 *
 * Usage:
 *   await sendNotification({
 *     title: 'New Drop!',
 *     body: 'A new collectible is available in the RL80 Gachapon!',
 *     targetUrl: 'https://rl80.com/miniapp/gachapon',
 *   });
 */

const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster/frame/notifications';

export async function sendNotification({
  title = 'New Drop!',
  body = 'A new collectible is available in the RL80 Gachapon!',
  targetUrl = 'https://rl80.com/miniapp/gachapon',
} = {}) {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    throw new Error('NEYNAR_API_KEY is not set');
  }

  const response = await fetch(NEYNAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      target_fids: [],
      notification: { title, body, target_url: targetUrl },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Neynar notification failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  console.log('[sendNotification] Success:', JSON.stringify(result));
  return result;
}
