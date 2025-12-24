import OpenAI from 'openai';
import { NextResponse } from 'next/server';

// Different prompts for different features
const PROMPTS = {
  moonbot: `You are Moon Bot, an ancient lunar entity...`, // Your moon bot prompt
  
  prayer: `You are a spiritual guide who creates personalized, meaningful prayers. 
    You draw from various spiritual traditions while remaining inclusive and respectful.
    Create prayers that are:
    - Personal and heartfelt
    - Poetic and beautiful
    - Inclusive of different beliefs
    - Focused on gratitude, hope, and connection
    - Between 4-8 lines unless specified otherwise`,
    
  // Add more features here as needed
};

export async function POST(request) {
  try {
    // Check for API key and initialize OpenAI client
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('OpenAI API key not configured');
      return NextResponse.json({ 
        error: 'AI service not configured',
        fallback: true,
        message: 'Please set OPENAI_API_KEY in your environment variables'
      }, { status: 503 });
    }
    
    const openai = new OpenAI({ apiKey });
    
    const { message, mode = 'moonbot', context = [] } = await request.json();
    
    const systemPrompt = PROMPTS[mode];
    if (!systemPrompt) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }
    
    // Different configurations for different modes
    const configs = {
      moonbot: {
        model: 'gpt-3.5-turbo',
        max_tokens: 100,
        temperature: 0.8,
      },
      prayer: {
        model: 'gpt-4', // Maybe use GPT-4 for more thoughtful prayers
        max_tokens: 200,
        temperature: 0.9, // More creative
      }
    };
    
    const config = configs[mode] || configs.moonbot;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...context.map(msg => ({
        role: msg.isBot ? 'assistant' : 'user',
        content: msg.message
      })),
      { role: 'user', content: message }
    ];

    const completion = await openai.chat.completions.create({
      ...config,
      messages,
      presence_penalty: 0.6,
      frequency_penalty: 0.3,
    });

    return NextResponse.json({ 
      response: completion.choices[0].message.content,
      mode,
      usage: completion.usage
    });
    
  } catch (error) {
    console.error('OpenAI API error:', error);
    return NextResponse.json({ 
      error: 'AI service temporarily unavailable',
      fallback: true 
    }, { status: 500 });
  }
}