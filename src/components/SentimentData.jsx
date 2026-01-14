import React, { useState, useEffect } from 'react';

// Mock data - this would come from your AI analysis endpoint
const mockSentimentData = {
  overall: 0.72, // 0-1 scale
  label: 'Hopeful',
  emotions: [
    { name: 'Hope', value: 34, color: '#4ade80' },
    { name: 'Gratitude', value: 28, color: '#a78bfa' },
    { name: 'Desperation', value: 18, color: '#f87171' },
    { name: 'Confession', value: 12, color: '#60a5fa' },
    { name: 'Celebration', value: 8, color: '#fbbf24' },
  ],
  prayersPerHour: 47,
  trend: [0.45, 0.52, 0.48, 0.61, 0.58, 0.65, 0.72],
  keywords: ['moon', 'lambo', 'blessed', 'diamond hands', 'forgive me', 'hold', 'believe'],
  lastUpdate: '2 min ago'
};

const sentimentLevels = [
  { label: 'Despair', color: '#991b1b', min: 0 },
  { label: 'Doubt', color: '#c2410c', min: 0.2 },
  { label: 'Steady', color: '#a16207', min: 0.4 },
  { label: 'Hopeful', color: '#4d7c0f', min: 0.6 },
  { label: 'Euphoric', color: '#15803d', min: 0.8 },
];

