import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Simple file-based usage tracking (in production, use a database)
const USAGE_FILE = path.join(process.cwd(), 'usage-log.json');

// Save usage data
export async function POST(request) {
  try {
    const usageData = await request.json();
    
    // Read existing data
    let existingData = [];
    try {
      const fileContent = await fs.readFile(USAGE_FILE, 'utf-8');
      existingData = JSON.parse(fileContent);
    } catch (error) {
      // File doesn't exist yet, start fresh
    }
    
    // Add new usage data
    existingData.push({
      ...usageData,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 1000 entries to prevent file from growing too large
    if (existingData.length > 1000) {
      existingData = existingData.slice(-1000);
    }
    
    // Save to file
    await fs.writeFile(USAGE_FILE, JSON.stringify(existingData, null, 2));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving usage data:', error);
    return NextResponse.json({ error: 'Failed to save usage data' }, { status: 500 });
  }
}

// Get usage statistics
export async function GET() {
  try {
    let data = [];
    try {
      const fileContent = await fs.readFile(USAGE_FILE, 'utf-8');
      data = JSON.parse(fileContent);
    } catch (error) {
      return NextResponse.json({ 
        message: 'No usage data yet',
        totalCalls: 0,
        totalTokens: 0,
        estimatedCost: 0
      });
    }
    
    // Calculate statistics
    const stats = {
      totalCalls: data.length,
      totalTokens: data.reduce((sum, item) => sum + (item.totalTokens || 0), 0),
      estimatedCost: data.reduce((sum, item) => sum + (parseFloat(item.estimatedCost) || 0), 0),
      last24Hours: data.filter(item => {
        const itemTime = new Date(item.timestamp);
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return itemTime > dayAgo;
      }).length,
      recentCalls: data.slice(-10).reverse() // Last 10 calls
    };
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error reading usage data:', error);
    return NextResponse.json({ error: 'Failed to read usage data' }, { status: 500 });
  }
}