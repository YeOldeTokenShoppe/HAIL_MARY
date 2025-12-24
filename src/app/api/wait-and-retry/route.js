import { NextResponse } from 'next/server'
import { db } from '@/utilities/firebaseServer'
import { doc, setDoc } from 'firebase/firestore'

export async function GET() {
  console.log('Checking if rate limits have reset and trying to fetch real tweets')
  
  try {
    // Check current rate limit status first
    const statusCheck = await fetch(
      'https://api.twitter.com/2/users/by/username/twitter',
      {
        method: 'HEAD',
        headers: {
          'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
        }
      }
    )
    
    const remaining = statusCheck.headers.get('x-rate-limit-remaining')
    const resetTime = statusCheck.headers.get('x-rate-limit-reset')
    
    if (remaining === '0') {
      const resetDate = new Date(parseInt(resetTime) * 1000)
      return NextResponse.json({
        stillRateLimited: true,
        remaining: remaining,
        resetTime: resetDate.toISOString(),
        message: `Rate limits still active. Try again after ${resetDate.toLocaleTimeString()}`
      })
    }
    
    console.log(`Rate limits reset! ${remaining} requests remaining`)
    
    // Now try to fetch real tweets
    console.log('Fetching user data for RL80coin...')
    
    const userResponse = await fetch(
      `https://api.twitter.com/2/users/by/username/RL80coin?user.fields=id,name`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
        }
      }
    )
    
    if (!userResponse.ok) {
      throw new Error(`User fetch failed: ${userResponse.status}`)
    }
    
    const userData = await userResponse.json()
    const userId = userData.data.id
    
    console.log('Fetching tweets for user:', userId)
    
    const tweetsResponse = await fetch(
      `https://api.twitter.com/2/users/${userId}/tweets?max_results=5&tweet.fields=created_at,text`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
        }
      }
    )
    
    if (!tweetsResponse.ok) {
      throw new Error(`Tweets fetch failed: ${tweetsResponse.status}`)
    }
    
    const tweets = await tweetsResponse.json()
    
    if (!tweets.data || tweets.data.length === 0) {
      throw new Error('No tweets found')
    }
    
    const tweetData = {
      username: userData.data.username,
      name: userData.data.name,
      latestTweet: tweets.data[0].text,
      createdAt: tweets.data[0].created_at,
      updatedAt: new Date().toISOString(),
      success: true,
      source: 'Twitter API v2'
    }
    
    await setDoc(doc(db, 'tweets', 'latest'), tweetData)
    console.log('Real tweet data saved to Firestore!')
    
    return NextResponse.json({ 
      success: true, 
      message: 'Real tweet fetched successfully!',
      data: {
        username: tweetData.username,
        tweetPreview: tweetData.latestTweet.substring(0, 50) + '...',
        timestamp: tweetData.updatedAt,
        source: 'Real Twitter API'
      },
      rateLimitInfo: {
        remaining: tweetsResponse.headers.get('x-rate-limit-remaining'),
        reset: new Date(parseInt(tweetsResponse.headers.get('x-rate-limit-reset')) * 1000).toISOString()
      }
    })
    
  } catch (error) {
    console.error('Wait and retry error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch real tweets',
      message: error.message,
      suggestion: 'Try again in a few minutes when rate limits reset'
    }, { status: 429 })
  }
}