export default function CongregationSentiment() {
  const [data, setData] = useState(mockSentimentData);
  const [activeKeyword, setActiveKeyword] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  // Rotate through keywords
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveKeyword(prev => (prev + 1) % data.keywords.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [data.keywords.length]);

  const gaugeRotation = -90 + (data.overall * 180);
  
  return (
    <div className="sentiment-panel">
      {/* Header */}
      <div className="panel-header">
        <div className="header-icon">✦</div>
        <span className="header-title">Congregation's Mood</span>
        <button 
          className="expand-btn"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      {/* Main Gauge */}
      <div className="gauge-container">
        <svg viewBox="0 0 200 120" className="gauge-svg">
          {/* Background arc segments */}
          {sentimentLevels.map((level, i) => (
            <path
              key={level.label}
              d={describeArc(100, 100, 70, -90 + (i * 36), -90 + ((i + 1) * 36))}
              fill="none"
              stroke={level.color}
              strokeWidth="16"
              opacity="0.3"
              className="gauge-segment"
            />
          ))}
          
          {/* Active arc */}
          <path
            d={describeArc(100, 100, 70, -90, gaugeRotation)}
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="16"
            strokeLinecap="round"
            className="gauge-active"
          />
          
          {/* Glow effect */}
          <path
            d={describeArc(100, 100, 70, -90, gaugeRotation)}
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="20"
            strokeLinecap="round"
            filter="url(#glow)"
            opacity="0.6"
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
          <span className="label-text">{data.label}</span>
          <span className="label-value">{Math.round(data.overall * 100)}%</span>
        </div>
      </div>

      {/* Trend Sparkline */}
      <div className="trend-section">
        <span className="trend-label">7d Trend</span>
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

      {/* Whispers - Rotating Keywords */}
      <div className="whispers-section">
        <div className="whispers-label">
          <span className="whisper-icon">🕯</span>
          Whispers from the Faithful
        </div>
        <div className="keyword-display">
          {data.keywords.map((keyword, i) => (
            <span
              key={keyword}
              className={`keyword ${i === activeKeyword ? 'active' : ''}`}
            >
              "{keyword}"
            </span>
          ))}
        </div>
      </div>

      {/* Expanded Section */}
      {isExpanded && (
        <div className="expanded-content">
          {/* Emotion Breakdown */}
          <div className="emotions-section">
            <span className="section-label">Prayer Themes</span>
            <div className="emotion-bars">
              {data.emotions.map(emotion => (
                <div key={emotion.name} className="emotion-row">
                  <span className="emotion-name">{emotion.name}</span>
                  <div className="emotion-bar-bg">
                    <div 
                      className="emotion-bar-fill"
                      style={{ 
                        width: `${emotion.value}%`,
                        backgroundColor: emotion.color,
                        boxShadow: `0 0 10px ${emotion.color}80`
                      }}
                    />
                  </div>
                  <span className="emotion-value">{emotion.value}%</span>
                </div>
              ))}
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
              <span className="stat-value">{data.lastUpdate}</span>
              <span className="stat-label">last analyzed</span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .sentiment-panel {
          font-family: monospace;
          background: rgba(0, 0, 0, 0.8);
          border: none;
          border-radius: 12px;
          padding: 18px;
          width: 100%;
          color: #fff;
        }

        .panel-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          margin-bottom: 8px;
        }

        .header-icon {
          color: #d4af37;
          font-size: 14px;
          animation: pulse-glow 2s ease-in-out infinite;
        }

        .header-title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #d4af37;
          flex: 1;
        }

        .expand-btn {
          background: rgba(212, 175, 55, 0.2);
          border: 1px solid rgba(212, 175, 55, 0.3);
          color: #d4af37;
          width: 20px;
          height: 20px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          line-height: 1;
          transition: all 0.2s;
        }

        .expand-btn:hover {
          background: rgba(212, 175, 55, 0.3);
          box-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
        }

        .gauge-container {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .gauge-svg {
          width: 100%;
          height: auto;
          margin-bottom: -20px;
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
          margin-top: -10px;
        }

        .label-text {
          display: block;
          font-size: 18px;
          font-weight: bold;
          color: #4ade80;
          text-shadow: 0 0 20px rgba(74, 222, 128, 0.6);
          letter-spacing: 2px;
        }

        .label-value {
          font-size: 12px;
          color: #ccc;
        }

        .trend-section {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .trend-label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #888;
          width: 50px;
        }

        .sparkline {
          flex: 1;
          height: 30px;
        }

        .sparkline-dot {
          animation: pulse-dot 1.5s ease-in-out infinite;
        }

        .whispers-section {
          padding: 10px 0;
        }

        .whispers-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #888;
          margin-bottom: 8px;
        }

        .whisper-icon {
          font-size: 12px;
        }

        .keyword-display {
          height: 24px;
          position: relative;
          overflow: hidden;
        }

        .keyword {
          position: absolute;
          width: 100%;
          text-align: center;
          font-size: 14px;
          font-style: italic;
          color: #a78bfa;
          opacity: 0;
          transform: translateY(10px);
          transition: all 0.5s ease;
        }

        .keyword.active {
          opacity: 1;
          transform: translateY(0);
          text-shadow: 0 0 15px rgba(167, 139, 250, 0.6);
        }

        .expanded-content {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: 12px;
          margin-top: 8px;
          animation: expand-in 0.3s ease-out;
        }

        .section-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #888;
          display: block;
          margin-bottom: 10px;
        }

        .emotion-bars {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .emotion-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .emotion-name {
          font-size: 10px;
          width: 70px;
          color: #ccc;
        }

        .emotion-bar-bg {
          flex: 1;
          height: 6px;
          background: rgba(0, 0, 0, 0.4);
          border-radius: 3px;
          overflow: hidden;
        }

        .emotion-bar-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.8s ease-out;
        }

        .emotion-value {
          font-size: 10px;
          width: 30px;
          text-align: right;
          color: #888;
        }

        .stats-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .stat-item {
          text-align: center;
        }

        .stat-value {
          display: block;
          font-size: 16px;
          color: #fbbf24;
          text-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
        }

        .stat-label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #888;
        }

        .stat-divider {
          width: 1px;
          height: 30px;
          background: rgba(255, 255, 255, 0.1);
        }

        @keyframes pulse-glow {
          0%, 100% { opacity: 1; text-shadow: 0 0 10px rgba(251, 191, 36, 0.8); }
          50% { opacity: 0.7; text-shadow: 0 0 20px rgba(251, 191, 36, 1); }
        }

        @keyframes pulse-dot {
          0%, 100% { r: 3; opacity: 1; }
          50% { r: 5; opacity: 0.8; }
        }

        @keyframes expand-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
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