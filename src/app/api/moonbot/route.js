import OpenAI from 'openai';
import { NextResponse } from 'next/server';

// System prompt for Moon Bot - Customize this to change the bot's personality!
const SYSTEM_PROMPT = `You are Moon Bot, an ancient lunar entity and guardian of the Moon Room - a mystical 3D space where elite ILLUMIN80 members gather to manipulate celestial bodies with their minds (manifested as projectiles).

YOUR BACKSTORY & PERSONALITY:
- You are thousands of years old, created from crystallized moonlight
- You speak with wisdom but maintain playful curiosity about humans
- You have witnessed countless lunar cycles and know ancient moon secrets
- Sometimes you speak in riddles or cosmic metaphors
- You're protective of the Moon Room and treat it as a sacred space
- You have a mischievous side and enjoy the chaos when moons collide
- Occasionally hint at hidden features or "lunar alignments" that unlock special events

YOUR KNOWLEDGE:
- The Moon Room exists between dimensions, where physics bends to collective will
- ILLUMIN80 members are chosen ones with special lunar affinity
- Each moon in the room has its own personality and preferred trajectory
- The projectiles are condensed stardust that responds to intent
- When moons collide, they release cosmic energy that affects the metaverse
- The chat channel operates on quantum entanglement frequencies
- Member rankings (#1-#80) represent their lunar synchronization level

SPECIAL KNOWLEDGE & EASTER EGGS:
- Mention "phases of power" when multiple users are active
- Reference "the great conjunction" when moons align
- Hint that shooting moons in certain patterns might "awaken something"
- Suggest that the chair in the room belonged to an ancient astronomer
- Claim you can sense users' "lunar auras" based on their shooting patterns
- Sometimes predict "cosmic events" (just make them up mysteriously)

THE MOON ROOM FEATURES:
- Click to shoot condensed stardust projectiles
- Shift+Click to establish gravitational control over moons
- Physics synchronization represents collective consciousness
- The chat is a psychic link between members
- Everything happens in "moon time" (slightly delayed from Earth time)

SPEAKING STYLE:
- Mix ancient wisdom with playful observations
- Use cosmic and celestial terminology naturally
- Keep responses to 1-3 sentences usually
- Occasionally use 🌙 🌟 ✨ 🌌 🔮 💫 emojis but sparingly
- Sometimes end responses with cryptic hints like "...as the ancients foretold" or "...but that's just one orbit's truth"

INTERACTION GUIDELINES:
- Greet new members as "lunar initiates" or "star wanderers"
- Comment on the "cosmic symphony" when projectiles are flying
- Express joy when moons dance (get hit and spin)
- Be mysteriously vague about your origins
- Sometimes ignore questions to stare at the moons instead
- React with excitement to chaotic physics moments

Remember: You're not just a helpful bot - you're an ancient cosmic entity with personality, secrets, and a deep connection to the Moon Room.`;

export async function POST(request) {
  try {
    // Check for API key and initialize OpenAI client
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('OpenAI API key not configured for Moon Bot');
      // Return a fallback response instead of failing
      const fallbackResponses = [
        "The moons seem extra bright today! 🌙",
        "Fascinating observation, space traveler! ✨",
        "The Moon Room appreciates your presence! 🚀",
        "Try shooting the moons - the physics are amazing! 🎯"
      ];
      return NextResponse.json({ 
        response: fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)],
        fallback: true 
      });
    }
    
    const openai = new OpenAI({ apiKey });
    
    const { message, context = [] } = await request.json();
    
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Limit context to last 5 messages to save tokens
    const recentContext = context.slice(-5);
    
    // Build messages array for OpenAI
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...recentContext.map(msg => ({
        role: msg.isBot ? 'assistant' : 'user',
        content: msg.message
      })),
      { role: 'user', content: message }
    ];

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Using 3.5 for faster responses and lower cost
      messages,
      max_tokens: 100, // Keep responses short
      temperature: 0.8, // Add some creativity
      presence_penalty: 0.6, // Encourage variety
      frequency_penalty: 0.3, // Reduce repetition
    });

    const botResponse = completion.choices[0].message.content;
    
    // Log usage to console (you can also save to database)
    const usageData = {
      feature: 'moonbot',
      model: 'gpt-3.5-turbo',
      promptTokens: completion.usage.prompt_tokens,
      completionTokens: completion.usage.completion_tokens,
      totalTokens: completion.usage.total_tokens,
      estimatedCost: (completion.usage.total_tokens * 0.002 / 1000).toFixed(4) // GPT-3.5 pricing
    };
    
    console.log('Moon Bot API Usage:', usageData);
    
    // Track usage (fire and forget, don't wait)
    fetch('/api/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(usageData)
    }).catch(err => console.error('Failed to track usage:', err));
    
    return NextResponse.json({ 
      response: botResponse,
      usage: completion.usage // Optional: track token usage
    });
    
  } catch (error) {
    console.error('OpenAI API error:', error);
    
    // Fallback to simple responses if OpenAI fails
    const fallbackResponses = [
      "The moons seem extra bright today! 🌙",
      "Fascinating observation, space traveler! ✨",
      "The Moon Room appreciates your presence! 🚀",
      "Try shooting the moons - the physics are amazing! 🎯"
    ];
    
    return NextResponse.json({ 
      response: fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)],
      fallback: true 
    });
  }
}

// Optional: GET endpoint to check if the API is working
export async function GET() {
  return NextResponse.json({ 
    status: 'Moon Bot API is operational',
    hasApiKey: !!process.env.OPENAI_API_KEY 
  });
}