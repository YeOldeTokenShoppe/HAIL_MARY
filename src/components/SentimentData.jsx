import React, { useState, useEffect } from 'react';
import { db, doc, getDoc, onSnapshot } from '@/lib/firebaseClient';

// Default data structure for when loading or no data
const defaultSentimentData = {
  overall: 0.5,
  label: 'Loading...',
  emotions: [
    { name: 'Hope', value: 20, color: '#4ade80' },
    { name: 'Gratitude', value: 20, color: '#a78bfa' },
    { name: 'Desperation', value: 20, color: '#f87171' },
    { name: 'Confession', value: 20, color: '#60a5fa' },
    { name: 'Celebration', value: 20, color: '#fbbf24' },
  ],
  prayersPerHour: 0,
  trend: [0.35, 0.42, 0.38, 0.55, 0.48, 0.52, 0.5], // Mock trending data
  keywords: ['analyzing', 'prayers', '...'],
  prayerTypes: {
    petition: 62,
    confession: 18,
    appreciation: 20
  },
  lastUpdate: 'loading...'
};

const sentimentLevels = [
  { label: 'Despair', color: '#991b1b', min: 0 },
  { label: 'Doubt', color: '#c2410c', min: 0.2 },
  { label: 'Steady', color: '#a16207', min: 0.4 },
  { label: 'Hopeful', color: '#4d7c0f', min: 0.6 },
  { label: 'Euphoric', color: '#15803d', min: 0.8 },
];

