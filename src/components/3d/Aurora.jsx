'use client';

import { useEffect, useRef } from 'react';

export default function Aurora() {
  const canvasRef = useRef(null);

  useEffect(() => {

    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2');
    if (!gl) {
      console.error('WebGL 2 not supported');
      return () => {
        window.removeEventListener('resize', checkMobile);
      };
    }

    const vertexShaderSource = `#version 300 es
    in vec4 aPosition;
    void main() {
        gl_Position = aPosition;
    }`;

    const fragmentShaderSource = `#version 300 es
    precision highp float;

    uniform vec3 iResolution;
    uniform float iTime;
    uniform float isMobile;
    uniform float timeModulation;  // Precomputed sin(iTime * 0.05) * cos(iTime * 0.01)
    uniform float renderScale;     // Resolution scale factor
    uniform float maxAuroraLayers; // Configurable aurora layers
    out vec4 fragColor;

    #define u_time iTime
    #define u_resolution iResolution

    #define AURORA_SPEED 0.06
    #define AURORA_HUE_SPEED 0.043

    #define SKY_COLOR_TOP vec3(0.006, 0.026, 0.095)
    #define SKY_COLOR_BOTTOM vec3(0.007, 0.011, 0.035)

    #define STAR_THRESHOLD 0.707

    float random(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * .1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
    }

    vec3 noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);

        vec2 df = 20.0*f*f*(f*(f-2.0)+1.0);
        f = f*f*f*(f*(f*6.-15.)+10.);

        float a = random(i + vec2(0.5));
        float b = random(i + vec2(1.5, 0.5));
        float c = random(i + vec2(.5, 1.5));
        float d = random(i + vec2(1.5, 1.5));

        float k = a - b - c + d;
        float n = mix(mix(a, b, f.x), mix(c, d, f.x), f.y);

        return vec3(n, vec2(b - a + k * f.y, c - a + k * f.x) * df);
    }

    float fbmL(vec2 p) {
        vec2 df = vec2(0.0);
        float f = 0.0;
        float w = 0.5;
        mat2 terrainProps = mat2(0.8,-0.4, 0.5,0.8);

        for (int i = 0; i < 2; i++) {
            vec3 n = noise(p);
            df += n.yz;
            f += abs(w * n.x / (1.0 + dot(df, df)));
            w *= 0.5;
            p = 2. * terrainProps * p;
        }
        return f;
    }

    mat2 mm2(in float a) {
        float c = cos(a), s = sin(a);
        return mat2(c,s,-s,c);
    }

    float tri(in float x) {
        return clamp(abs(fract(x)-.5),0.01,0.49);
    }

    vec2 tri2(in vec2 p) {
        return vec2(tri(p.x)+tri(p.y),tri(p.y+tri(p.x)));
    }

    float fbmAurora(vec2 p, float spd) {
        float z = 1.8;
        float z2 = 2.5;
        float rz = 0.;
        p *= mm2(p.x * 0.06);
        vec2 bp = p;
        for (float i = 0.; i < 5.; i++ ) {
            vec2 dg = tri2(bp*1.85)*.75;
            dg *= mm2(u_time*spd);
            p -= dg/z2;

            bp *= 1.3;
            z2 *= .45;
            z *= .42;
            p *= 1.21 + (rz-1.0)*.02;
            
            rz += tri(p.x+tri(p.y))*z;
            p *= timeModulation;  // Use precomputed value
        }
        return clamp(1. / pow(rz * 20., 1.3), 0.,1.);
    }

    vec4 aurora(vec3 rd) {
        vec4 col = vec4(0);
        vec4 avgCol = vec4(0);    
        
        // Hoist random calculation outside the loop
        float randOffset = 0.006 * random(gl_FragCoord.xy);
        
        for (float i=0.; i < 50.; i++) {
            if (i >= maxAuroraLayers) break;  // Use configurable layer count
            float of = randOffset * smoothstep(0.,15., i);
            // Adjust the divisor based on mobile - smaller divisor = aurora extends further
            float yDivisor = isMobile > 0.5 ? (rd.y * 1.0 + 0.2) : (rd.y * 2. + 0.4);
            float pt = ((.8+pow(i,1.4)*.002)) / yDivisor;
            pt -= of;
            // Lower altitude on mobile for better visibility
            float altitude = isMobile > 0.5 ? 3.5 : 5.5;
            vec3 bpos = altitude + pt * rd;
            vec2 p = bpos.zx;
            float rzt = fbmAurora(p, AURORA_SPEED);
            vec4 col2 = vec4(0,0,0, rzt);
            float hue = fract(i * AURORA_HUE_SPEED + u_time * 0.1);
            vec3 rainbow = 0.5 + 0.5 * cos(6.28318 * (hue + vec3(0.0, 0.33, 0.67)));
            col2.rgb = rainbow * rzt;
            avgCol = mix(avgCol, col2, .5);
            col += avgCol * exp2(-i*0.065 - 2.5) * smoothstep(0., 5., i);
        }
        // Different horizon for mobile vs desktop
        if (isMobile > 0.5) {
            // On mobile, extend aurora all the way down
            col *= (clamp(rd.y * 5. - 0.5, 0., 1.)); // Very soft fade, extends below horizon
        } else {
            // On desktop, normal horizon
            col *= (clamp(rd.y * 15. + 0.2, 0., 1.));
        }
        return smoothstep(0.,1.1,pow(col,vec4(1.))*1.5);
    }

    vec3 stars(vec2 p) {
        float r = fbmL(p * 20.);
        float isStar = step(STAR_THRESHOLD, r);
        return vec3(r) * isStar;
    }

    void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        vec2 p = (-u_resolution.xy + 2.0 * gl_FragCoord.xy) / u_resolution.y;

        // Debug: tint the background slightly red on mobile to verify uniform is working
        vec3 skyTop = isMobile > 0.5 ? vec3(0.02, 0.026, 0.095) : SKY_COLOR_TOP;
        vec3 color = mix(skyTop, SKY_COLOR_BOTTOM, uv.y);
        
        vec3 rd = normalize(vec3(p.xy, 1.0));
        
        color += stars(rd.xz / rd.y);
        color += aurora(rd).rgb;

        color = pow(color, vec3(1. / 2.2));
        color = smoothstep(0., 1., color);

        fragColor = vec4(color, 1.0);
    }
    `;

    function createShader(gl, type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    function createProgram(gl, vertexShader, fragmentShader) {
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
      }
      return program;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createProgram(gl, vertexShader, fragmentShader);

    if (!program) return;

    const positionAttributeLocation = gl.getAttribLocation(program, 'aPosition');
    const resolutionUniformLocation = gl.getUniformLocation(program, 'iResolution');
    const timeUniformLocation = gl.getUniformLocation(program, 'iTime');
    const mobileUniformLocation = gl.getUniformLocation(program, 'isMobile');
    const timeModulationLocation = gl.getUniformLocation(program, 'timeModulation');
    const renderScaleLocation = gl.getUniformLocation(program, 'renderScale');
    const maxAuroraLayersLocation = gl.getUniformLocation(program, 'maxAuroraLayers');

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    gl.useProgram(program);

    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    function resizeCanvas() {
      // Apply resolution scaling based on device
      const isMobile = window.innerWidth <= 768;
      const scale = isMobile ? 0.75 : 1.0;  // 75% resolution on mobile
      
      canvas.width = canvas.offsetWidth * scale;
      canvas.height = canvas.offsetHeight * scale;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let animationId;
    function render(time) {
      const normalizedTime = time * 0.001;
      const isMobile = window.innerWidth <= 768;
      
      // Precompute time-based calculations
      const timeModulation = Math.sin(normalizedTime * 0.05) * Math.cos(normalizedTime * 0.01);
      
      // Configure performance settings
      const renderScale = isMobile ? 0.75 : 1.0;
      const maxLayers = isMobile ? 25.0 : 50.0;
      
      gl.uniform3f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height, 1.0);
      gl.uniform1f(timeUniformLocation, normalizedTime);
      gl.uniform1f(mobileUniformLocation, isMobile ? 1.0 : 0.0);
      gl.uniform1f(timeModulationLocation, timeModulation);
      gl.uniform1f(renderScaleLocation, renderScale);
      gl.uniform1f(maxAuroraLayersLocation, maxLayers);
      
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animationId = requestAnimationFrame(render);
    }

    animationId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full"
      style={{ width: '100%', height: '100%' }}
    />
  );
}