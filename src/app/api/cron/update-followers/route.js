import { NextResponse } from 'next/server'
import { db } from '@/lib/firebaseServer'
import { doc, setDoc, getDoc } from 'firebase/firestore'

// Refresh the OAuth access token using stored refresh token
async function getAccessToken() {
  const oauthDoc = await getDoc(doc(db, 'config', 'x_oauth'))
  if (!oauthDoc.exists()) {
    throw new Error('No X OAuth tokens found. Visit /api/auth/x to authorize first.')
  }

  const { refreshToken, accessToken, updatedAt } = oauthDoc.data()

  // Check if token was updated less than 90 minutes ago (tokens last 2 hours)
  const tokenAge = Date.now() - new Date(updatedAt).getTime()
  if (tokenAge < 90 * 60 * 1000) {
    return accessToken
  }

  // Refresh the token
  console.log('Refreshing X OAuth access token...')
  const response = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('Token refresh failed:', errorBody)
    throw new Error(`Token refresh failed: ${response.status} - ${errorBody}`)
  }

  const tokens = await response.json()

  // Store updated tokens
  await setDoc(doc(db, 'config', 'x_oauth'), {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
    scope: tokens.scope,
    updatedAt: new Date().toISOString(),
  })

  console.log('X OAuth tokens refreshed successfully')
  return tokens.access_token
}

export async function GET(request) {
  try {
    // Verify this is coming from Vercel Cron
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('Unauthorized cron request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Cron job: Starting followers update process...')

    // Get OAuth access token from Firestore
    const accessToken = await getAccessToken()

    // Fetch user ID for rl80token
    const userResponse = await fetch(
      'https://api.x.com/2/users/by/username/rl80token?user.fields=id',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )

    if (!userResponse.ok) {
      if (userResponse.status === 429) {
        console.log('Rate limited on user lookup, will try again next cron run')
        return NextResponse.json({
          error: 'Rate limited',
          message: 'Will retry on next cron run'
        }, { status: 429 })
      }
      const errorBody = await userResponse.text()
      throw new Error(`X API error on user lookup: ${userResponse.status} - ${errorBody}`)
    }

    const userData = await userResponse.json()
    if (!userData.data) {
      throw new Error('User not found')
    }

    const userId = userData.data.id
    console.log('Fetching followers for user:', userId)

    // Paginate through all followers
    const allDisplayNames = []
    const allUsernames = []
    let paginationToken = null

    do {
      const url = new URL(`https://api.x.com/2/users/${userId}/followers`)
      url.searchParams.set('user.fields', 'name,username')
      url.searchParams.set('max_results', '1000')
      if (paginationToken) {
        url.searchParams.set('pagination_token', paginationToken)
      }

      const followersResponse = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!followersResponse.ok) {
        const errorBody = await followersResponse.text()
        console.error('Followers API error body:', errorBody)
        if (followersResponse.status === 429) {
          console.log(`Rate limited after collecting ${allDisplayNames.length} followers, saving partial results`)
          break // Save what we have so far
        }
        throw new Error(`X API error on followers: ${followersResponse.status} - ${errorBody}`)
      }

      const followersData = await followersResponse.json()

      if (followersData.data) {
        for (const user of followersData.data) {
          if (user.name) {
            allDisplayNames.push(user.name)
          }
          if (user.username) {
            allUsernames.push(user.username.toLowerCase())
          }
        }
      }

      paginationToken = followersData.meta?.next_token || null
      console.log(`Collected ${allDisplayNames.length} followers so far...`)
    } while (paginationToken)

    console.log(`Total followers collected: ${allDisplayNames.length}`)

    // Store in Firestore
    await setDoc(doc(db, 'followers', 'latest'), {
      displayNames: allDisplayNames,
      usernames: allUsernames,
      totalCount: allDisplayNames.length,
      updatedAt: new Date().toISOString(),
      success: true
    })

    console.log('Follower data saved to Firestore successfully')

    return NextResponse.json({
      success: true,
      message: 'Followers updated successfully via cron',
      totalCount: allDisplayNames.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Cron job error:', error)

    // Store error info in Firestore for debugging
    try {
      await setDoc(doc(db, 'followers', 'latest'), {
        error: error.message,
        updatedAt: new Date().toISOString(),
        success: false
      }, { merge: true })
    } catch (firestoreError) {
      console.error('Failed to save error to Firestore:', firestoreError)
    }

    return NextResponse.json({
      error: 'Cron job failed',
      message: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
