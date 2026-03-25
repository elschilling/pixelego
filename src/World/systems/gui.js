import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js'

function createGUI(params, ambientLight, sunLight, sunHelper, shadowCameraHelper, sunPath, controls, skyControl, cameraControl, postProcessing = null) {
  const gui = new GUI()
  gui.close()

  const skyFolder = gui.addFolder('Sky')
  skyFolder.add(skyControl, 'turbidity', 0.0, 20.0, 0.1)
  skyFolder.add(skyControl, 'rayleigh', 0.0, 4, 0.001)
  skyFolder.add(skyControl, 'mieCoefficient', 0.0, 0.1, 0.001)
  skyFolder.add(skyControl, 'mieDirectionalG', 0.0, 1, 0.001)
  skyFolder.add(skyControl, 'exposure', 0, 10, 0.001)
  skyFolder.close()

  const lightFolder = gui.addFolder('Light')
  lightFolder.add(sunLight, 'intensity').min(0).max(10).name('Sun Intensity')
  lightFolder.add(sunLight, 'castShadow').name('Sun shadows')
  lightFolder.add(sunLight.shadow, 'bias', -0.01, 0, 0.00001).name('Shadow bias')
  lightFolder.add(sunHelper, 'visible').name('Sun Helper')
  lightFolder.add(shadowCameraHelper, 'visible').name('Shadow Helper')
  lightFolder.add(ambientLight, 'intensity').min(0).max(10).name('Ambient Intensity')
  lightFolder.close()

  const locationFolder = gui.addFolder('Location')
  locationFolder.add(params, 'latitude').onChange(() => sunPath.updateLocation())
  locationFolder.add(params, 'longitude').onChange(() => sunPath.updateLocation())
  locationFolder.add(params, 'northOffset').onChange(() => sunPath.updateNorth())
  locationFolder.close()


  const cameraFolder = gui.addFolder('Camera')
  cameraFolder.add(controls, 'autoRotate')
  cameraFolder.add(cameraControl, 'firstPerson')
  cameraFolder.add(cameraControl, 'birdView')
  cameraFolder.add(cameraControl, 'orthographic').name('Orthographic')
  cameraFolder.close()

  const timeFolder = gui.addFolder('Time')
  timeFolder.add(params, 'minute', 0, 60, 1).onChange(() => sunPath.updateHour()).listen()
  timeFolder.add(params, 'hour', 0, 24, 1).onChange(() => sunPath.updateHour()).listen()
  timeFolder.add(params, 'day', 1, 30, 1).onChange(() => sunPath.updateMonth()).listen()
  timeFolder.add(params, 'month', 1, 12, 1).onChange(() => sunPath.updateMonth()).listen()
  timeFolder.add(params, 'animateTime')
  timeFolder.add(params, 'timeSpeed').min(0).max(10000).step(.1)
  timeFolder.close()

  const sunsurfaceFolder = gui.addFolder('Sun Surface')
  sunsurfaceFolder.add(params, 'showSunSurface').onChange(() => sunPath.updateLocation())
  sunsurfaceFolder.add(params, 'showAnalemmas').onChange(() => sunPath.updateLocation())
  sunsurfaceFolder.add(params, 'showSunDayPath').onChange(() => sunPath.updateLocation())
  sunsurfaceFolder.add(sunPath.sunPathLight.children[0].children[0], 'visible',).name('Sun Sphere')
  sunsurfaceFolder.add(sunPath.sunPathLight.children[1], 'visible',).name('Orientation')
  sunsurfaceFolder.close()

  // SSGI Controls
  // Pixelation Controls
  if (postProcessing && postProcessing.pixelPass) {
    const pixelFolder = gui.addFolder('Pixelation')
    const pixelPass = postProcessing.pixelPass

    const pixelParams = {
      pixelSize: pixelPass.pixelSize,
      normalEdgeStrength: pixelPass.normalEdgeStrength,
      depthEdgeStrength: pixelPass.depthEdgeStrength
    }

    pixelFolder.add(pixelParams, 'pixelSize').min(1).max(16).step(1).name('Pixel Size').onChange((value) => {
      pixelPass.setPixelSize(value)
    })
    pixelFolder.add(pixelParams, 'normalEdgeStrength').min(0).max(2).step(0.1).name('Normal Edge Strength').onChange((value) => {
      pixelPass.normalEdgeStrength = value
    })
    pixelFolder.add(pixelParams, 'depthEdgeStrength').min(0).max(2).step(0.1).name('Depth Edge Strength').onChange((value) => {
      pixelPass.depthEdgeStrength = value
    })
    pixelFolder.open()
  }

  // skyFolder.hide()
  // lightFolder.hide()
  // locationFolder.hide()

  return gui
}

