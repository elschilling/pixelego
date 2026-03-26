/**
 * SwellSystem – CPU-side swell generator.
 *
 * Drives wave motion via combined Gerstner wave layers.
 * Each layer: { amplitude, wavelength, speed, steepness, dirX, dirZ }
 */
export class SwellSystem {
  constructor(options = {}) {
    this.waveHeight = options.waveHeight ?? 2.0
    this.wavePeriod = options.wavePeriod ?? 8.0
    this.waveDirection = { x: options.dirX ?? 0.0, z: options.dirZ ?? 1.0 }
    this.waveSpeed = options.waveSpeed ?? 2.2

    this.layers = this._generateLayers()
  }

  _generateLayers() {
    const a = this.waveHeight / 2
    const wl = this.waveSpeed * this.wavePeriod
    const d = this.waveDirection

    return [
      { amplitude: a, wavelength: wl, speed: this.waveSpeed, steepness: 0.5, dirX: d.x, dirZ: d.z },
      { amplitude: a * 0.5, wavelength: wl * 0.7, speed: this.waveSpeed * 1.1, steepness: 0.4, dirX: d.x * 0.9 + 0.1, dirZ: d.z * 0.9 + 0.1 },
      { amplitude: a * 0.25, wavelength: wl * 0.4, speed: this.waveSpeed * 0.9, steepness: 0.3, dirX: d.x * 0.8 - 0.15, dirZ: d.z * 0.8 + 0.15 },
    ]
  }

  /** Rebuild layers after changing swell parameters. */
  update() {
    this.layers = this._generateLayers()
  }

  /** Apply a named preset (beach | reef | point). */
  setPreset(type) {
    switch (type) {
      case 'beach':
        this.waveHeight = 1.5; this.wavePeriod = 7.0; this.waveSpeed = 1.0
        this.waveDirection = { x: 0.0, z: 1.0 }
        break
      case 'reef':
        this.waveHeight = 2.5; this.wavePeriod = 10.0; this.waveSpeed = 1.2
        this.waveDirection = { x: 0.0, z: 1.0 }
        break
      case 'point':
        this.waveHeight = 2.0; this.wavePeriod = 9.0; this.waveSpeed = 1.1
        this.waveDirection = { x: 0.3, z: 0.95 }
        break
    }
    this.update()
  }
}
