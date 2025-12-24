import { NextResponse } from 'next/server'

export async function GET() {
  console.log('Checking Twitter API status and rate limits')
  
  try {
    // Check if bearer token exists
    if (!process.env.TWITTER_BEARER_TOKEN) {
      return NextResponse.json({ 
        error: 'Twitter Bearer Token not configured'
      }, { status: 500 })
    }
    
    // First, try a simple rate limit status check
    const rateLimitResponse = await fetch(
      'https://api.twitter.com/2/tweets/by/username/twitter',
      {
        method: 'HEAD', // HEAD request to check rate limits without using quota
        headers: {
          'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
        }
      }
    )
    
    const rateLimitHeaders = {
      limit: rateLimitResponse.headers.get('x-rate-limit-limit'),
      remaining: rateLimitResponse.headers.get('x-rate-limit-remaining'),
      reset: rateLimitResponse.headers.get('x-rate-limit-reset'),
      resetDate: rateLimitResponse.headers.get('x-rate-limit-reset') 
        ? new Date(parseInt(rateLimitResponse.headers.get('x-rate-limit-reset')) * 1000).toISOString()
        : 'Unknown'
    }
    
    // Test user lookup (this has different rate limits)
    const userTestResponse = await fetch(
      'https://api.twitter.com/2/users/by/username/twitter',
      {
        headers: {
          'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
        }
      }
    )
    
    const userTestData = await userTestResponse.json()
    
    // Check rate limits for user lookup
    const userRateLimitHeaders = {
      limit: userTestResponse.headers.get('x-rate-limit-limit'),
      remaining: userTestResponse.headers.get('x-rate-limit-remaining'),
      reset: userTestResponse.headers.get('x-rate-limit-reset'),
      resetDate: userTestResponse.headers.get('x-rate-limit-reset') 
        ? new Date(parseInt(userTestResponse.headers.get('x-rate-limit-reset')) * 1000).toISOString()
        : 'Unknown'
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      apiStatus: {
        tokenExists: true,
        tokenPrefix: process.env.TWITTER_BEARER_TOKEN.substring(0, 10) + '...'
      },
      rateLimitTest: {
        status: rateLimitResponse.status,
        statusText: rateLimitResponse.statusText,
        headers: rateLimitHeaders
      },
      userLookupTest: {
        status: userTestResponse.status,
        statusText: userTestResponse.statusText,
        headers: userRateLimitHeaders,
        success: userTestResponse.ok,
        hasData: !!userTestData.data
      },
      recommendations: [
        userTestResponse.status === 429 ? 'User lookup is rate limited' : 'User lookup working',
        rateLimitResponse.status === 429 ? 'Tweet lookup is rate limited' : 'Tweet lookup available',
        userRateLimitHeaders.remaining ? `${userRateLimitHeaders.remaining} user lookups remaining` : 'Unknown remaining requests',
        userRateLimitHeaders.resetDate !== 'Unknown' ? `Rate limits reset at ${userRateLimitHeaders.resetDate}` : 'Reset time unknown'
      ]
    })
    
  } catch (error) {
    console.error('Twitter status check error:', error)
    return NextResponse.json({ 
      error: 'Failed to check Twitter API status',
      message: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}