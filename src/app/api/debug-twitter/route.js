import { NextResponse } from 'next/server'

export async function GET() {
  console.log('Debug Twitter API call')
  
  try {
    // Check if bearer token exists
    if (!process.env.TWITTER_BEARER_TOKEN) {
      return NextResponse.json({ 
        error: 'Twitter Bearer Token not configured'
      }, { status: 500 })
    }
    
    console.log('Fetching user data for RL80coin...')
    
    // Using Twitter API v2
    const response = await fetch(
      `https://api.twitter.com/2/users/by/username/RL80coin?user.fields=id,name,username,public_metrics`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
        }
      }
    )
    
    const userData = await response.json()
    console.log('Raw user response:', JSON.stringify(userData, null, 2))
    
    if (!response.ok) {
      return NextResponse.json({
        error: 'User fetch failed',
        status: response.status,
        statusText: response.statusText,
        response: userData
      }, { status: response.status })
    }
    
    if (!userData.data) {
      return NextResponse.json({
        error: 'User not found in response',
        response: userData
      })
    }
    
    const userId = userData.data.id
    console.log(`Fetching tweets for user: ${userId}`)
    
    // Get latest tweets
    const tweetsResponse = await fetch(
      `https://api.twitter.com/2/users/${userId}/tweets?max_results=10&tweet.fields=created_at,text,public_metrics`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
        }
      }
    )
    
    const tweets = await tweetsResponse.json()
    console.log('Raw tweets response:', JSON.stringify(tweets, null, 2))
    
    return NextResponse.json({
      success: true,
      userLookup: {
        status: response.status,
        userData: userData
      },
      tweetsLookup: {
        status: tweetsResponse.status,
        statusText: tweetsResponse.statusText,
        tweetsData: tweets
      }
    })
    
  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json({ 
      error: 'Debug failed',
      message: error.message
    }, { status: 500 })
  }
}