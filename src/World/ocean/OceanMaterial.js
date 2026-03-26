import { ShaderMaterial, DoubleSide, Vector2, Vector3, Vector4, UniformsUtils, UniformsLib } from 'three'

/* ── GLSL Vertex Shader ──────────────────────────────────────────────────── */
const vertexShader = /* glsl */`
  #include <common>
  #include <shadowmap_pars_vertex>

  uniform float uTime;
  uniform vec4  uWave0;
  uniform vec4  uWave1;
  uniform vec4  uWave2;
  uniform vec2  uDir0;
  uniform vec2  uDir1;
  uniform vec2  uDir2;
  uniform float uBeachBreakingK;
  uniform float uSurfBreakingK;
  uniform float uMaxWaveHeight;
  uniform float uBarrelIntensity;
  uniform float uOceanY;
  uniform vec3  uOceanPos;
  uniform float uBathymetrySize;
  uniform sampler2D uBathymetry;

  varying float vFoam;
  varying vec3  vNormal;
  varying vec2  vUv;
  varying vec2  vBathyUv;

  vec3 gerstner(vec2 xz, vec4 wp, vec2 wd,
                out float nx, out float ny, out float nz) {
    float amp   = wp.x;
    float wl    = wp.y;
    float spd   = wp.z;
    float steep = wp.w;
    vec2  d     = normalize(wd);
    float k     = 6.28318 / wl;
    float phase = k * dot(d, xz) - spd * k * uTime;
    float c     = cos(phase);
    float s     = sin(phase);
    nx = -d.x * k * amp * c;
    ny =  steep * k * amp * s; // Normal derivative
    nz = -d.y * k * amp * c;
    // Shift Y up by 'amp' so the lowest trough perfectly touches the mesh plane (0.0)
    // instead of dipping below it with '-amp'.
    return vec3(steep * amp * d.x * c, amp * (s + 1.0), steep * amp * d.y * c);
  }

  void main() {
    vUv = uv;
    vec2 xz = vec2(position.x, position.z);

    vec4 restWorldPos = modelMatrix * vec4(position, 1.0);
    vBathyUv = vec2(
        (restWorldPos.x - uOceanPos.x + uBathymetrySize * 0.5) / uBathymetrySize,
        1.0 - (restWorldPos.z - uOceanPos.z + uBathymetrySize * 0.5) / uBathymetrySize
    );

    float sandY = texture2D(uBathymetry, vBathyUv).r;
    float depth = max(0.05, uOceanY - sandY);

    float nx0, ny0, nz0, nx1, ny1, nz1, nx2, ny2, nz2;
    vec3 d0 = gerstner(xz, uWave0, uDir0, nx0, ny0, nz0);
    vec3 d1 = gerstner(xz, uWave1, uDir1, nx1, ny1, nz1);
    vec3 d2 = gerstner(xz, uWave2, uDir2, nx2, ny2, nz2);
    vec3 disp = d0 + d1 + d2;

    float t        = clamp((depth - 2.0) / 13.0, 0.0, 1.0);
    float steepMul = mix(1.8, 1.0, t);
    float adjDispY = disp.y * steepMul;

    // 1. Surf Zone: deep breaking for large dominant wave (d0)
    float surfDepth = uSurfBreakingK * (uWave0.x * 2.0); // wave0 height dictates surf depth
    float surfBreakFactor = 1.0 - smoothstep(surfDepth * 0.3, surfDepth, depth);
    float surfCrest       = clamp((d0.y * steepMul) / (uWave0.x * 2.0 + 0.01), 0.0, 1.0);

    // 2. Beach Region: shallow breaking for smaller trailing waves (d1 + d2)
    float beachDepth = uBeachBreakingK * (uWave1.x + uWave2.x) * 3.0; // breaks closer to sand
    float beachBreakFactor = 1.0 - smoothstep(0.0, beachDepth, depth);
    float beachCrest       = clamp(((d1.y + d2.y) * steepMul) / ((uWave1.x + uWave2.x) * 2.0 + 0.01), 0.0, 1.0);

    // Combine barrel deformation and foam based on region
    float combinedBreak = (surfBreakFactor * surfCrest) + (beachBreakFactor * beachCrest) * 1.5;
    
    // Scale barrel intensity relative to the breaking wave
    float barrelFwd  = combinedBreak * uBarrelIntensity * 2.0;
    float barrelDown = combinedBreak * uBarrelIntensity * -0.5;

    // Defend against the barrel hook dipping under the rest-state mesh floor
    float finalY = max(0.0, adjDispY + barrelDown);

    vec3 displaced = vec3(
      position.x + disp.x,
      position.y + finalY,
      position.z + disp.z + barrelFwd
    );

    vFoam = clamp(combinedBreak * 2.0, 0.0, 1.0);

    float NX = nx0 + nx1 + nx2;
    float NY = 1.0 - (ny0 + ny1 + ny2);
    float NZ = nz0 + nz1 + nz2;
    vec3 transformedNormal = normalize(normalMatrix * normalize(vec3(NX, NY, NZ)));
    vNormal = transformedNormal; // pass to fragment shader

    vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
    vec4 mvPos         = viewMatrix * worldPosition;
    gl_Position        = projectionMatrix * mvPos;

    // Shadow map UVs for all shadow-casting lights
    #include <shadowmap_vertex>
  }
`

