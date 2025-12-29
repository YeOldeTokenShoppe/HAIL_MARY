import React from 'react';

// Available poses - should match SimpleTattooViewer
const AVAILABLE_POSES = [
  { id: 'tpose', name: 'T-Pose', animationName: null, icon: '🧍' },
  { id: 'run', name: 'Running', animationName: 'Run_Pose', icon: '🏃' },
  // Add more poses here as you export them:
  // { id: 'idle', name: 'Idle', animationName: 'Idle_Pose', icon: '🧘' },
  // { id: 'wave', name: 'Wave', animationName: 'Wave_Pose', icon: '👋' },
  // { id: 'victory', name: 'Victory', animationName: 'Victory_Pose', icon: '✌️' },
];

function PoseSelector({ selectedPose = 'tpose', onPoseChange }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      padding: '15px',
      background: 'rgba(0, 0, 0, 0.5)',
      borderRadius: '12px',
      border: '1px solid rgba(255, 215, 0, 0.3)',
    }}>
      <div style={{
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#ffd700',
        marginBottom: '5px',
        textAlign: 'center',
      }}>
        Character Pose
      </div>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
        gap: '8px',
      }}>
        {AVAILABLE_POSES.map((pose) => (
          <button
            key={pose.id}
            onClick={() => onPoseChange(pose.id)}
            style={{
              padding: '10px',
              background: selectedPose === pose.id
                ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 215, 0, 0.2))'
                : 'rgba(0, 0, 0, 0.3)',
              border: selectedPose === pose.id
                ? '2px solid #ffd700'
                : '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: selectedPose === pose.id ? '#ffd700' : '#fff',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '5px',
            }}
            onMouseEnter={(e) => {
              if (selectedPose !== pose.id) {
                e.currentTarget.style.background = 'rgba(255, 215, 0, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedPose !== pose.id) {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }
            }}
          >
            <div style={{ fontSize: '24px' }}>{pose.icon}</div>
            <div style={{ fontSize: '12px' }}>{pose.name}</div>
          </button>
        ))}
      </div>
      
      <div style={{
        fontSize: '11px',
        color: 'rgba(255, 255, 255, 0.6)',
        textAlign: 'center',
        marginTop: '5px',
      }}>
        Choose how your character will be posed
      </div>
    </div>
  );
}

export default PoseSelector;
export { AVAILABLE_POSES };