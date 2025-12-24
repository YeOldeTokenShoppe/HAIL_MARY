import { NextResponse } from 'next/server'
import { db } from '@/lib/firebaseServer'
import { doc, setDoc } from 'firebase/firestore'

export async function GET() {
  console.log('Fetching tweets from Twitter RSS feed (no rate limits)')
  
  try {
    // Twitter accounts have RSS feeds at: https://nitter.net/username/rss
    // Alternative services: https://nitter.poast.org/RL80coin/rss
    const rssUrl = 'https://nitter.poast.org/RL80coin/rss'
    
    console.log('Fetching RSS from:', rssUrl)
    
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSS Reader)'
      }
    })
    
    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status} ${response.statusText}`)
    }
    
    const rssText = await response.text()
    console.log('RSS response length:', rssText.length)
    
    // Simple RSS parsing - look for the first <item>
    const itemMatch = rssText.match(/<item>(.*?)<\/item>/s)
    if (!itemMatch) {
      throw new Error('No items found in RSS feed')
    }
    
    const item = itemMatch[1]
    
    // Extract title (tweet content)
    const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/s)
    const title = titleMatch ? titleMatch[1] : 'Tweet content not found'
    
    // Extract date
    const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/)
    const pubDate = dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString()
    
    // Clean up the title to get just the tweet content
    const tweetText = title.replace(/^RT @\w+:\s*/, '').replace(/^@\w+\s*/, '').trim()
    
    const tweetData = {
      username: "RL80coin",
      name: "𝓞𝖚𝖗 𝕷𝖆𝖉𝖞 ͦᶠ𝕻𝖊𝖗𝖕𝖊𝖙𝖚𝖆𝖑 𝕻𝖗𝖔𝖋𝖎𝖙",
      latestTweet: tweetText,
      createdAt: pubDate,
      updatedAt: new Date().toISOString(),
      success: true,
      source: 'RSS feed'
    }
    
    // Store in Firestore
    await setDoc(doc(db, 'tweets', 'latest'), tweetData)
    console.log('Tweet data from RSS saved to Firestore')
    
    return NextResponse.json({ 
      success: true, 
      message: 'Tweet updated from RSS feed',
      data: {
        username: tweetData.username,
        tweetPreview: tweetData.latestTweet.substring(0, 50) + '...',
        timestamp: tweetData.updatedAt,
        source: 'RSS feed (no rate limits)'
      }
    })
    
  } catch (error) {
    console.error('RSS fetch error:', error)
    
    // Fallback to current sample data
    return NextResponse.json({ 
      error: 'RSS fetch failed, keeping existing data',
      message: error.message,
      fallback: 'Using existing tweet data'
    }, { status: 207 }) // 207 = partial success
  }
}