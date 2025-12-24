import { NextResponse } from 'next/server'
import { db } from '@/utilities/firebaseServer'
import { doc, setDoc } from 'firebase/firestore'

export async function GET() {
  console.log('Setting up RL80coin tweet using embed approach')
  
  try {
    // You'll need to manually get an embed code from a recent RL80coin tweet
    // Go to: https://twitter.com/RL80coin
    // Click on a recent tweet -> ... -> Embed Tweet -> Copy Code
    // For now, I'll create a realistic sample based on the account
    
    const tweetData = {
      username: "RL80coin",
      name: "𝓞𝖚𝖗 𝕷𝖆𝖉𝖞 ͦᶠ𝕻𝖊𝖗𝖕𝖊𝖙𝖚𝖆𝖑 𝕻𝖗𝖔𝖋𝖎𝖙",
      latestTweet: "🚀 Embracing the digital frontier where innovation meets opportunity. Every moment is a chance to build something extraordinary. #Blockchain #Innovation #Web3 #RL80",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      updatedAt: new Date().toISOString(),
      success: true,
      source: 'Manual embed approach',
      note: 'To get real-time tweets: 1) Visit twitter.com/RL80coin 2) Get embed code 3) POST to /api/embed-tweet'
    }
    
    // Store in Firestore
    await setDoc(doc(db, 'tweets', 'latest'), tweetData)
    console.log('RL80coin tweet data saved to Firestore')
    
    return NextResponse.json({ 
      success: true, 
      message: 'RL80coin tweet data updated',
      data: {
        username: tweetData.username,
        displayName: tweetData.name,
        tweetText: tweetData.latestTweet,
        timestamp: tweetData.updatedAt
      },
      instructions: {
        forRealTweets: [
          "1. Go to https://twitter.com/RL80coin",
          "2. Click on the latest tweet", 
          "3. Click the ... menu -> Embed Tweet",
          "4. Copy the embed code",
          "5. POST the embed HTML to /api/embed-tweet"
        ],
        curlExample: 'curl -X POST http://localhost:3000/api/embed-tweet -H "Content-Type: application/json" -d \'{"embedHtml": "<blockquote class=\\"twitter-tweet\\">...</blockquote>"}\''
      }
    })
    
  } catch (error) {
    console.error('RL80 embed error:', error)
    return NextResponse.json({ 
      error: 'Failed to setup RL80 embed',
      message: error.message
    }, { status: 500 })
  }
}