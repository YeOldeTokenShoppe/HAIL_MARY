/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    rules: {
      '*.vert': {
        loaders: ['raw-loader'],
        as: '*.js',
      },
      '*.frag': {
        loaders: ['raw-loader'],
        as: '*.js',
      },
      '*.glsl': {
        loaders: ['raw-loader'],
        as: '*.js',
      },
    },
  },
  webpack: (config, { isServer }) => {
    // Handle WASM files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });
    
    // Handle shader files (.vert, .frag, .glsl)
    config.module.rules.push({
      test: /\.(vert|frag|glsl)$/,
      type: 'asset/source',
    });
    
    // Resolve fallbacks for client-side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    
    // Add alias for Three.js BufferGeometryUtils compatibility
    config.resolve.alias = {
      ...config.resolve.alias,
      'three/examples/jsm/utils/BufferGeometryUtils.js': new URL('./patches/BufferGeometryUtils.js', import.meta.url).pathname,
    };
    
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*.wasm',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/wasm',
          },
        ],
      },
      {
        // Cache GLB models for 1 year (they're versioned by filename)
        source: '/models/:path*.glb',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache draco decoder files
        source: '/draco/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache fonts
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
