import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { userId, isIllumin80 } = await request.json();
    
    // Update user's public metadata with Illumin80 status
    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: {
        isIllumin80: isIllumin80,
        badge: isIllumin80 ? "Illumin80" : null,
        badgeIcon: isIllumin80 ? "🔥" : null,
        society: isIllumin80 ? "Secret Order of the Illumin80" : null
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating user badge:', error);
    return NextResponse.json({ error: 'Failed to update badge' }, { status: 500 });
  }
}