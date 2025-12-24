import { NextResponse } from 'next/server';

// Get the API key from environment (server-side only)
const OPENAI_API_KEY = process.env.OPENAI_SECRET_KEY;

export async function POST(request) {
  try {
    const { prompt, language, mode } = await request.json();
    
    if (!OPENAI_API_KEY) {
      console.error('OpenAI API key not found. Make sure OPENAI_SECRET_KEY is set in .env');
      return NextResponse.json(
        { error: 'OpenAI API key not configured on server' },
        { status: 500 }
      );
    }
    
    // Determine the system message based on mode
    let systemMessage = '';
    let userMessage = prompt;
    
    if (mode === 'generate') {
      const languageNames = {
        en: 'English',
        es: 'Spanish',
        pt: 'Portuguese',
        fr: 'French',
        it: 'Italian',
        zh: 'Chinese',
        hi: 'Hindi'
      };
      
      const languageName = languageNames[language] || 'English';
      
      systemMessage = `You are a humorous crypto prayer writer. Write prayers in the style of traditional Catholic prayers but about cryptocurrency trading. 
      IMPORTANT: Always address prayers to "Our Lady of Perpetual Profit" (or "RL80" for short). Never mention "the gods", other deities, or generic divine figures.
      Include crypto slang, trading terms, and be funny but respectful. 
      CRITICAL: Keep prayers under 400 CHARACTERS (not words). Be concise.
      Write in ${languageName}.
      End with "Amen" or the appropriate ending for ${languageName}.`;
      
      userMessage = prompt || 'Write a prayer for successful crypto trading';
    } else if (mode === 'translate') {
      const languageNames = {
        en: 'English',
        es: 'Spanish',
        pt: 'Portuguese',
        fr: 'French',
        it: 'Italian',
        zh: 'Chinese',
        hi: 'Hindi'
      };
      
      const languageName = languageNames[language] || 'English';
      
      systemMessage = `Translate this crypto trading prayer to ${languageName}. 
      IMPORTANT: Keep references to "Our Lady of Perpetual Profit" or "RL80". Do not change to other deities.
      Maintain the humorous tone and adapt crypto slang appropriately for the target culture.
      Keep the religious parody style.
      CRITICAL: Keep translation under 400 CHARACTERS.`;
      
      userMessage = prompt;
    }
    
    // Make the OpenAI API call
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemMessage
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        temperature: mode === 'translate' ? 0.3 : 0.8,
        max_tokens: 150 // Reduced to ensure we stay under 400 characters
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API error:', error);
      return NextResponse.json(
        { error: error.error?.message || 'OpenAI API error' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    const prayer = data.choices[0].message.content;
    
    return NextResponse.json({ prayer });
    
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: 'Failed to process prayer request' },
      { status: 500 }
    );
  }
}