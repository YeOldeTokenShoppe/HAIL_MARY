import { useRef, useEffect } from 'react';

export const useTouchControls = () => {
  const touchState = useRef({
    movement: { x: 0, z: 0 },
    jump: false,
    light: false,
    sprint: false,
    zoom: false,
    lookUp: false,
    joystickActive: false
  });

  // Create a virtual keyboard controls getter that includes touch input
  const getTouchControls = () => {
    // Block ALL movement when light action is active
    const isLightActive = touchState.current.light;
    
    const controls = {
      forward: !isLightActive && touchState.current.movement.z > 0.3,
      backward: !isLightActive && touchState.current.movement.z < -0.3,
      left: !isLightActive && touchState.current.movement.x > 0.3,
      right: !isLightActive && touchState.current.movement.x < -0.3,
      jump: touchState.current.jump,
      light: touchState.current.light,
      run: !isLightActive && touchState.current.sprint,
      zoom: touchState.current.zoom,
      lookUp: touchState.current.lookUp
    };
    
    // Debug removed to reduce spam
    
    return controls;
  };

  // Handle touch actions
  const handleTouchAction = (action, value) => {
    console.log("Touch action received:", action, value);
    switch (action) {
      case 'movement':
        touchState.current.movement = value;
        break;
      case 'joystickActive':
        touchState.current.joystickActive = value;
        break;
      case 'jump':
        touchState.current.jump = value;
        break;
      case 'light':
        touchState.current.light = value;
        break;
      case 'lightJump':
        // Combo action - light candles while jumping
        touchState.current.jump = true;
        touchState.current.light = true;
        
        // Auto-release after a short duration
        setTimeout(() => {
          touchState.current.jump = false;
          touchState.current.light = false;
        }, 100);
        break;
      case 'sprint':
        touchState.current.sprint = value;
        break;
      case 'zoom':
        touchState.current.zoom = value;
        break;
      case 'lookUp':
        touchState.current.lookUp = value;
        break;
    }
  };

  // Get movement values for analog control (for mouse dragging)
  const getMovementVector = () => {
    // Block movement vector when light is active
    if (touchState.current.light) {
      return { x: 0, z: 0 };
    }
    return touchState.current.movement;
  };

  // Check if joystick is actively being used
  const isJoystickActive = () => {
    return touchState.current.joystickActive;
  };

  return {
    getTouchControls,
    handleTouchAction,
    getMovementVector,
    isJoystickActive,
    touchState: touchState.current
  };
};