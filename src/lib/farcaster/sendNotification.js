/**
 * Farcaster Mini-App Push Notification Sender (Phase 2)
 *
 * Sends notifications to users who have opted in.
 * Used to notify about new weekly prize drops.
 *
 * Usage:
 *   await sendNotification({
 *     token: 'user_notification_token',
 *     url: 'https://api.warpcast.com/v1/miniapp-notifications',
 *     title: 'New Drop!',
 *     body: 'A new collectible is available in the RL80 Gachapon!',
 *     targetUrl: 'https://yourdomain.com/miniapp/gachapon',
 *   });
 */

export async function sendNotification({ token, url, title, body, targetUrl }) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notificationId: crypto.randomUUID(),
        title,
        body,
        targetUrl,
        tokens: [token],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Notification failed (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[sendNotification] Error:', error);
    throw error;
  }
}

/**
 * Send "New Drop!" notification to all opted-in users.
 * TODO Phase 2: Fetch all tokens from Firebase `farcasterNotifications` collection
 * and send notifications in batches.
 */
export async function notifyNewDrop({ prizeName }) {
  // TODO: Implement when Firebase notification storage is set up
  console.log(`[notifyNewDrop] Would notify about: ${prizeName}`);
}
