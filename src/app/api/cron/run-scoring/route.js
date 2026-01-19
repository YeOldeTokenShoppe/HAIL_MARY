import { NextResponse } from 'next/server';
import { runScoringWorkflow } from '../../../../trading/services/scoringOrchestrator.js';

/**
 * Scoring Workflow Cron Endpoint
 *
 * Triggered by Firebase Scheduled Function (or manual call)
 * Runs the full EMO → TEKNO → MACRO → RL80 scoring pipeline
 *
 * Security: Requires CRON_SECRET in Authorization header
 */

export const maxDuration = 300; // 5 minutes max (scoring can take a while)
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const startTime = Date.now();

  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Scoring Cron] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('='.repeat(60));
    console.log('[Scoring Cron] Starting scoring workflow...');
    console.log(`[Scoring Cron] Time: ${new Date().toISOString()}`);
    console.log('='.repeat(60));

    // Run the scoring workflow
    const result = await runScoringWorkflow();

    const duration = Date.now() - startTime;

    console.log('='.repeat(60));
    console.log('[Scoring Cron] Workflow completed');
    console.log(`[Scoring Cron] Success: ${result.success}`);
    console.log(`[Scoring Cron] Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log(`[Scoring Cron] Agents: ${result.agentsCompleted?.join(' → ') || 'None'}`);
    console.log('='.repeat(60));

    return NextResponse.json({
      success: result.success,
      duration,
      agentsCompleted: result.agentsCompleted,
      summary: result.decision?.summary || null,
      error: result.error || null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Scoring Cron] Fatal error:', error);

    return NextResponse.json({
      success: false,
      error: error.message,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Also support GET for manual testing (with auth)
export async function GET(request) {
  return POST(request);
}
