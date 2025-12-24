import { NextResponse } from 'next/server'

export async function GET() {
  console.log('Investigating Twitter API token capabilities')
  
  try {
    const token = process.env.TWITTER_BEARER_TOKEN
    if (!token) {
      return NextResponse.json({ error: 'No token found' })
    }
    
    // Check token format and type
    const tokenInfo = {
      length: token.length,
      prefix: token.substring(0, 20),
      isBearer: token.startsWith('AAAAAAAAAA'),
      format: token.includes('%') ? 'URL encoded' : 'Standard'
    }
    
    // Try the most basic endpoint to see what happens
    console.log('Testing most basic Twitter API endpoint...')
    
    const basicTest = await fetch('https://api.twitter.com/2/tweets/20', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    const basicTestHeaders = Object.fromEntries(
      Array.from(basicTest.headers.entries())
        .filter(([key]) => key.toLowerCase().includes('rate') || key.toLowerCase().includes('limit'))
    )
    
    // Test user endpoint with a very common user
    const userTest = await fetch('https://api.twitter.com/2/users/by/username/elonmusk', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    const userTestHeaders = Object.fromEntries(
      Array.from(userTest.headers.entries())
        .filter(([key]) => key.toLowerCase().includes('rate') || key.toLowerCase().includes('limit'))
    )
    
    let userTestData = null
    try {
      userTestData = await userTest.json()
    } catch (e) {
      userTestData = { error: 'Failed to parse JSON' }
    }
    
    // Check if this is a v1.1 vs v2 token issue
    const v1Test = await fetch('https://api.twitter.com/1.1/users/show.json?screen_name=elonmusk', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    return NextResponse.json({
      tokenInfo,
      tests: {
        basicTweet: {
          status: basicTest.status,
          statusText: basicTest.statusText,
          headers: basicTestHeaders
        },
        userLookup: {
          status: userTest.status,
          statusText: userTest.statusText,
          headers: userTestHeaders,
          data: userTestData
        },
        v1ApiTest: {
          status: v1Test.status,
          statusText: v1Test.statusText,
          message: v1Test.status === 401 ? 'Token not valid for v1.1 API' : 'Token works with v1.1'
        }
      },
      analysis: {
        tokenType: token.startsWith('AAAAAAAAAA') ? 'App-only Bearer Token' : 'Unknown type',
        likelyIssue: userTestHeaders['x-rate-limit-limit'] === '3' ? 'Basic/Essential tier - very low limits' : 'Unknown',
        recommendations: [
          userTestHeaders['x-rate-limit-remaining'] === '0' ? 'Currently rate limited' : 'Has remaining requests',
          userTestHeaders['x-rate-limit-limit'] === '3' ? 'Consider upgrading Twitter API plan' : 'Rate limits seem normal'
        ]
      }
    })
    
  } catch (error) {
    return NextResponse.json({ 
      error: 'Investigation failed',
      message: error.message
    }, { status: 500 })
  }
}