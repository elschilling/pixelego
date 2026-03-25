You are an expert in real-time graphics, ocean simulation, and Three.js (WebGPU + TSL).

Your task is to design and implement a **procedural surfable ocean system** for a game prototype called "SurfRider".

The system must be optimized for real-time performance (mobile-friendly) and structured in a modular way.

---

# 🎯 GOAL

Create a surfable ocean system based on:

SWELL
↓
BATHYMETRY (sea floor depth)
↓
BREAK GENERATION (wave breaking & surf zones)

The output should include:

1. Architecture explanation
2. Working Three.js code (WebGPU + TSL)
3. Shader logic (TSL)
4. CPU-side logic (wave spawning, propagation)
5. Clear separation of systems

---

# 🧠 SYSTEM DESIGN REQUIREMENTS

## 1. SWELL SYSTEM

Implement a swell generator with parameters:

* waveHeight
* wavePeriod
* waveDirection (vector2)
* waveSpeed

The swell must drive wave motion using a Gerstner-like model.

Mathematical base:

* Use sinusoidal / Gerstner wave approximation
* Support multiple wave layers (at least 3 combined waves)

---

## 2. BATHYMETRY SYSTEM

Create a sea floor representation that influences wave breaking.

Requirements:

* Represent bathymetry as:

  * either a texture (heightmap)
  * or procedural noise (perlin/simplex)

* Depth values:
  deep water → no breaking
  shallow water → wave steepens

* Provide a function:

  getDepth(x, z)

---

## 3. BREAK GENERATION SYSTEM

Implement wave breaking based on depth:

Rule:

if depth < waveHeight * k → wave breaks

Where k is configurable (~1.2–1.5)

---

The system must:

* Detect breaking zones dynamically
* Create a "breaking front" that propagates along the wave
* Support:

  * point break (angled propagation)
  * beach break (random peaks via noise)
  * reef break (fixed deterministic break)

---

## 4. WAVE PROPAGATION

Waves must travel across the mesh:

* Use time-based propagation
* Direction influenced by swell direction
* Break should propagate laterally along the wave

---

## 5. BARREL GENERATION (IMPORTANT)

Add optional barrel formation:

* Occurs when:

  * waveHeight high
  * slope high
  * depth drops sharply

In shader:

* deform crest forward and downward
* create cavity effect

---

## 6. THREE.JS IMPLEMENTATION

Use:

* Three.js with WebGPU renderer
* TSL (Three Shader Language) for shaders

Scene must include:

* Ocean mesh (plane geometry, subdivided)
* Custom shader material using TSL nodes

---

## 7. SHADER REQUIREMENTS (TSL)

Vertex shader must:

* Displace vertices using wave equations
* Combine multiple waves
* Apply steepness
* Add crest deformation (for breaking)

Fragment shader must:

* Add depth-based color gradient
* Add foam (based on wave height / crest)
* Optional Fresnel effect

---

## 8. PERFORMANCE CONSTRAINTS

* Must run at 60fps on mid-range devices
* Avoid FFT or heavy fluid simulation
* Use lightweight math only

---

## 9. OUTPUT FORMAT

Provide:

### A. Architecture overview

### B. Full Three.js setup code

### C. TSL shader code

### D. Wave system logic (JS classes)

### E. Explanation of how to tweak parameters

---

# ⚠️ IMPORTANT CONSTRAINTS

* Do NOT use heavy physics engines
* Do NOT use external ocean libraries
* Keep everything custom and explainable
* Prioritize clarity and modularity

---

# 💡 BONUS (if possible)

* Add debug visualization:

  * show breaking zones
  * show depth map
* Add ability to switch between:

  * beach break
  * reef break
  * point break

---

# 🎯 FINAL GOAL

The result should look like a stylized surfable wave system suitable for a mobile game prototype, not a hyper-realistic ocean simulation.

Focus on:

✔ gameplay usefulness
✔ controllability
✔ visual clarity
✔ performance

---

Now generate the full implementation.
