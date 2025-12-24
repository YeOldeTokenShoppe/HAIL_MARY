import { NextResponse } from 'next/server'
import { db } from '@/lib/firebaseServer'
import { doc, setDoc, getDoc } from 'firebase/firestore'

export async function POST(request) {
  try {
    // Check for authorization (optional: add API key check)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_API_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Starting tweet update process...')
    
    // Check if bearer token exists
    if (!process.env.TWITTER_BEARER_TOKEN) {
      console.error('No Twitter Bearer Token found')
      return NextResponse.json({ 
        error: 'Twitter Bearer Token not configured'
      }, { status: 500 })
    }
    
    console.log('Fetching user data for RL80coin...')
    
    // Using Twitter API v2
    const response = await fetch(
      `https://api.twitter.com/2/users/by/username/RL80coin?user.fields=id,name`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
        }
      }
    )
    
    if (!response.ok) {
      console.error('User fetch failed:', response.status, response.statusText)
      throw new Error(`Twitter API error: ${response.status}`)
    }
    
    const userData = await response.json()
    console.log('User data:', userData)
    
    if (!userData.data) {
      throw new Error('User not found')
    }
    
    const userId = userData.data.id
    
    console.log('Fetching tweets for user:', userId)
    
    // Get latest tweets
    const tweetsResponse = await fetch(
      `https://api.twitter.com/2/users/${userId}/tweets?max_results=5&tweet.fields=created_at,text`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
        }
      }
    )
    
    if (!tweetsResponse.ok) {
      console.error('Tweets fetch failed:', tweetsResponse.status, tweetsResponse.statusText)
      throw new Error(`Twitter API error: ${tweetsResponse.status}`)
    }
    
    const tweets = await tweetsResponse.json()
    console.log('Tweets data:', tweets)
    
    if (!tweets.data || tweets.data.length === 0) {
      throw new Error('No tweets found')
    }
    
    const tweetData = {
      username: userData.data.username,
      name: userData.data.name,
      latestTweet: tweets.data[0].text,
      createdAt: tweets.data[0].created_at,
      updatedAt: new Date().toISOString(),
      success: true
    }
    
    // Store in Firestore
    await setDoc(doc(db, 'tweets', 'latest'), tweetData)
    console.log('Tweet data saved to Firestore')
    
    return NextResponse.json({ 
      success: true, 
      message: 'Tweet updated successfully',
      data: tweetData
    })
    
  } catch (error) {
    console.error('Error updating tweet:', error)
    
    // Store error info in Firestore for debugging
    try {
      await setDoc(doc(db, 'tweets', 'latest'), {
        error: error.message,
        updatedAt: new Date().toISOString(),
        success: false
      }, { merge: true })
    } catch (firestoreError) {
      console.error('Failed to save error to Firestore:', firestoreError)
    }
    
    return NextResponse.json({ 
      error: 'Failed to update tweet',
      message: error.message
    }, { status: 500 })
  }
}