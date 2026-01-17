'use client';

import { useState, useEffect } from 'react';
import { WeeklyAnalysisUploader } from '../../components/WeeklyAnalysisUploader';
import { AdminAnalysisViewer } from '../../components/AdminAnalysisViewer';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('upload');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');

  // Simple password protection - replace with proper auth in production
  const checkAuth = (inputPassword) => {
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin123';
    if (inputPassword === adminPassword) {
      setIsAuthenticated(true);
      localStorage.setItem('admin_auth', 'true');
    } else {
      alert('Incorrect password');
    }
  };

  useEffect(() => {
    // Check if already authenticated
    if (localStorage.getItem('admin_auth') === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 max-w-md w-full mx-4">
          <h1 className="text-2xl font-bold text-white mb-6 text-center">Admin Access</h1>
          <div className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && checkAuth(password)}
            />
            <button
              onClick={() => checkAuth(password)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md font-medium"
            >
              Access Admin Panel
            </button>
          </div>
          <div className="mt-4 text-xs text-gray-400 text-center">
            Default password: admin123 (set NEXT_PUBLIC_ADMIN_PASSWORD to customize)
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Trading Agents Admin</h1>
              <p className="text-gray-400">Manage agent knowledge and analyze performance</p>
            </div>
            <button
              onClick={() => {
                setIsAuthenticated(false);
                localStorage.removeItem('admin_auth');
              }}
              className="text-sm text-gray-400 hover:text-white border border-gray-600 hover:border-gray-500 px-3 py-1 rounded"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="border-b border-gray-700">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'upload'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              Upload Transcripts
            </button>
            <button
              onClick={() => setActiveTab('analysis')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'analysis'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              View Analysis
            </button>
            <button
              onClick={() => setActiveTab('agents')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'agents'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              Agent Performance
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'upload' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white mb-2">Weekly Analysis Upload</h2>
              <p className="text-gray-400">
                Upload YouTube transcripts and other market analysis to enhance agent knowledge.
              </p>
            </div>
            <WeeklyAnalysisUploader />
          </div>
        )}

        {activeTab === 'analysis' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white mb-2">Analysis History</h2>
              <p className="text-gray-400">
                View and manage uploaded analysis and extracted insights by agent.
              </p>
            </div>
            <AdminAnalysisViewer />
          </div>
        )}

        {activeTab === 'agents' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white mb-2">Agent Performance</h2>
              <p className="text-gray-400">
                Monitor agent accuracy, response quality, and knowledge utilization.
              </p>
            </div>
            <AgentPerformancePanel />
          </div>
        )}
      </div>
    </div>
  );
}

// Agent Performance Panel Component
function AgentPerformancePanel() {
  const [performanceData] = useState({
    EMO: {
      totalResponses: 156,
      avgConfidence: 0.78,
      knowledgeUpdates: 12,
      lastUpdate: '2 hours ago'
    },
    TEKNO: {
      totalResponses: 142,
      avgConfidence: 0.85,
      knowledgeUpdates: 8,
      lastUpdate: '1 hour ago'
    },
    MACRO: {
      totalResponses: 98,
      avgConfidence: 0.82,
      knowledgeUpdates: 6,
      lastUpdate: '3 hours ago'
    },
    RL80: {
      totalResponses: 203,
      avgConfidence: 0.76,
      knowledgeUpdates: 15,
      lastUpdate: '30 minutes ago'
    }
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Object.entries(performanceData).map(([agent, data]) => (
        <div key={agent} className="bg-gray-900 border border-gray-700 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">{agent}</h3>
            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
          </div>
          
          <div className="space-y-3">
            <div>
              <div className="text-sm text-gray-400">Total Responses</div>
              <div className="text-xl font-bold text-white">{data.totalResponses}</div>
            </div>
            
            <div>
              <div className="text-sm text-gray-400">Avg Confidence</div>
              <div className="text-xl font-bold text-green-400">
                {(data.avgConfidence * 100).toFixed(0)}%
              </div>
            </div>
            
            <div>
              <div className="text-sm text-gray-400">Knowledge Updates</div>
              <div className="text-xl font-bold text-blue-400">{data.knowledgeUpdates}</div>
            </div>
            
            <div className="pt-2 border-t border-gray-700">
              <div className="text-xs text-gray-500">Last Update: {data.lastUpdate}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}