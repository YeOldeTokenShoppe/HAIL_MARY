'use client';

/**
 * PlasmaGlobe — R3F adaptation of "Interactive Plasma Globe" by kishimisu,
 * a fork of nimitz's "Plasma Globe" (https://www.shadertoy.com/view/XsjXRm).
 * License: CC BY-NC-SA 3.0 (per the original shader header).
 *
 * Drop-in: <PlasmaGlobe /> renders its own canvas and fills its parent.
 * Requires the noise texture at /images/iChannel0.png (already present).
 *
 * Props:
 *   numRays         number  filament count (default 12; ~25 looks best, costs more)
 *   volumetricSteps number  raymarch steps per ray (default 19)
 *   enableMouse     bool    mouse-driven filament (default true)
 *   dpr             number  device-pixel-ratio cap (default 1.5)
 *   className,style          forwarded to the wrapper div
 */

import { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

const TEXTURE_URL = '/images/iChannel0.png';

// ── Shader body: kishimisu / nimitz, kept verbatim. Only the entry point is
//    re-shimmed at the bottom from ShaderToy's mainImage() to a GLSL3 main().
const SHADER_BODY = /* glsl */ `
mat2 mm2(in float a){float c = cos(a), s = sin(a);return mat2(c,-s,s,c);}
float noise( in float x ){return textureLod(iChannel0, vec2(x*.01,1.),0.0).x;}

float hash( float n ){return fract(sin(n)*43758.5453);}

float noise(in vec3 p)
{
    vec3 ip = floor(p);
    vec3 fp = fract(p);
    fp = fp*fp*(3.0-2.0*fp);

    vec2 tap = (ip.xy+vec2(37.0,17.0)*ip.z) + fp.xy;
    vec2 rg = textureLod( iChannel0, (tap + 0.5)/iChannelResolution0, 0.0 ).yx;
    return mix(rg.x, rg.y, fp.z);
}

mat3 m3 = mat3( 0.00,  0.80,  0.60,
              -0.80,  0.36, -0.48,
              -0.60, -0.48,  0.64 );

float flow(in vec3 p, in float t)
{
    float z=2.;
    float rz = 0.;
    vec3 bp = p;
    for (float i= 1.;i < 5.;i++ )
    {
        p += time*.1;
        rz+= (sin(noise(p+t*0.8)*6.)*0.5+0.5) /z;
        p = mix(bp,p,0.6);
        z *= 2.;
        p *= 2.01;
        p*= m3;
    }
    return rz;
}

float sins(in float x)
{
     float rz = 0.;
    float z = 2.;
    for (float i= 0.;i < 3.;i++ )
    {
        rz += abs(fract(x*1.4)-0.5)/z;
        x *= 1.3;
        z *= 1.15;
        x -= time*.65*z;
    }
    return rz;
}

float segm( vec3 p, vec3 a, vec3 b)
{
    vec3 pa = p - a;
    vec3 ba = b - a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1. );
    return length( pa - ba*h )*.5;
}

vec3 path(in float i, in float d, vec3 hit)
{
    vec3 en = vec3(0.,0.,1.);
    float sns2 = sins(d+i*0.5)*0.22;
    float sns = sins(d+i*.6)*0.21;

    if (dot(hit,hit)>0.) {
        // mouse interaction
        hit.xz *= mm2(sns2*.5);
        hit.xy *= mm2(sns*.3);
        return hit;
    }

    en.xz *= mm2((hash(i*10.569)-.5)*6.2+sns2);
    en.xy *= mm2((hash(i*4.732)-.5)*6.2+sns);

    return en;
}

vec2 map(vec3 p, float i, vec3 hit)
{
    vec3 p0 = p;
    float lp = length(p);
    vec3 bg = vec3(0.);
    vec3 en = path(i,lp, hit);

    float ins = smoothstep(0.11,.46,lp);
    float outs = .15+smoothstep(.0,.15,abs(lp-1.));
    p *= ins*outs;
    float id = ins*outs;

    float rz = segm(p, bg, en)-0.011;

    return vec2(rz,id);
}

float march(in vec3 ro, in vec3 rd, in float startf, in float maxd, in float j, vec3 hit)
{
    float precis = 0.001;
    float h=0.5;
    float d = startf;
    for( int i=0; i<MAX_ITER; i++ )
    {
        if( abs(h)<precis||d>maxd ) break;
        d += h*1.2;
        float res = map(ro+rd*d, j, hit).x;
        h = res;
    }
    return d;
}

vec3 vmarch(in vec3 ro, in vec3 rd, in float j, in vec3 orig, vec3 hit)
{
    vec3 p = ro;
    vec2 r = vec2(0.);
    vec3 sum = vec3(0);
    float w = 0.;
    for( int i=0; i<VOLUMETRIC_STEPS; i++ )
    {
        r = map(p,j,hit);
        p += rd*.03;
        float lp = length(p);

        vec3 col = sin(vec3(1.05,2.5,1.52)*3.94+r.y)*.85+0.4;
        col.rgb *= smoothstep(.0,.015,-r.x);
        col *= smoothstep(0.04,.2,abs(lp-1.1));
        col *= smoothstep(0.1,.34,lp);
        sum += abs(col)*5. * (1.2-noise(lp*2.+j*13.+time*5.)*1.1) / (log(distance(p,orig)-2.)+.75);
    }
    return sum;
}

vec2 iSphere2(in vec3 ro, in vec3 rd)
{
    vec3 oc = ro;
    float b = dot(oc, rd);
    float c = dot(oc,oc) - 1.;
    float h = b*b - c;
    if(h <0.0) return vec2(-1.);
    else return vec2((-b - sqrt(h)), (-b + sqrt(h)));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 p = fragCoord.xy/iResolution.xy-0.5;
    p.x*=iResolution.x/iResolution.y;
    vec2 um = iMouse.xy / iResolution.xy-.5;
    um.x*=iResolution.x/iResolution.y;

    //camera
    vec3 ro = vec3(0.,0.,5.);
    vec3 rd = normalize(vec3(p*.7,-1.5));

    mat2 mx = mm2(time*.4);
    mat2 my = mm2(time*0.3);
    ro.xz *= mx;rd.xz *= mx;
    ro.xy *= my;rd.xy *= my;

    vec3 bro = ro;
    vec3 brd = rd;

    vec3 col = vec3(0.0125,0.,0.025);
    #if 1
    for (float j = 1.;j<NUM_RAYS+1.;j++)
    {
        ro = bro;
        rd = brd;
        mat2 mm = mm2((time*0.1+((j+1.)*5.1))*j*0.25);

        float rz = march(ro,rd,2.5,FAR,j, vec3(0.));
        if ( rz >= FAR)continue;
        vec3 pos = ro+rz*rd;
        col = max(col,vmarch(pos,rd,j, bro, vec3(0.)));
    }
    #endif

    #if ENABLE_MOUSE
    // Mouse interaction
    vec3 hit = vec3(0.);
    vec3 rdm = normalize(vec3(um*.7, -1.5));
    rdm.xz *= mx;
    rdm.xy *= my;

    if (iMouse.z > 0.) {
        vec2 res = iSphere2(bro, rdm);
        if (res.x > 0.) hit = bro + res.x * rdm;
    }

    if (dot(hit, hit) != 0.)
    {
        float j = NUM_RAYS+1.;
        ro = bro;
        rd = brd;
        mat2 mm = mm2((time*0.1+((j+1.)*5.1))*j*0.25);

        float rz = march(ro,rd,2.5,FAR,j, hit);
        if ( rz < FAR) {
            vec3 pos = ro+rz*rd;
            col = max(col,vmarch(pos,rd,j, bro, hit));
        }
    }
    #endif

    ro = bro;
    rd = brd;
    vec2 sph = iSphere2(ro,rd);

    if (sph.x > 0.)
    {
        vec3 pos = ro+rd*sph.x;
        vec3 pos2 = ro+rd*sph.y;
        vec3 rf = reflect( rd, pos );
        vec3 rf2 = reflect( rd, pos2 );
        float nz = (-log(abs(flow(rf*1.2,time)-.01)));
        float nz2 = (-log(abs(flow(rf2*1.2,-time)-.01)));
        col += (0.1*nz*nz* vec3(0.12,0.12,.5) + 0.05*nz2*nz2*vec3(0.55,0.2,.55))*0.8;
    }

    fragColor = vec4(col*1.3, 1.0);
}
`;

const VERT = /* glsl */ `
void main() {
  // fullscreen triangle/quad: bypass the camera entirely
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

function buildFragment({ numRays, volumetricSteps, enableMouse }) {
  // NUM_RAYS must be a GLSL float literal (e.g. "12.")
  const rays = Number(numRays).toFixed(1);
  return /* glsl */ `precision highp float;

uniform vec3      iResolution;
uniform float     iTime;
uniform vec4      iMouse;
uniform sampler2D iChannel0;
uniform vec2      iChannelResolution0;

out vec4 _fragOut;

#define ENABLE_MOUSE ${enableMouse ? 1 : 0}
#define NUM_RAYS ${rays}
#define VOLUMETRIC_STEPS ${volumetricSteps | 0}
#define MAX_ITER 35
#define FAR 6.
#define time iTime*1.1

${SHADER_BODY}

void main() {
  vec4 c;
  mainImage(c, gl_FragCoord.xy);
  _fragOut = c;
}
`;
}

function PlasmaPlane({ numRays, volumetricSteps, enableMouse }) {
  const { gl } = useThree();
  const matRef = useRef();
  const mouse = useRef({ x: 0, y: 0, down: false });

  const texture = useLoader(THREE.TextureLoader, TEXTURE_URL);

  // ShaderToy's iChannel0 default: repeat wrap, linear + mipmaps, raw data.
  useMemo(() => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.colorSpace = THREE.NoColorSpace;
    texture.needsUpdate = true;
  }, [texture]);

  const uniforms = useMemo(
    () => ({
      iResolution: { value: new THREE.Vector3(1, 1, 1) },
      iTime: { value: 0 },
      iMouse: { value: new THREE.Vector4(0, 0, 0, 0) },
      iChannel0: { value: texture },
      iChannelResolution0: {
        value: new THREE.Vector2(
          texture.image?.width || 256,
          texture.image?.height || 256
        ),
      },
    }),
    [texture]
  );

  const fragmentShader = useMemo(
    () => buildFragment({ numRays, volumetricSteps, enableMouse }),
    [numRays, volumetricSteps, enableMouse]
  );

  // Pointer tracking in normalized canvas coords (bottom-left origin, like ShaderToy).
  useEffect(() => {
    if (!enableMouse) return;
    const el = gl.domElement;

    const norm = (e) => {
      const r = el.getBoundingClientRect();
      mouse.current.x = (e.clientX - r.left) / r.width;
      mouse.current.y = 1 - (e.clientY - r.top) / r.height;
    };
    const onDown = (e) => { mouse.current.down = true; norm(e); };
    const onMove = (e) => { if (mouse.current.down) norm(e); };
    const onUp = () => { mouse.current.down = false; };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [gl, enableMouse]);

  const drawBuffer = useMemo(() => new THREE.Vector2(), []);
  useFrame((state) => {
    const m = matRef.current;
    if (!m) return;
    gl.getDrawingBufferSize(drawBuffer);
    m.uniforms.iResolution.value.set(drawBuffer.x, drawBuffer.y, 1);
    m.uniforms.iTime.value = state.clock.elapsedTime;
    m.uniforms.iMouse.value.set(
      mouse.current.x * drawBuffer.x,
      mouse.current.y * drawBuffer.y,
      mouse.current.down ? 1 : 0,
      0
    );
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        glslVersion={THREE.GLSL3}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

export default function PlasmaGlobe({
  numRays = 12,
  volumetricSteps = 19,
  enableMouse = true,
  dpr = 1.5,
  className,
  style,
}) {
  return (
    <div
      className={className}
      style={{ width: '100%', height: '100%', background: '#000', ...style }}
    >
      <Canvas
        flat
        linear
        dpr={[1, dpr]}
        gl={{ antialias: false, alpha: false }}
        camera={{ position: [0, 0, 1] }}
      >
        <PlasmaPlane
          numRays={numRays}
          volumetricSteps={volumetricSteps}
          enableMouse={enableMouse}
        />
      </Canvas>
    </div>
  );
}
