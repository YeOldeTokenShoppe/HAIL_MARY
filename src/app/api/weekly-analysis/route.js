// API Route for Weekly Analysis Upload
// Handles YouTube transcript processing and agent knowledge updates

import { NextResponse } from 'next/server';
import { processWeeklyAnalysis, getRecentAnalysisForAgent } from '../../../trading/agents/configs/knowledge/weeklyAnalysisSystem.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { transcript, title, channel, publishDate, source = 'youtube' } = body;

    // Validate required fields
    if (!transcript || !title) {
      return NextResponse.json({
        success: false,
        error: 'Transcript and title are required'
      }, { status: 400 });
    }

    console.log(`📺 Processing weekly analysis: "${title}" from ${channel}`);

    // Process the transcript
    const transcriptData = {
      title,
      transcript,
      publishDate: publishDate || new Date().toISOString(),
      channel: channel || 'Unknown Channel'
    };

    const agentInsights = await processWeeklyAnalysis(transcriptData, source);

    return NextResponse.json({
      success: true,
      message: 'Weekly analysis processed successfully',
      agentInsights: {
        EMO: agentInsights.EMO.insights.length,
        TEKNO: agentInsights.TEKNO.insights.length, 
        MACRO: agentInsights.MACRO.insights.length,
        RL80: agentInsights.RL80.insights.length
      },
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Weekly analysis processing failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const agent = searchParams.get('agent');
    const daysBack = parseInt(searchParams.get('days')) || 7;

    if (!agent) {
      return NextResponse.json({
        success: false,
        error: 'Agent parameter required (EMO, TEKNO, MACRO, or RL80)'
      }, { status: 400 });
    }

    const recentAnalysis = await getRecentAnalysisForAgent(agent, daysBack);

    return NextResponse.json({
      success: true,
      agent,
      daysBack,
      analysisCount: recentAnalysis.length,
      analysis: recentAnalysis
    });

  } catch (error) {
    console.error('Failed to retrieve analysis:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}