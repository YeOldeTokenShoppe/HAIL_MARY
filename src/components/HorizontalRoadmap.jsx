"use client";

import React, { useState, useEffect } from 'react';

const HorizontalRoadmap = ({ isVisible = true, isMobile = false }) => {
  const [animateIn, setAnimateIn] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    if (isVisible) {
      // Stagger the animation slightly after becoming visible
      const timer = setTimeout(() => setAnimateIn(true), 200);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  // Detect orientation changes on mobile
  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const milestones = [
    { id: 1, title: 'Launch', titleShort: 'Launch', date: 'Q1 2025', icon: '🚀', badge: 'Q1' },
    { id: 2, title: 'Build up LP', titleShort: 'Liquidity', date: '', icon: '💧', badge: null },
    { id: 3, title: 'Staking Rewards', titleShort: 'Staking', date: 'Q2', icon: '💎', badge: 'Q2' },
    { id: 4, title: 'More Rewards', titleShort: 'Rewards', date: '', icon: '🎁', badge: null },
    { id: 5, title: '0% Taxes', titleShort: '0% Tax', date: '', icon: '✨', badge: 'Q?' },
  ];

  // Position nodes along the zigzag path
  // x = percentage from left, y = percentage from top (0=top, 100=bottom)
  // Pattern: 4 segments total - last waypoint reaches higher for dramatic finish
  const nodePositions = [
    { x: 10, y: 70 },   // Point 1: start low
    { x: 28, y: 40 },   // Point 2: up
    { x: 46, y: 70 },   // Point 3: dip down
    { x: 64, y: 20 },   // Point 4: up
    { x: 82, y: 35 },   // Point 5: clearly higher than point 4
  ];

  if (!isVisible) return null;

  const nodeSize = isMobile ? (isLandscape ? 32 : 38) : 44;
  const containerHeight = isMobile ? 120 : 140;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: isMobile ? '100%' : '800px',
        margin: '0 auto',
        padding: isMobile ? '10px 0' : '20px',
        opacity: animateIn ? 1 : 0,
        transform: animateIn ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.8s ease-out',
      }}
    >
      {/* Timeline container */}
      <div
        style={{
          position: 'relative',
          height: `${containerHeight}px`,
          padding: isMobile ? '0 5px' : '0 20px',
        }}
      >
        {/* SVG Zigzag Arrow Line */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            overflow: 'visible',
            opacity: animateIn ? 1 : 0,
            transition: 'opacity 1s ease-out 0.3s',
          }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff00ff" />
              <stop offset="50%" stopColor="#00ffff" />
              <stop offset="100%" stopColor="#ff00ff" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Main zigzag path - connects through each node */}
          <path
            d={`M 0 90
                L ${nodePositions[0].x} ${nodePositions[0].y}
                L ${nodePositions[1].x} ${nodePositions[1].y}
                L ${nodePositions[2].x} ${nodePositions[2].y}
                L ${nodePositions[3].x} ${nodePositions[3].y}
                L ${nodePositions[4].x} ${nodePositions[4].y}
                L 94 10`}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
            style={{
              vectorEffect: 'non-scaling-stroke',
            }}
          />

          {/* Arrow head at the end - pointing up-right along line direction */}
          <polygon
            points="100, -5 90,05 95, 18"
            fill="#ff00ff"
            filter="url(#glow)"
          />
        </svg>

        {/* Milestone nodes */}
        {milestones.map((milestone, index) => {
          const isHovered = hoveredIndex === index;
          const showBox = isMobile ? isLandscape : isHovered;
          const pos = nodePositions[index];

          return (
            <div
              key={milestone.id}
              style={{
                position: 'absolute',
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: 'translate(-50%, -70%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                zIndex: isHovered ? 10 : 1,
                opacity: animateIn ? 1 : 0,
                transition: `all 0.5s ease-out ${0.2 + index * 0.1}s`,
              }}
              onMouseEnter={() => !isMobile && setHoveredIndex(index)}
              onMouseLeave={() => !isMobile && setHoveredIndex(null)}
            >
              {/* Info box above */}
              <div
                style={{
                  background: 'rgba(20, 10, 35, 0.9)',
                  border: '1px solid rgba(255, 0, 255, 0.5)',
                  borderRadius: isMobile ? '6px' : '8px',
                  padding: isMobile ? '4px 6px' : '8px 12px',
                  marginBottom: isMobile ? '8px' : '10px',
                  minWidth: isMobile ? '55px' : '80px',
                  maxWidth: isMobile ? '70px' : '100px',
                  textAlign: 'center',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 0 15px rgba(255, 0, 255, 0.2)',
                  opacity: showBox ? 1 : 0,
                  transform: `translateY(${showBox ? 0 : 10}px)`,
                  transition: 'all 0.3s ease',
                  pointerEvents: showBox ? 'auto' : 'none',
                }}
              >
                <div
                  style={{
                    fontSize: isMobile ? '12px' : '12px',
                    fontWeight: 'bold',
                    color: '#ff00ff',
                    textShadow: '0 0 10px rgba(255, 0, 255, 0.8)',
                    lineHeight: 1.2,
                    marginBottom: milestone.date ? '2px' : '0',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isMobile ? milestone.titleShort : milestone.title}
                </div>
                {milestone.date && (
                  <div
                    style={{
                      fontSize: isMobile ? '7px' : '10px',
                      color: '#00ffff',
                      textShadow: '0 0 5px rgba(0, 255, 255, 0.5)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {milestone.date}
                  </div>
                )}
              </div>

              {/* Node/Icon with badge */}
              <div style={{ position: 'relative' }}>
                {/* Badge for mobile portrait */}
                {isMobile && !isLandscape && milestone.badge && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-35px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: '22px',
                      fontWeight: 'bold',
                      color: '#00ffff',
                      textShadow: '0 0 10px rgba(0, 255, 255, 0.9), 0 0 20px rgba(0, 255, 255, 0.5)',
                      fontFamily: 'monospace',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {milestone.badge}
                  </div>
                )}
                <div
                  style={{
                    width: `${nodeSize}px`,
                    height: `${nodeSize}px`,
                    borderRadius: '50%',
                    background: 'rgba(20, 10, 35, 0.95)',
                    border: `2px solid ${isHovered ? '#00ffff' : '#ff00ff'}`,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontSize: isMobile ? (isLandscape ? '14px' : '18px') : '20px',
                    boxShadow: isHovered
                      ? '0 0 25px rgba(0, 255, 255, 0.9), inset 0 0 15px rgba(0, 255, 255, 0.4)'
                      : '0 0 15px rgba(255, 0, 255, 0.6), inset 0 0 10px rgba(255, 0, 255, 0.2)',
                    transition: 'all 0.3s ease',
                    cursor: isMobile ? 'default' : 'pointer',
                    transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                  }}
                >
                  {milestone.icon}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HorizontalRoadmap;
