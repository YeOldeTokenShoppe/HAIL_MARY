import { NextResponse } from 'next/server'
import { db } from '@/lib/firebaseServer'
import { doc, setDoc } from 'firebase/firestore'

export async function POST(request) {
  console.log('Processing Twitter embed to extract tweet data')
  
  try {
    const { embedHtml } = await request.json()
    
    if (!embedHtml) {
      return NextResponse.json({ 
        error: 'No embed HTML provided' 
      }, { status: 400 })
    }
    
    // Extract tweet text from the embed HTML
    const textMatch = embedHtml.match(/<p[^>]*>(.*?)<\/p>/s)
    let tweetText = 'Tweet content not found'
    
    if (textMatch) {
      // Clean up the HTML content
      tweetText = textMatch[1]
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&mdash;/g, '—')
        .replace(/&ldquo;/g, '"')
        .replace(/&rdquo;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim()
    }
    
    // Extract username from the embed - updated pattern
    const usernameMatch = embedHtml.match(/&mdash;\s*([^(]+)\s*\(@([^)]+)\)/)
    const displayName = usernameMatch ? usernameMatch[1].trim() : 'Twitter User'
    const username = usernameMatch ? usernameMatch[2].trim() : 'twitteruser'
    
    console.log('Username extraction:', { embedHtml: embedHtml.substring(0, 200), usernameMatch, displayName, username })
    
    // Extract date
    const dateMatch = embedHtml.match(/href="[^"]*">([^<]+)<\/a>/)
    const tweetDate = dateMatch ? dateMatch[1].trim() : new Date().toLocaleDateString()
    
    const tweetData = {
      username: username,
      name: displayName,
      latestTweet: tweetText,
      embedHtml: embedHtml, // Store the original embed HTML
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      success: true,
      source: 'Twitter embed',
      originalDate: tweetDate
    }
    
    // Store in Firestore
    await setDoc(doc(db, 'tweets', 'latest'), tweetData)
    console.log('Tweet data from embed saved to Firestore')
    
    return NextResponse.json({ 
      success: true, 
      message: 'Tweet data extracted from embed',
      data: {
        username: tweetData.username,
        displayName: tweetData.name,
        tweetText: tweetData.latestTweet,
        originalDate: tweetData.originalDate,
        timestamp: tweetData.updatedAt
      }
    })
    
  } catch (error) {
    console.error('Embed processing error:', error)
    return NextResponse.json({ 
      error: 'Failed to process embed',
      message: error.message
    }, { status: 500 })
  }
}

// Also support GET with hardcoded example
export async function GET() {
  console.log('Using hardcoded embed example')
  
  try {
    const tweetData = {
      username: "W3ndiWagmi",
      name: "W3NDI",
      latestTweet: "HOW DO YOU DO, FELLOW HUMANS?",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      success: true,
      source: 'Twitter embed example',
      originalDate: 'July 14, 2023'
    }
    
    // Store in Firestore
    await setDoc(doc(db, 'tweets', 'latest'), tweetData)
    console.log('Example tweet data saved to Firestore')
    
    return NextResponse.json({ 
      success: true, 
      message: 'Example tweet data from embed',
      data: {
        username: tweetData.username,
        displayName: tweetData.name,
        tweetText: tweetData.latestTweet,
        originalDate: tweetData.originalDate,
        timestamp: tweetData.updatedAt
      }
    })
    
  } catch (error) {
    console.error('Example embed error:', error)
    return NextResponse.json({ 
      error: 'Failed to process example',
      message: error.message
    }, { status: 500 })
  }
}