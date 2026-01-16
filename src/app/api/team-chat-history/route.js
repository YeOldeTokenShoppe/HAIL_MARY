// API Route for Team Chat History
// Returns historical chat messages from AI agents
import { NextResponse } from 'next/server';

// In-memory storage for chat messages (replace with your preferred database)
let chatHistory = [
  {
    id: 1,
    agent: 'RL80',
    message: 'Initializing trading systems...',
    type: 'learning',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    sentiment: 'neutral'
  },
  {
    id: 2,
    agent: 'TEKNO',
    message: 'Market volatility increasing, adjusting position sizes',
    type: 'trading',
    timestamp: new Date(Date.now() - 240000).toISOString(),
    sentiment: 'warning'
  },
  {
    id: 3,
    agent: 'MACRO',
    message: 'Fed signals dovish stance, bullish for risk assets',
    type: 'market',
    timestamp: new Date(Date.now() - 180000).toISOString(),
    sentiment: 'positive'
  },
  {
    id: 4,
    agent: 'EMO',
    message: 'Fear index at 28, market showing greed signals',
    type: 'sentiment',
    timestamp: new Date(Date.now() - 120000).toISOString(),
    sentiment: 'positive'
  }
];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 20;

    // Sort by timestamp descending and limit results
    const messages = chatHistory
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit)
      .reverse(); // Reverse to show oldest first

    return NextResponse.json({
      success: true,
      messages,
      count: messages.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Team chat history error:', error);
    return NextResponse.json({
      success: false,
      messages: [],
      error: error.message
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { agent, message, type, sentiment } = await request.json();

    if (!agent || !message) {
      return NextResponse.json({
        success: false,
        error: 'Agent and message are required'
      }, { status: 400 });
    }

    // Add new message to history
    const newMessage = {
      id: chatHistory.length + 1,
      agent,
      message,
      type: type || 'trading',
      timestamp: new Date().toISOString(),
      sentiment: sentiment || 'neutral'
    };

    chatHistory.push(newMessage);

    // Keep only last 100 messages to prevent memory issues
    if (chatHistory.length > 100) {
      chatHistory = chatHistory.slice(-100);
    }

    return NextResponse.json({
      success: true,
      message: newMessage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Team chat post error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// Export chat history for other modules to access
export function getChatHistory() {
  return chatHistory;
}

// Add a message programmatically
export function addChatMessage(agent, message, type = 'trading', sentiment = 'neutral') {
  const newMessage = {
    id: chatHistory.length + 1,
    agent,
    message,
    type,
    timestamp: new Date().toISOString(),
    sentiment
  };

  chatHistory.push(newMessage);

  // Keep only last 100 messages
  if (chatHistory.length > 100) {
    chatHistory = chatHistory.slice(-100);
  }

  return newMessage;
}