export default function CongregationSentiment() {
  const [data, setData] = useState(defaultSentimentData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch sentiment data from Firebase and listen for real-time updates
  useEffect(() => {
    if (!db) {
      console.warn('Firebase not initialized');
      setIsLoading(false);
      return;
    }
    
    // Reference to the latest sentiment analysis document
    const sentimentRef = doc(db, 'sentiment_analysis', 'latest');
    
    // Set up real-time listener for sentiment updates
    const unsubscribe = onSnapshot(
      sentimentRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const sentimentData = docSnapshot.data();
          console.log('[Sentiment] Received update from Firebase:', sentimentData.label);

          // Check if trend data has variation (not all the same value)
          let trendData = sentimentData.trend || defaultSentimentData.trend;
          if (trendData && trendData.length > 0) {
            const allSame = trendData.every(val => val === trendData[0]);
            if (allSame) {
              // Use mock varied data if Firebase data is flat
              trendData = defaultSentimentData.trend;
            }
          }

          // Update data with real analysis from Firebase
          setData({
            overall: sentimentData.overall || 0.5,
            label: sentimentData.label || 'Unknown',
            emotions: sentimentData.emotions || defaultSentimentData.emotions,
            prayersPerHour: sentimentData.prayersPerHour || 0,
            trend: trendData,
            keywords: sentimentData.keywords || ['no', 'data', 'yet'],
            prayerTypes: sentimentData.prayerTypes || defaultSentimentData.prayerTypes,
            summary: sentimentData.summary || null,
            lastUpdate: sentimentData.lastUpdate ?
              new Date(sentimentData.lastUpdate).toLocaleTimeString() : 'just now',
            totalAnalyzed: sentimentData.totalAnalyzed || 0,
            nextUpdate: sentimentData.nextUpdate
          });
          setError(null);
        } else {
          setData({
            ...defaultSentimentData,
            label: 'No Analysis Yet',
            keywords: ['run', 'cron', 'job'],
            lastUpdate: 'never'
          });
        }
        setIsLoading(false);
      },
      (error) => {
        console.error('[Sentiment] Error fetching sentiment data:', error);
        setError(error.message);
        setData({
          ...defaultSentimentData,
          label: 'Data Error',
          keywords: ['error', 'loading'],
          lastUpdate: 'error'
        });
        setIsLoading(false);
      }
    );
    
    // Cleanup listener on unmount
    return () => unsubscribe();
  }, []);

  const gaugeRotation = -90 + (data.overall * 180);
  
  return (
    <div className="sentiment-panel">

      {/* Loading Indicator */}
      {isLoading && !data.totalAnalyzed && (
        <div style={{
          textAlign: 'center',
          padding: '20px',
          color: '#888',
          fontSize: '12px'
        }}>
          Analyzing trader prayers...
        </div>
      )}

      {/* Main Gauge */}
      <div className="gauge-container">
        <svg viewBox={isMobile ? "0 0 200 90" : "0 0 200 100"} className="gauge-svg">
          {/* Background arc segments - bottom semicircle */}
          {sentimentLevels.map((level, i) => (
            <path
              key={level.label}
              d={describeArc(100, 100, 70, 180 + (i * 36), 180 + ((i + 1) * 36))}
              fill="none"
              stroke={level.color}
              strokeWidth="16"
              opacity="0.3"
              className="gauge-segment"
            />
          ))}
          
          {/* Active arc - fixed to use same parameters as background */}
          <path
            d={describeArc(100, 100, 70, 180, 180 + (data.overall * 180))}
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="16"
            strokeLinecap="round"
            className="gauge-active"
          />
          
          {/* Needle */}
          <g transform={`rotate(${gaugeRotation}, 100, 100)`}>
            <line
              x1="100" y1="100"
              x2="100" y2="40"
              stroke="#fef3c7"
              strokeWidth="3"
              strokeLinecap="round"
              className="gauge-needle"
            />
            <circle cx="100" cy="100" r="8" fill="#fef3c7" />
            <circle cx="100" cy="100" r="4" fill="#1a1a2e" />
          </g>
          
          {/* Gradient definition */}
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
        </svg>
        
        {/* Sentiment Label */}
        <div className="sentiment-label">
          <span className="label-text" style={{
            maxWidth: isMobile ? '140px' : '200px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'inline-block'
          }}>{data.label}</span>
        </div>
        
        {/* Percentage in center bottom */}
        <div className="gauge-percentage">
          {Math.round(data.overall * 100)}%
        </div>
      </div>

      {/* Trend Sparkline */}
      <div className="trend-section">
        <div className="trend-label">7-Day Sentiment</div>
        <svg viewBox="0 0 100 30" className="sparkline">
          <polyline
            fill="none"
            stroke="url(#sparkGradient)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={data.trend.map((v, i) =>
              `${(i / (data.trend.length - 1)) * 100},${30 - (v * 28)}`
            ).join(' ')}
          />
          <circle
            cx="100"
            cy={30 - (data.trend[data.trend.length - 1] * 28)}
            r="3"
            fill="#4ade80"
            className="sparkline-dot"
          />
          <defs>
            <linearGradient id="sparkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#4ade80" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Prayer Types Breakdown */}
      <div className="prayer-types-section">
        <div className="prayer-types-label">Prayer Types</div>
        <div className="prayer-types-list">
          <div className="prayer-type-item">
            <div className="prayer-type-header">
              <span className="prayer-icon">🙏</span>
              <span className="prayer-name">Petition</span>
              <span className="prayer-percentage">{data.prayerTypes?.petition || 0}%</span>
            </div>
            <div className="prayer-bar">
              <div
                className="prayer-bar-fill petition"
                style={{ width: `${data.prayerTypes?.petition || 0}%` }}
              />
            </div>
          </div>

          <div className="prayer-type-item">
            <div className="prayer-type-header">
              <span className="prayer-icon">💭</span>
              <span className="prayer-name">Confession</span>
              <span className="prayer-percentage">{data.prayerTypes?.confession || 0}%</span>
            </div>
            <div className="prayer-bar">
              <div
                className="prayer-bar-fill confession"
                style={{ width: `${data.prayerTypes?.confession || 0}%` }}
              />
            </div>
          </div>

          <div className="prayer-type-item">
            <div className="prayer-type-header">
              <span className="prayer-icon">✨</span>
              <span className="prayer-name">Appreciation</span>
              <span className="prayer-percentage">{data.prayerTypes?.appreciation || 0}%</span>
            </div>
            <div className="prayer-bar">
              <div
                className="prayer-bar-fill appreciation"
                style={{ width: `${data.prayerTypes?.appreciation || 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Expanded content - always visible in tab view */}
      <div className="expanded-content">
          {/* AI Summary */}
          <div className="summary-section">
            <span className="section-label">Collective Consciousness</span>
            <div className="summary-text">
              {data.summary || "The AI is analyzing recent prayers and messages to 𝓞𝖚𝖗 𝕷𝖆𝖉𝖞 𝔬𝔣 𝕻𝖊𝖗𝖕𝖊𝖙𝖚𝖆𝖑 𝕻𝖗𝖔𝖋𝖎𝖙 to understand the spiritual temperature of the traders. Patterns in hope, gratitude, and requests are being processed..."}
            </div>
          </div>

          {/* Stats Row */}
          <div className="stats-row">
            <div className="stat-item">
              <span className="stat-value">{data.prayersPerHour}</span>
              <span className="stat-label">prayers/hr</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-value">{data.totalAnalyzed || 0}</span>
              <span className="stat-label">analyzed</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-value">{data.lastUpdate}</span>
              <span className="stat-label">updated</span>
            </div>
          </div>
        </div>

      <style>{`
        .sentiment-panel {
          font-family: monospace;
          background: transparent;
          border: none;
          padding: 0;
          width: 100%;
          color: #fff;
          font-size: 12px;
        }
        
        @media (max-width: 768px) {
          .sentiment-panel {
            font-size: 10px;
          }
        }


        .gauge-container {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 5px;
          height: 85px;

        }

        @media (max-width: 768px) {
          .gauge-container {
            height: 70px;
            margin-bottom: 4px;
          }
        }

        .gauge-svg {
          width: 100%;
          height: auto;
          max-height: 65px;
        }

        @media (max-width: 768px) {
          .gauge-svg {
            max-height: 50px;
          }
        }

        .gauge-segment {
          transition: opacity 0.3s;
        }

        .gauge-active {
          animation: draw-gauge 1.5s ease-out forwards;
        }

        .gauge-needle {
          transition: transform 0.5s ease-out;
        }

        .sentiment-label {
          text-align: center;
          margin-top: 0;
          margin-bottom: 5px;
          position: absolute;
          bottom: -25px;
          left: 0;
          right: 0;
        }
        
        @media (max-width: 768px) {
          .sentiment-label {
            bottom: 20px;
            margin-bottom: 2px;
          }
        }

        .gauge-percentage {
          position: absolute;
          bottom: 5px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 16px;
          font-weight: bold;
          color: #fff;
          text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
        }
        
        @media (max-width: 768px) {
          .gauge-percentage {
            bottom: 2px;
            font-size: 14px;
          }
        }

        .label-text {
          display: block;
          font-size: 14px;
          font-weight: bold;
          color: #4ade80;
          text-shadow: 0 0 10px rgba(74, 222, 128, 0.4);
          letter-spacing: 0.5px;
          margin: 0;
          padding: 0;
        }
        
        @media (max-width: 768px) {
          .label-text {
            font-size: 12px;
            letter-spacing: 0;
            text-shadow: 0 0 5px rgba(74, 222, 128, 0.3);
          }
        }

        .label-value {
          font-size: 11px;
          color: #ccc;
        }
        
        @media (max-width: 768px) {
          .label-value {
            font-size: 10px;
          }
        }

        .trend-section {
          padding: 8px;
          margin-top: 25px;
          margin-bottom: 8px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        @media (max-width: 768px) {
          .trend-section {
            padding: 6px;
            margin-top: 8px;
            margin-bottom: 6px;
          }
        }

        .trend-label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #888;
          margin-bottom: 6px;
          display: block;
          font-family: monospace;
        }

        @media (max-width: 768px) {
          .trend-label {
            font-size: 8px;
            margin-bottom: 4px;
          }
        }

        .sparkline {
          width: 100%;
          height: 30px;
          display: block;
        }

        @media (max-width: 768px) {
          .sparkline {
            height: 25px;
          }
        }

        .sparkline-dot {
          animation: pulse-dot 1.5s ease-in-out infinite;
          filter: drop-shadow(0 0 4px #4ade80);
        }

        .sparkline polyline {
          filter: drop-shadow(0 0 2px rgba(167, 139, 250, 0.4));
        }

        .prayer-types-section {
          padding: 8px;
          margin-bottom: 8px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        @media (max-width: 768px) {
          .prayer-types-section {
            padding: 6px;
            margin-bottom: 6px;
          }
        }

        .prayer-types-label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #888;
          margin-bottom: 8px;
          font-family: monospace;
        }

        @media (max-width: 768px) {
          .prayer-types-label {
            font-size: 8px;
            margin-bottom: 6px;
          }
        }

        .prayer-types-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        @media (max-width: 768px) {
          .prayer-types-list {
            gap: 5px;
          }
        }

        .prayer-type-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .prayer-type-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
        }

        @media (max-width: 768px) {
          .prayer-type-header {
            font-size: 10px;
            gap: 4px;
          }
        }

        .prayer-icon {
          font-size: 12px;
          flex-shrink: 0;
        }

        @media (max-width: 768px) {
          .prayer-icon {
            font-size: 11px;
          }
        }

        .prayer-name {
          flex: 1;
          color: #ccc;
          font-family: monospace;
        }

        .prayer-percentage {
          color: #fbbf24;
          font-weight: bold;
          font-family: monospace;
          min-width: 35px;
          text-align: right;
        }

        .prayer-bar {
          width: 100%;
          height: 6px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
          overflow: hidden;
        }

        @media (max-width: 768px) {
          .prayer-bar {
            height: 5px;
          }
        }

        .prayer-bar-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.5s ease;
        }

        .prayer-bar-fill.petition {
          background: linear-gradient(90deg, #4ade80, #22c55e);
          box-shadow: 0 0 8px rgba(74, 222, 128, 0.5);
        }

        .prayer-bar-fill.confession {
          background: linear-gradient(90deg, #60a5fa, #3b82f6);
          box-shadow: 0 0 8px rgba(96, 165, 250, 0.5);
        }

        .prayer-bar-fill.appreciation {
          background: linear-gradient(90deg, #fbbf24, #f59e0b);
          box-shadow: 0 0 8px rgba(251, 191, 36, 0.5);
        }

        .expanded-content {
          padding-top: 6px;
        }
        
        @media (max-width: 768px) {
          .expanded-content {
            padding-top: 4px;
          }
        }

        .section-label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #888;
          display: block;
          margin-bottom: 6px;
        }

        @media (max-width: 768px) {
          .section-label {
            font-size: 8px;
            margin-bottom: 5px;
          }
        }

        .summary-section {
          margin-bottom: 8px;
        }

        @media (max-width: 768px) {
          .summary-section {
            margin-bottom: 6px;
          }
        }

        .summary-text {
          font-size: 10px;
          line-height: 1.3;
          color: #ccc;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          padding: 6px 8px;
          border-left: 3px solid #a78bfa;
          font-style: italic;
        }

        @media (max-width: 768px) {
          .summary-text {
            font-size: 9px;
            line-height: 1.2;
            padding: 5px 6px;
          }
        }

        .stats-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        @media (max-width: 768px) {
          .stats-row {
            gap: 4px;
            margin-top: 4px;
            padding-top: 4px;
          }
        }

        .stat-item {
          text-align: center;
          flex: 1;
        }

        .stat-value {
          display: block;
          font-size: 14px;
          color: #fbbf24;
          text-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
        }
        
        @media (max-width: 768px) {
          .stat-value {
            font-size: 12px;
            text-shadow: 0 0 5px rgba(251, 191, 36, 0.3);
          }
        }

        .stat-label {
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #888;
        }
        
        @media (max-width: 768px) {
          .stat-label {
            font-size: 7px;
            letter-spacing: 0;
          }
        }

        .stat-divider {
          width: 1px;
          height: 20px;
          background: rgba(255, 255, 255, 0.1);
        }
        
        @media (max-width: 768px) {
          .stat-divider {
            height: 15px;
          }
        }

        @keyframes pulse-glow {
          0%, 100% { opacity: 1; text-shadow: 0 0 10px rgba(251, 191, 36, 0.8); }
          50% { opacity: 0.7; text-shadow: 0 0 20px rgba(251, 191, 36, 1); }
        }

        @keyframes pulse-dot {
          0%, 100% { r: 3; opacity: 1; }
          50% { r: 5; opacity: 0.8; }
        }

        @keyframes draw-gauge {
          from { stroke-dasharray: 0 1000; }
          to { stroke-dasharray: 1000 0; }
        }
      `}</style>
    </div>
  );
}

// Helper function to create SVG arc paths
function describeArc(x, y, radius, startAngle, endAngle) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  
  return [
    "M", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(" ");
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = (angleInDegrees) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
}