/* ── GLSL Fragment Shader ────────────────────────────────────────────────── */
const fragmentShader = /* glsl */`
  #include <common>
  #include <packing>
  #include <lights_pars_begin>
  #include <shadowmap_pars_fragment>
  #include <shadowmask_pars_fragment>

  uniform float uOceanY;
  uniform sampler2D uBathymetry;
  uniform float uTime;

  varying float vFoam;
  varying vec3  vNormal;
  varying vec2  vUv;
  varying vec2  vBathyUv;

  void main() {
    float sandY = texture2D(uBathymetry, vBathyUv).r;
    float depth = max(0.05, uOceanY - sandY);

    float t        = clamp((depth - 2.0) / 13.0, 0.0, 1.0);
    vec3 shallowCol = vec3(0.0,  0.55, 0.65);
    vec3 deepCol    = vec3(0.01, 0.06, 0.25);
    vec3 waterCol   = mix(shallowCol, deepCol, t);

    // Diffuse shading
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
    float diff    = max(dot(vNormal, lightDir), 0.0) * 0.6 + 0.4;
    waterCol *= diff;

    // Shadow map: getShadowMask() from #include <shadowmask_pars_fragment>
    float shadow = getShadowMask();
    waterCol *= mix(0.5, 1.0, shadow);   // darken shadowed areas by 50%

    // Foam overlay (breaking waves + shoreline interaction)
    float move = uTime * 2.0;
    float noise = sin(vUv.x * 400.0 + move) * sin(vUv.y * 400.0 - move);
    float shoreFoam = 1.0 - smoothstep(0.0, 1.2 + noise * 0.3, depth);
    float finalFoam = clamp(vFoam + shoreFoam * 0.8, 0.0, 1.0);

    vec3 foamCol  = vec3(0.95, 0.98, 1.0);
    vec3 finalCol = mix(waterCol, foamCol, finalFoam);

    // Fresnel rim
    float fresnel = pow(1.0 - max(dot(vNormal, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);
    finalCol = mix(finalCol, vec3(0.7, 0.9, 1.0), fresnel * 0.3);

    gl_FragColor = vec4(finalCol, mix(0.82, 1.0, finalFoam));
  }
`

export function createOceanMaterial(bathymetryTexture) {
  const customUniforms = {
    uTime: { value: 0 },
    uWave0: { value: new Vector4(1.0, 8.0, 1.0, 0.5) },
    uWave1: { value: new Vector4(0.5, 5.6, 1.1, 0.4) },
    uWave2: { value: new Vector4(0.25, 3.2, 0.9, 0.3) },
    uDir0: { value: new Vector2(0.0, 1.0) },
    uDir1: { value: new Vector2(0.1, 0.95) },
    uDir2: { value: new Vector2(-0.15, 0.85) },
    uSurfBreakingK: { value: 1.5 },
    uBeachBreakingK: { value: 0.5 },
    uMaxWaveHeight: { value: 1.65 },
    uBarrelIntensity: { value: 1.0 },
    uOceanY: { value: 0 },
    uOceanPos: { value: new Vector3() },
    uBathymetrySize: { value: 200.0 },
    // Omit uBathymetry from the initial merge to avoid cloning a render target texture!
  }

  const uniforms = UniformsUtils.merge([
    UniformsLib.lights,
    customUniforms
  ])

  // Manually attach the texture unassigned during the merge:
  uniforms.uBathymetry = { value: bathymetryTexture }

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    side: DoubleSide,
    lights: true,   // inject Three.js light uniforms (needed for shadowmap_pars)
  })

  return { material, uniforms }
}
