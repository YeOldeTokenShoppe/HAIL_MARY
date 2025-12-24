import { NextResponse } from 'next/server'
import { db } from '@/utilities/firebaseServer'
import { doc, setDoc } from 'firebase/firestore'

export async function GET() {
  console.log('Seeding tweet data with sample content')
  
  try {
    // Create sample tweet data based on the actual account
    const tweetData = {
      username: "RL80coin",
      name: "𝓞𝖚𝖗 𝕷𝖆𝖉𝖞 ͦᶠ𝕻𝖊𝖗𝖕𝖊𝖙𝖚𝖆𝖑 𝕻𝖗𝖔𝖋𝖎𝖙",
      latestTweet: "🚀 Building the future of decentralized experiences. Our Lady of Perpetual Profit is more than just a name - it's a mission. #Web3 #Innovation #RL80",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      success: true,
      note: "Sample data - will be replaced when Twitter API rate limits reset"
    }
    
    // Store in Firestore
    await setDoc(doc(db, 'tweets', 'latest'), tweetData)
    console.log('Sample tweet data saved to Firestore')
    
    return NextResponse.json({ 
      success: true, 
      message: 'Sample tweet data seeded successfully',
      data: {
        username: tweetData.username,
        tweetPreview: tweetData.latestTweet.substring(0, 50) + '...',
        timestamp: tweetData.updatedAt,
        note: tweetData.note
      }
    })
    
  } catch (error) {
    console.error('Error seeding tweet data:', error)
    return NextResponse.json({ 
      error: 'Failed to seed tweet data',
      message: error.message
    }, { status: 500 })
  }
}