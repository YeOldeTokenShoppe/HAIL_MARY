#!/usr/bin/env node
/**
 * Scoring Workflow Runner for Railway
 *
 * Simple entry point to run the scoring workflow.
 * Can be used as a Railway cron job or one-off task.
 *
 * Usage:
 *   node src/trading/services/runScoringWorkflow.js
 *   node src/trading/services/runScoringWorkflow.js --scheduled
 *   node src/trading/services/runScoringWorkflow.js --health
 */

import 'dotenv/config';
import { runScoringWorkflow, startScheduledWorkflow, healthCheck } from './scoringOrchestrator.js';

async function main() {
  const args = process.argv.slice(2);

  console.log('='.repeat(60));
  console.log('RL80 Agent Scoring System');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  // Check required env vars
  const requiredEnvVars = [
    'GROK_API_KEY',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY'
  ];

  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingVars.length > 0) {
    console.warn(`⚠️ Missing env vars: ${missingVars.join(', ')}`);
    console.warn('Some agents may fail without their API keys.');
  }

  // Firebase check
  if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.warn('⚠️ No Firebase credentials found. Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS');
  }

  try {
    if (args.includes('--health')) {
      // Health check only
      const health = await healthCheck();
      console.log('\nHealth Check Results:');
      console.log(JSON.stringify(health, null, 2));
      process.exit(Object.values(health).every(v => v) ? 0 : 1);

    } else if (args.includes('--scheduled')) {
      // Run on schedule (keeps process alive)
      const intervalArg = args.find(a => a.startsWith('--interval='));
      const intervalMinutes = intervalArg ? parseInt(intervalArg.split('=')[1]) : 60;
      const intervalMs = intervalMinutes * 60 * 1000;

      console.log(`\nStarting scheduled workflow (every ${intervalMinutes} minutes)`);
      console.log('Press Ctrl+C to stop\n');

      startScheduledWorkflow(intervalMs);

    } else {
      // Single run (default)
      console.log('\nRunning single workflow...\n');

      const result = await runScoringWorkflow();

      console.log('\n' + '='.repeat(60));
      console.log('Workflow Result Summary:');
      console.log(`  Success: ${result.success}`);
      console.log(`  Duration: ${(result.duration / 1000).toFixed(1)}s`);
      console.log(`  Agents: ${result.agentsCompleted.join(' → ') || 'None'}`);

      if (result.decision?.summary) {
        console.log(`  Tradeable: ${result.decision.summary.tradeable} positions`);
        console.log(`  Total Heat: ${result.decision.summary.totalHeat}`);
      }

      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
      console.log('='.repeat(60));

      process.exit(result.success ? 0 : 1);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
