"use client";
import React from 'react';

const NotificationBadge = ({ 
  count = 0, 
  showDot = false, 
  color = '#ff0041',
  pulse = true,
  position = 'top-right' 
}) => {
  // Don't render if no notifications
  if (count === 0 && !showDot) return null;
  
  // Position styles
  const positionStyles = {
    'top-right': { top: '-5px', right: '-5px' },
    'top-left': { top: '-5px', left: '-5px' },
    'bottom-right': { bottom: '-5px', right: '-5px' },
    'bottom-left': { bottom: '-5px', left: '-5px' }
  };
  
  return (
    <>
      {/* Inject pulse animation */}
      <style jsx>{`
        @keyframes notificationPulse {
          0% {
            box-shadow: 0 0 0 0 ${color}CC;
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 0 8px ${color}00;
            transform: scale(1.05);
          }
          100% {
            box-shadow: 0 0 0 0 ${color}00;
            transform: scale(1);
          }
        }
      `}</style>
      
      <div 
        style={{
          position: 'absolute',
          ...positionStyles[position],
          minWidth: showDot ? '12px' : '20px',
          height: showDot ? '12px' : '20px',
          borderRadius: '50%',
          backgroundColor: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          fontWeight: 'bold',
          color: '#fff',
          border: '2px solid rgba(0, 0, 0, 0.8)',
          animation: pulse ? 'notificationPulse 2s infinite' : 'none',
          zIndex: 10,
          pointerEvents: 'none'
        }}
      >
        {!showDot && count > 0 && (
          <span>{count > 99 ? '99+' : count}</span>
        )}
      </div>
    </>
  );
};

export default NotificationBadge;