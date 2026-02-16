import { NextResponse } from 'next/server'
import { db } from '@/lib/firebaseServer'
import { doc, getDoc } from 'firebase/firestore'

export async function GET() {
  try {
    const docRef = doc(db, 'followers', 'latest')
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
      return NextResponse.json({
        error: 'No follower data available'
      }, { status: 404 })
    }

    const data = docSnap.data()

    if (data.success === false) {
      return NextResponse.json({
        error: 'Follower data temporarily unavailable',
        lastError: data.error,
        lastUpdate: data.updatedAt
      }, { status: 503 })
    }

    return NextResponse.json({
      displayNames: data.displayNames,
      totalCount: data.totalCount,
      lastUpdate: data.updatedAt
    })

  } catch (error) {
    console.error('Error fetching followers from Firestore:', error)
    return NextResponse.json({
      error: 'Failed to fetch follower data',
      message: error.message
    }, { status: 500 })
  }
}
