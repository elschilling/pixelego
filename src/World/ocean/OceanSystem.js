import { PlaneGeometry, Mesh, Vector4, Vector2, Vector3 } from 'three'
import { SwellSystem } from './SwellSystem.js'
import { BathymetrySystem } from './BathymetrySystem.js'
import { createOceanMaterial } from './OceanMaterial.js'

export class OceanSystem {
  constructor(options = {}) {
    const meshSize = options.meshSize ?? 200
    const segments = options.segments ?? 200

    this.swell      = new SwellSystem()
    this.bathymetry = new BathymetrySystem({ worldSize: meshSize })

    const { material, uniforms } = createOceanMaterial(this.bathymetry.texture)
    this.material = material
    this.uniforms = uniforms

    const geometry = new PlaneGeometry(meshSize, meshSize, segments, segments)
    geometry.rotateX(-Math.PI / 2)
    this.mesh = new Mesh(geometry, material)
    this.mesh.name = 'ocean'
    this.mesh.frustumCulled = false
    this.mesh.receiveShadow = true   // ocean receives shadows from objects above it

    this._elapsed = 0
    this._tmpVec3 = new Vector3()
    this._syncUniforms()
  }

  /** Binds to a user-modelled ocean mesh from a GLB, replacing the default plane. */
  useCustomMesh(customMesh) {
    if (!customMesh) return
    
    // Remove the default procedural PlaneGeometry from the scene
    if (this.mesh && this.mesh.parent) {
      this.mesh.parent.remove(this.mesh)
    }

    this.mesh = customMesh
    this.mesh.material = this.material
    this.mesh.receiveShadow = true
    console.log('OceanSystem: swapped to custom authored ocean mesh ✓')
  }

  /** Bake depth map from the sand mesh found in the house GLB. */
  rebakeBathymetry(sandMesh, renderer) {
    this.mesh.getWorldPosition(this._tmpVec3)
    this.bathymetry.rebake(
      sandMesh,
      renderer,
      this._tmpVec3.x,
      this._tmpVec3.y,
      this._tmpVec3.z
    )
    // DataTexture/WebGLRenderTarget is updated in-place; uniform already points to it
  }

  tick(delta) {
    this._elapsed += delta
    this.uniforms.uTime.value = this._elapsed
    
    // Track vertical movement dynamically whether it's root or nested:
    if (this.mesh) {
      this.mesh.getWorldPosition(this._tmpVec3)
      this.uniforms.uOceanY.value = this._tmpVec3.y
      this.uniforms.uOceanPos.value.copy(this._tmpVec3)
    }
  }

  setBreakType(type) {
    this.swell.setPreset(type)
    this._syncUniforms()
    // Note: bathymetry is now mesh-derived; break-type no longer changes the depth map
    // but still changes swell preset (wave shape/direction)
  }

  updateFromGUI() {
    this.swell.update()
    this._syncUniforms()
  }

  _syncUniforms() {
    const layers = this.swell.layers
    const u = this.uniforms

    u.uWave0.value.copy(new Vector4(layers[0].amplitude, layers[0].wavelength, layers[0].speed, layers[0].steepness))
    u.uWave1.value.copy(new Vector4(layers[1].amplitude, layers[1].wavelength, layers[1].speed, layers[1].steepness))
    u.uWave2.value.copy(new Vector4(layers[2].amplitude, layers[2].wavelength, layers[2].speed, layers[2].steepness))

    u.uDir0.value.copy(new Vector2(layers[0].dirX, layers[0].dirZ))
    u.uDir1.value.copy(new Vector2(layers[1].dirX, layers[1].dirZ))
    u.uDir2.value.copy(new Vector2(layers[2].dirX, layers[2].dirZ))

    u.uMaxWaveHeight.value = this.swell.waveHeight
    if (this.mesh) {
      this.mesh.getWorldPosition(this._tmpVec3)
      u.uOceanY.value = this._tmpVec3.y
      u.uOceanPos.value.copy(this._tmpVec3)
    }
    
    u.uBathymetrySize.value = this.bathymetry.worldSize
  }
}
