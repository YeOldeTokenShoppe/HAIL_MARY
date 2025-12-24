// Patch for Three.js compatibility
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Create alias for backward compatibility
if (!BufferGeometryUtils.mergeBufferGeometries && BufferGeometryUtils.mergeGeometries) {
  BufferGeometryUtils.mergeBufferGeometries = BufferGeometryUtils.mergeGeometries;
}

export default BufferGeometryUtils;