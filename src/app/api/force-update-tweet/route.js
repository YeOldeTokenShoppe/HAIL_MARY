import { NextResponse } from 'next/server'
import { db } from '@/lib/firebaseServer'
import { doc, setDoc } from 'firebase/firestore'

export async function GET() {
  console.log('Force update triggered - no auth required for testing')
  
  try {
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
      if (response.status === 429) {
        console.log('Rate limited, will try again later')
        return NextResponse.json({ 
          error: 'Rate limited', 
          message: 'Twitter API rate limit exceeded' 
        }, { status: 429 })
      }
      throw new Error(`Twitter API error: ${response.status}`)
    }
    
    const userData = await response.json()
    console.log('User data retrieved successfully')
    
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
      if (tweetsResponse.status === 429) {
        console.log('Rate limited on tweets, will try again later')
        return NextResponse.json({ 
          error: 'Rate limited on tweets', 
          message: 'Twitter API rate limit exceeded' 
        }, { status: 429 })
      }
      throw new Error(`Twitter API error: ${tweetsResponse.status}`)
    }
    
    const tweets = await tweetsResponse.json()
    console.log('Tweets data retrieved successfully')
    
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
    console.log('Tweet data saved to Firestore successfully')
    
    return NextResponse.json({ 
      success: true, 
      message: 'Tweet updated successfully',
      data: {
        username: tweetData.username,
        tweetPreview: tweetData.latestTweet.substring(0, 50) + '...',
        timestamp: tweetData.updatedAt
      }
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
      message: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}