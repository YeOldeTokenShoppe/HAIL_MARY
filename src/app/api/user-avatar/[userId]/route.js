import { NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'

export async function GET(request, { params }) {
  try {
    const { userId } = await params

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const client = await clerkClient()
    const user = await client.users.getUser(userId)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      imageUrl: user.imageUrl,
      username: user.username || user.firstName || 'Anonymous'
    })
  } catch (error) {
    console.error('Error fetching user avatar:', error)

    // Return a fallback instead of error so the UI doesn't break
    return NextResponse.json({
      imageUrl: null,
      username: 'Anonymous'
    })
  }
}
