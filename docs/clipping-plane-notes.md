# Clipping Plane Parenting for Portal Effect

## Problem

The `FloatingGroup` animates position.y and rotation.y, but THREE.js clipping planes are in world space. This causes the clipping edge to "ebb and flow" as the model moves relative to the static plane.

## Solution: Dynamic Plane Updates

Update the clipping planes each frame to follow the screen mesh's world transform.

### 1. Add ref to screen mesh in LaptopFrame

```jsx
function LaptopFrame({ screenRef, ...props }) {
  return (
    <mesh ref={screenRef} position={[0, 0.65, -0.15]} rotation={[-0.35, 0, 0]}>
      <planeGeometry args={[1.45, 1.0]} />
      <MeshPortalMaterial>...</MeshPortalMaterial>
    </mesh>
  );
}
```

### 2. Create DynamicClipUpdater component

```jsx
function DynamicClipUpdater({ screenRef }) {
  const localPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));
  const _tempPlane = useRef(new THREE.Plane());

  useFrame(() => {
    if (!screenRef?.current) return;

    const screen = screenRef.current;
    screen.updateMatrixWorld();

    // Transform local-space plane to world-space using screen's matrix
    _tempPlane.current.copy(localPlane.current);
    _tempPlane.current.applyMatrix4(screen.matrixWorld);

    // Update the clipping plane
    screenPlane.normal.copy(_tempPlane.current.normal);
    screenPlane.constant = _tempPlane.current.constant + FRONT_OFFSET;
  });

  return null;
}
```

### 3. Wire it up in PortalScene

```jsx
function PortalScene() {
  const screenRef = useRef();

  return (
    <FloatingGroup>
      <group rotation={sceneRotation}>
        <LaptopFrame screenRef={screenRef} />
        <DynamicClipUpdater screenRef={screenRef} />
      </group>
    </FloatingGroup>
  );
}
```

## Key Technique

`THREE.Plane.applyMatrix4(matrix)` transforms a plane from local space to world space. By defining the plane as `(0,0,1), 0` in local space (the screen's front face), then applying the screen mesh's `matrixWorld`, we get the exact world-space plane matching the screen surface.

## Status

This eliminated the ebb/flow but introduced a diagonal cut artifact. The plane angle wasn't matching the model orientation correctly. Needs further debugging of the normal calculation.
