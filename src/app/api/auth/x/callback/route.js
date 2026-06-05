import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'

export const runtime = 'nodejs'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.json({ error: `X OAuth error: ${error}` }, { status: 400 })
    }

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing code or state' }, { status: 400 })
    }

    // Verify state matches
    const storedState = request.cookies.get('x_oauth_state')?.value
    if (state !== storedState) {
      return NextResponse.json({ error: 'State mismatch' }, { status: 400 })
    }

    // Get code verifier from cookie
    const codeVerifier = request.cookies.get('x_code_verifier')?.value
    if (!codeVerifier) {
      return NextResponse.json({ error: 'Missing code verifier' }, { status: 400 })
    }

    const isLocal = process.env.NODE_ENV === 'development'
    const baseUrl = isLocal ? 'http://127.0.0.1:3000' : 'https://rl80.com'
    const redirectUri = `${baseUrl}/api/auth/x/callback`

    // Exchange code for tokens
    const tokenResponse = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }).toString(),
    })

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text()
      console.error('Token exchange failed:', errorBody)
      return NextResponse.json({ error: 'Token exchange failed', details: errorBody }, { status: 500 })
    }

    const tokens = await tokenResponse.json()
    console.log('OAuth tokens received successfully')

    // Store tokens in Firestore via Admin SDK (config is private + write-locked).
    await getAdminDb().collection('config').doc('x_oauth').set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      scope: tokens.scope,
      updatedAt: new Date().toISOString(),
    })

    console.log('X OAuth tokens saved to Firestore')

    // Clear cookies
    const response = NextResponse.json({
      success: true,
      message: 'X OAuth connected! The cron job will now use these tokens to fetch followers.',
      scope: tokens.scope,
    })
    response.cookies.delete('x_code_verifier')
    response.cookies.delete('x_oauth_state')

    return response

  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
