import { NextResponse } from 'next/server'
import crypto from 'crypto'

// One-time OAuth 2.0 authorization flow for X API
// Visit /api/auth/x in browser to start
export async function GET() {
  const clientId = process.env.X_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'X_CLIENT_ID not configured' }, { status: 500 })
  }

  // Generate PKCE code verifier and challenge
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')

  // Generate state for CSRF protection
  const state = crypto.randomBytes(16).toString('hex')

  const isLocal = process.env.NODE_ENV === 'development'
  const baseUrl = isLocal ? 'http://127.0.0.1:3000' : 'https://rl80.com'
  const redirectUri = `${baseUrl}/api/auth/x/callback`

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'follows.read users.read tweet.read offline.access',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  const authUrl = `https://x.com/i/oauth2/authorize?${params.toString()}`

  // Store code_verifier and state in a cookie so the callback can use them
  const response = NextResponse.redirect(authUrl)
  response.cookies.set('x_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: !isLocal,
    maxAge: 600, // 10 minutes
    path: '/',
  })
  response.cookies.set('x_oauth_state', state, {
    httpOnly: true,
    secure: !isLocal,
    maxAge: 600,
    path: '/',
  })

  return response
}