/**
 * addOceanGUI – appends an Ocean folder to an existing lil-gui instance.
 * Call this after OceanSystem is instantiated (i.e., inside World.init()).
 */
function addOceanGUI(gui, oceanSystem) {
  const swell = oceanSystem.swell
  const u     = oceanSystem.uniforms

  // Proxy object so lil-gui can read/write the swell properties
  const proxy = {
    waveHeight:     swell.waveHeight,
    wavePeriod:     swell.wavePeriod,
    waveSpeed:      swell.waveSpeed,
    dirX:           swell.waveDirection.x,
    dirZ:           swell.waveDirection.z,
    surfBreakingK:  u.uSurfBreakingK.value,
    beachBreakingK: u.uBeachBreakingK.value,
    barrelIntensity:u.uBarrelIntensity.value,
    breakType:      'beach',
  }

  const folder = gui.addFolder('Ocean')

  folder.add(proxy, 'waveHeight', 0.1, 6, 0.05).name('Wave Height').onChange(v => {
    swell.waveHeight = v
    oceanSystem.updateFromGUI()
  })
  folder.add(proxy, 'wavePeriod', 2, 20, 0.1).name('Wave Period').onChange(v => {
    swell.wavePeriod = v
    oceanSystem.updateFromGUI()
  })
  folder.add(proxy, 'waveSpeed', 0.1, 3, 0.05).name('Wave Speed').onChange(v => {
    swell.waveSpeed = v
    oceanSystem.updateFromGUI()
  })
  folder.add(proxy, 'dirX', -1, 1, 0.01).name('Direction X').onChange(v => {
    swell.waveDirection.x = v
    oceanSystem.updateFromGUI()
  })
  folder.add(proxy, 'dirZ', -1, 1, 0.01).name('Direction Z').onChange(v => {
    swell.waveDirection.z = v
    oceanSystem.updateFromGUI()
  })
  folder.add(proxy, 'surfBreakingK', 0.5, 3, 0.05).name('Surf Break Depth').onChange(v => {
    u.uSurfBreakingK.value = v
  })
  folder.add(proxy, 'beachBreakingK', 0.1, 2, 0.05).name('Beach Break Depth').onChange(v => {
    u.uBeachBreakingK.value = v
  })
  folder.add(proxy, 'barrelIntensity', 0, 2, 0.05).name('Barrel Intensity').onChange(v => {
    u.uBarrelIntensity.value = v
  })
  folder.add(proxy, 'breakType', ['beach', 'reef', 'point']).name('Break Type').onChange(v => {
    oceanSystem.setBreakType(v)
    // Sync proxy so other sliders reflect preset values
    proxy.waveHeight = swell.waveHeight
    proxy.wavePeriod = swell.wavePeriod
    proxy.waveSpeed  = swell.waveSpeed
    proxy.dirX       = swell.waveDirection.x
    proxy.dirZ       = swell.waveDirection.z
    folder.controllers.forEach(c => c.updateDisplay())
  })
  
  folder.add(oceanSystem.mesh.position, 'y', -5, 8, 0.1).name('Ocean Height').onChange(() => {
    oceanSystem.updateFromGUI()
  })

  folder.open()
}

export { createGUI, addOceanGUI }