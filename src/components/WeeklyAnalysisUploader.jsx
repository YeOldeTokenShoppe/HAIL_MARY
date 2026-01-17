/**
 * Weekly Analysis Uploader Component
 * 
 * Simple interface for uploading YouTube transcripts and other weekly market analysis
 * to keep agent knowledge bases current.
 */

'use client';

import { useState } from 'react';

export function WeeklyAnalysisUploader() {
  const [formData, setFormData] = useState({
    title: '',
    channel: '',
    transcript: '',
    publishDate: new Date().toISOString().split('T')[0]
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    setUploadResult(null);

    try {
      const response = await fetch('/api/weekly-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();
      
      if (result.success) {
        setUploadResult({
          type: 'success',
          message: 'Analysis processed successfully!',
          agentInsights: result.agentInsights
        });
        
        // Reset form
        setFormData({
          title: '',
          channel: '',
          transcript: '',
          publishDate: new Date().toISOString().split('T')[0]
        });
      } else {
        setUploadResult({
          type: 'error',
          message: result.error || 'Upload failed'
        });
      }
    } catch (error) {
      setUploadResult({
        type: 'error',
        message: 'Network error: ' + error.message
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handlePasteTranscript = () => {
    // Auto-fill with sample data for testing
    setFormData({
      title: 'Bitcoin Technical Analysis - Weekly Outlook',
      channel: 'Crypto Expert Channel',
      transcript: `This week's Bitcoin analysis shows strong support at $95,000 level. RSI is showing bullish divergence while MACD is crossing above signal line. 

Fear and greed index at 45 suggests neutral sentiment, but funding rates are turning negative which could signal short squeeze potential.

From a macro perspective, the Fed's dovish stance continues to support risk assets. Dollar weakness is providing tailwinds for Bitcoin.

Risk management is key here - position sizing should be conservative given the current volatility. Target resistance at $105,000 with stop loss below $92,000.`,
      publishDate: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">Weekly Analysis Uploader</h2>
        <button
          onClick={handlePasteTranscript}
          className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          Load Sample
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title Input */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Video/Analysis Title
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder="e.g., Bitcoin Weekly Analysis - January 2026"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Channel Input */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Channel/Source
            </label>
            <input
              type="text"
              name="channel"
              value={formData.channel}
              onChange={handleInputChange}
              placeholder="e.g., Coin Bureau, Real Vision"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Publish Date */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Publish Date
            </label>
            <input
              type="date"
              name="publishDate"
              value={formData.publishDate}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Transcript Input */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Transcript
          </label>
          <textarea
            name="transcript"
            value={formData.transcript}
            onChange={handleInputChange}
            rows={12}
            placeholder="Paste the full transcript here..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            required
          />
          <p className="text-xs text-gray-400 mt-1">
            The system will automatically extract insights for EMO, TEKNO, MACRO, and RL80 agents.
          </p>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isUploading || !formData.title || !formData.transcript}
            className={`px-6 py-2 rounded-md font-medium ${
              isUploading || !formData.title || !formData.transcript
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isUploading ? 'Processing...' : 'Upload & Process'}
          </button>
        </div>
      </form>

      {/* Upload Result */}
      {uploadResult && (
        <div className={`mt-4 p-4 rounded-md ${
          uploadResult.type === 'success' ? 'bg-green-900 border border-green-600' : 'bg-red-900 border border-red-600'
        }`}>
          <p className={`font-medium ${uploadResult.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
            {uploadResult.message}
          </p>
          
          {uploadResult.agentInsights && (
            <div className="mt-3 text-sm text-gray-300">
              <p className="font-medium">Insights extracted for agents:</p>
              <div className="grid grid-cols-4 gap-2 mt-2">
                <div className="text-center">
                  <div className="text-blue-400 font-bold">{uploadResult.agentInsights.EMO}</div>
                  <div className="text-xs">EMO</div>
                </div>
                <div className="text-center">
                  <div className="text-green-400 font-bold">{uploadResult.agentInsights.TEKNO}</div>
                  <div className="text-xs">TEKNO</div>
                </div>
                <div className="text-center">
                  <div className="text-yellow-400 font-bold">{uploadResult.agentInsights.MACRO}</div>
                  <div className="text-xs">MACRO</div>
                </div>
                <div className="text-center">
                  <div className="text-purple-400 font-bold">{uploadResult.agentInsights.RL80}</div>
                  <div className="text-xs">RL80</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-gray-800 rounded-md">
        <h3 className="text-sm font-medium text-gray-300 mb-2">How to use:</h3>
        <ol className="text-xs text-gray-400 space-y-1">
          <li>1. Copy transcript from YouTube video (use auto-generated captions or manual transcripts)</li>
          <li>2. Fill in the video title and channel name</li>
          <li>3. Paste the transcript in the text area</li>
          <li>4. Click "Upload & Process" to extract insights for all agents</li>
        </ol>
        
        <div className="mt-3">
          <h4 className="text-sm font-medium text-gray-300 mb-1">What gets extracted:</h4>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• <span className="text-blue-400">EMO</span>: Sentiment indicators, fear/greed levels, social psychology</li>
            <li>• <span className="text-green-400">TEKNO</span>: Support/resistance levels, technical patterns, indicators</li>
            <li>• <span className="text-yellow-400">MACRO</span>: Economic policy, Fed commentary, global trends</li>
            <li>• <span className="text-purple-400">RL80</span>: Trading strategies, risk management, position sizing</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default WeeklyAnalysisUploader;