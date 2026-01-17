/**
 * Admin Analysis Viewer Component
 * 
 * View and manage uploaded analysis and extracted insights by agent.
 */

'use client';

import { useState, useEffect } from 'react';

export function AdminAnalysisViewer() {
  const [selectedAgent, setSelectedAgent] = useState('EMO');
  const [analysisData, setAnalysisData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [daysBack, setDaysBack] = useState(7);

  const agents = [
    { id: 'EMO', name: 'EMO', color: 'blue' },
    { id: 'TEKNO', name: 'TEKNO', color: 'green' },
    { id: 'MACRO', name: 'MACRO', color: 'yellow' },
    { id: 'RL80', name: 'RL80', color: 'purple' }
  ];

  const loadAnalysisData = async (agent, days) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/weekly-analysis?agent=${agent}&days=${days}`);
      const result = await response.json();
      
      if (result.success) {
        setAnalysisData(prev => ({
          ...prev,
          [agent]: result.analysis
        }));
      }
    } catch (error) {
      console.error('Failed to load analysis:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalysisData(selectedAgent, daysBack);
  }, [selectedAgent, daysBack]);

  const currentAnalysis = analysisData[selectedAgent] || [];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-900 border-blue-600 text-blue-300',
      green: 'bg-green-900 border-green-600 text-green-300', 
      yellow: 'bg-yellow-900 border-yellow-600 text-yellow-300',
      purple: 'bg-purple-900 border-purple-600 text-purple-300'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Agent Selection */}
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-300">Agent:</label>
            {agents.map(agent => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent.id)}
                className={`px-3 py-1 text-sm rounded border ${
                  selectedAgent === agent.id
                    ? getColorClasses(agent.color)
                    : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {agent.name}
              </button>
            ))}
          </div>

          {/* Time Range */}
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-300">Days:</label>
            <select
              value={daysBack}
              onChange={(e) => setDaysBack(parseInt(e.target.value))}
              className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => loadAnalysisData(selectedAgent, daysBack)}
            disabled={isLoading}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Analysis List */}
      <div className="space-y-4">
        {currentAnalysis.length === 0 ? (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 text-center">
            <div className="text-gray-400">
              {isLoading ? 'Loading analysis...' : `No analysis found for ${selectedAgent} in the last ${daysBack} days`}
            </div>
          </div>
        ) : (
          currentAnalysis.map((analysis, index) => (
            <AnalysisCard
              key={index}
              analysis={analysis}
              agent={selectedAgent}
              colorClass={getColorClasses(agents.find(a => a.id === selectedAgent)?.color)}
            />
          ))
        )}
      </div>

      {/* Summary Stats */}
      {currentAnalysis.length > 0 && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-medium text-white mb-3">Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{currentAnalysis.length}</div>
              <div className="text-sm text-gray-400">Total Analysis</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">
                {currentAnalysis.reduce((sum, a) => sum + (a.insights?.length || 0), 0)}
              </div>
              <div className="text-sm text-gray-400">Insights Extracted</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">
                {currentAnalysis.reduce((sum, a) => sum + (a.keyQuotes?.length || 0), 0)}
              </div>
              <div className="text-sm text-gray-400">Key Quotes</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-400">
                {new Set(currentAnalysis.map(a => a.source)).size}
              </div>
              <div className="text-sm text-gray-400">Unique Sources</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisCard({ analysis, agent, colorClass }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-gray-800"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-lg font-medium text-white mb-1">
              {analysis.source || 'Unknown Source'}
            </h3>
            <div className="text-sm text-gray-400 mb-2">
              {new Date(analysis.date).toLocaleDateString()} • {agent} Analysis
            </div>
            <div className="flex items-center space-x-4 text-sm">
              <span className="text-green-400">
                {analysis.insights?.length || 0} insights
              </span>
              <span className="text-blue-400">
                {analysis.keyQuotes?.length || 0} quotes
              </span>
              {analysis.riskWarnings?.length > 0 && (
                <span className="text-red-400">
                  {analysis.riskWarnings.length} warnings
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className={`px-2 py-1 rounded text-xs ${colorClass}`}>
              {agent}
            </div>
            <div className="text-gray-400">
              {isExpanded ? '▼' : '▶'}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-700 p-4 space-y-4">
          {/* Insights */}
          {analysis.insights && analysis.insights.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">Extracted Insights</h4>
              <div className="space-y-2">
                {analysis.insights.slice(0, 5).map((insight, index) => (
                  <div key={index} className="bg-gray-800 rounded p-3">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-medium text-gray-400 uppercase">
                        {insight.type?.replace('_', ' ')}
                      </span>
                      {insight.priceLevel && (
                        <span className="text-xs text-yellow-400">
                          ${insight.priceLevel}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-200">{insight.content}</div>
                  </div>
                ))}
                {analysis.insights.length > 5 && (
                  <div className="text-xs text-gray-400 text-center">
                    ... and {analysis.insights.length - 5} more insights
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Key Quotes */}
          {analysis.keyQuotes && analysis.keyQuotes.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">Key Quotes</h4>
              <div className="space-y-2">
                {analysis.keyQuotes.slice(0, 3).map((quote, index) => (
                  <div key={index} className="bg-gray-800 rounded p-3">
                    <div className="text-sm text-gray-200 italic">"{quote}"</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk Warnings */}
          {analysis.riskWarnings && analysis.riskWarnings.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-red-400 mb-2">Risk Warnings</h4>
              <div className="space-y-2">
                {analysis.riskWarnings.map((warning, index) => (
                  <div key={index} className="bg-red-900/20 border border-red-600/30 rounded p-3">
                    <div className="text-sm text-red-300">{warning}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trading Targets (RL80 only) */}
          {agent === 'RL80' && analysis.tradingTargets && analysis.tradingTargets.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-purple-400 mb-2">Trading Targets</h4>
              <div className="space-y-2">
                {analysis.tradingTargets.map((target, index) => (
                  <div key={index} className="bg-purple-900/20 border border-purple-600/30 rounded p-3">
                    <div className="text-sm text-purple-300">{target}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminAnalysisViewer;