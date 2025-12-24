import { NextResponse } from 'next/server'
import { db } from '@/lib/firebaseServer'
import { doc, getDoc } from 'firebase/firestore'

export async function GET() {
  console.log('API route called - fetching from Firestore')
  
  try {
    // Get tweet data from Firestore
    const docRef = doc(db, 'tweets', 'latest')
    const docSnap = await getDoc(docRef)
    
    if (!docSnap.exists()) {
      console.log('No tweet data found in Firestore')
      return NextResponse.json({ 
        error: 'No tweet data available'
      }, { status: 404 })
    }
    
    const data = docSnap.data()
    console.log('Tweet data retrieved from Firestore:', data)
    
    // Check if the data indicates an error
    if (data.success === false) {
      console.log('Last update failed:', data.error)
      return NextResponse.json({ 
        error: 'Tweet data temporarily unavailable',
        lastError: data.error,
        lastUpdate: data.updatedAt
      }, { status: 503 })
    }
    
    // Return the tweet data
    return NextResponse.json({
      username: data.username,
      name: data.name,
      latestTweet: data.latestTweet,
      embedHtml: data.embedHtml, // Include the embed HTML
      createdAt: data.createdAt,
      lastUpdate: data.updatedAt
    })
    
  } catch (error) {
    console.error('Error fetching tweet from Firestore:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch tweet data',
      message: error.message
    }, { status: 500 })
  }
}