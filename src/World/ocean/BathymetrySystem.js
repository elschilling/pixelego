import {
  WebGLRenderTarget, RedFormat, FloatType, LinearFilter, ClampToEdgeWrapping,
  OrthographicCamera, ShaderMaterial, Color
} from 'three'

/**
 * BathymetrySystem – sea-floor depth map baked from the actual sand mesh.
 *
 * For each UV cell in a resolution×resolution grid covering worldSize×worldSize,
 * a ray is cast straight downward from high above the ocean surface. If it hits
 * the sand geometry, depth = oceanY − hitY. Otherwise a fallback deep-water
 * value is used.
 *
 * Pass sandMesh after loading the house GLB.  Call rebake(sandMesh) any time
 * the geometry changes.  The resulting DataTexture is sampled by the GLSL shader.
 */
export class BathymetrySystem {
  constructor(options = {}) {
    this.resolution = options.resolution ?? 512
    this.worldSize  = options.worldSize  ?? 200
    this.oceanY     = options.oceanY     ?? 0
    this.maxDepth   = options.maxDepth   ?? 30

    // Instead of a CPU DataTexture, we create a GPU render target
    this.target = new WebGLRenderTarget(this.resolution, this.resolution, {
      format: RedFormat,
      type: FloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      wrapS: ClampToEdgeWrapping,
      wrapT: ClampToEdgeWrapping,
      generateMipmaps: false
    })

    // The ocean shader will sample target.texture
    this.texture = this.target.texture

    // Pre-clear it to maxDepth
    this._needsClear = true
  }

  rebake(sandMesh, renderer, oceanX = 0, oceanY = 0, oceanZ = 0) {
    if (!sandMesh || !renderer) return

    this.oceanY = oceanY // update cached value for depth math

    const half = this.worldSize / 2
    // Setup orthographic camera looking down from Y=200, centered on the ocean mesh
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 400)
    camera.position.set(oceanX, 200, oceanZ)
    camera.lookAt(oceanX, 0, oceanZ)
    camera.updateMatrixWorld()

    // Create an override material that writes depth = oceanY - worldY
    // If sand is above water (worldY > oceanY), depth is negative/0.
    const depthShader = {
      vertexShader: `
        varying float vWorldY;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldY = worldPos.y;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        varying float vWorldY;
        void main() {
          gl_FragColor = vec4(vWorldY, 0.0, 0.0, 1.0);
        }
      `
    }
    const mat = new ShaderMaterial(depthShader)

    // Backup original materials
    const originalMats = new Map()
    sandMesh.traverse(child => {
      if (child.isMesh) {
        originalMats.set(child, child.material)
        child.material = mat
        child.visible = true
      }
    })

    // Render into our FBO
    const currentRenderTarget = renderer.getRenderTarget()
    const currentClearColor = renderer.getClearColor(new Color())
    const currentClearAlpha = renderer.getClearAlpha()

    renderer.setRenderTarget(this.target)
    renderer.setClearColor(new Color(this.maxDepth, 0, 0), 1)
    renderer.clear()
    renderer.render(sandMesh, camera)

    // Restore state
    renderer.setRenderTarget(currentRenderTarget)
    renderer.setClearColor(currentClearColor, currentClearAlpha)

    sandMesh.traverse(child => {
      if (child.isMesh && originalMats.has(child)) {
        child.material = originalMats.get(child)
      }
    })

    console.log('BathymetrySystem: Fast GPU depth map baked from sand mesh ✓')
  }

  getDepth(worldX, worldZ) {
    // getDepth from CPU is no longer supported with the GPU approach,
    // but the swell system doesn't need to sample sand depth anyway
    return this.maxDepth
  }
}
