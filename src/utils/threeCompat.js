// Global Three.js compatibility patch
if (typeof window !== 'undefined') {
  import('three/examples/jsm/utils/BufferGeometryUtils.js').then((BufferGeometryUtils) => {
    if (!BufferGeometryUtils.mergeBufferGeometries && BufferGeometryUtils.mergeGeometries) {
      BufferGeometryUtils.mergeBufferGeometries = BufferGeometryUtils.mergeGeometries;
    }
  });
}