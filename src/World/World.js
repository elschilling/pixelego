import { loadHouse } from './components/house/house.js'
import { loadBirds } from './components/birds/birds.js'
import { createBirdCamera } from './components/birdCamera.js'
import { createOrthographicCamera } from './components/orthographicCamera.js'
import { createFirstPersonCamera } from './components/firstPersonCamera.js'
import { createBase } from './components/base.js'
import { createLights } from './components/lights.js'
import { createScene } from './components/scene.js'
import { createDirectionalLightHelper, createShadowCameraHelper, createAxesHelper } from './components/helpers.js'
import { createSunSphere } from './components/sunSphere.js'

import { createGUI } from './systems/gui.js'
import { createControls } from './systems/controls.js'
import { createRenderer } from './systems/renderer.js'
import { createPostProcessing } from './systems/PostProcessing.js'
import { Resizer } from './systems/Resizer.js'
import { Loop } from './systems/Loop.js'
import { SunPath } from './systems/SunPath.js'
import { DynamicSky } from './systems/DynamicSky.js'
import { createPlayer } from './systems/player.js'
import { loadTiger } from './components/tiger.js'
import { createCharacterController } from './systems/characterController.js'
import { HouseVisibility } from './systems/HouseVisibility.js'
import { Joystick } from './systems/Joystick.js'

import gsap from 'gsap'

const params = {
  animateTime: false,
  showSunSurface: false,
  showAnalemmas: false,
  showSunDayPath: false,
  minute: 0,
  hour: 17,
  day: new Date().getDate(),
  month: new Date().getMonth() + 1,
  latitude: -23.029396,
  longitude: -46.974293,
  northOffset: 303,
  radius: 18,
  baseY: 0,
  timeSpeed: 100,
  shadowBias: -0.00037
}

const skyControl = {
  turbidity: 10,
  rayleigh: 0.425,
  mieCoefficient: 0.012,
  mieDirectionalG: 1,
  exposure: 2.3
}

const cameraControl = {
  firstPerson() {
    activeCamera = firstPersonCamera
    loop.camera = firstPersonCamera
    resizer.camera = firstPersonCamera
    postProcessing.setCamera(firstPersonCamera)
    controls.object = firstPersonCamera
    resizer.onResize()
  },
  birdView() {
    activeCamera = birdCamera
    loop.camera = birdCamera
    resizer.camera = birdCamera
    postProcessing.setCamera(birdCamera)
    controls.object = birdCamera
    resizer.onResize()
  },
  orthographic() {
    activeCamera = orthographicCamera
    loop.camera = orthographicCamera
    resizer.camera = orthographicCamera
    postProcessing.setCamera(orthographicCamera)
    controls.object = orthographicCamera
    resizer.onResize()
  }
}

let tl = gsap.timeline({ repeta: -1 })

let activeCamera, birdCamera, firstPersonCamera, orthographicCamera
let renderer, postProcessing
let scene
let loop
let controls
let resizer

class World {
  constructor(container) {
    birdCamera = createBirdCamera()
    firstPersonCamera = createFirstPersonCamera()
    orthographicCamera = createOrthographicCamera()
    activeCamera = orthographicCamera

    scene = createScene()
    renderer = createRenderer()
    postProcessing = createPostProcessing(scene, activeCamera, renderer)
    loop = new Loop(activeCamera, scene, renderer, postProcessing.composer)
    container.append(renderer.domElement)
    controls = createControls(activeCamera, renderer.domElement)

    const { ambientLight, sunLight } = createLights()
    sunLight.shadow.camera.top = params.radius
    sunLight.shadow.camera.bottom = - params.radius
    sunLight.shadow.camera.left = - params.radius
    sunLight.shadow.camera.right = params.radius
    sunLight.shadow.bias = params.shadowBias

    const sunSphere = createSunSphere()

    const base = createBase(params)
    const sunPath = new SunPath(params, sunSphere, sunLight, base)
    // Hide default sun sphere elements
    sunPath.sphereLight.children[0].visible = false // Sun Sphere
    sunPath.sunPathLight.children[1].visible = false // Orientation / Base (check this)

    const sky = new DynamicSky(skyControl, sunPath.sphereLight, renderer)

    const sunHelper = createDirectionalLightHelper(sunLight)
    sunHelper.visible = false

    const sunShadowHelper = createShadowCameraHelper(sunLight)
    // const axesHelper = createAxesHelper(30)
    sunShadowHelper.visible = false

    loop.updatables.push(base, controls, sunPath, sky)

    scene.add(sky.sky, ambientLight, sunHelper, sunShadowHelper, sunPath.sunPathLight)

    this.gui = createGUI(params, ambientLight, sunLight, sunHelper, sunShadowHelper, sunPath, controls, skyControl, cameraControl, postProcessing)
    resizer = new Resizer(container, activeCamera, renderer, postProcessing)
  }

  async init() {
    const { house, groundRegionBox } = await loadHouse()
    const birds = await loadBirds()
    for (var b = 0; b < birds.children.length; b++) {
      loop.updatables.push(birds.children[b])
    }
    scene.add(house, birds)
    tl.to(birds.position, { duration: 60, delay: 1, x: 100, z: 120 })
    const player = createPlayer(firstPersonCamera, house)
    loop.updatables.push(player)

    // ── Tiger character ─────────────────────────────────────────────────
    const { tiger, mixer, idleAction, walkAction, runAction } = await loadTiger()
    scene.add(tiger)

    // Switch to orthographic 3rd-person camera and lock OrbitControls off
    activeCamera = orthographicCamera
    loop.camera = orthographicCamera
    resizer.camera = orthographicCamera
    postProcessing.setCamera(orthographicCamera)
    controls.object = orthographicCamera
    controls.enabled = false   // WASD drives the camera; orbit should not interfere
    resizer.onResize()

    // Initialize Joystick (Mobile Controls)
    const joystick = new Joystick()

    const characterController = createCharacterController(
      tiger, idleAction, walkAction, runAction, mixer, orthographicCamera, house, joystick
    )
    loop.updatables.push(characterController)

    const houseVisibility = new HouseVisibility(house, tiger, groundRegionBox)
    loop.updatables.push(houseVisibility)
  }

  start() {
    loop.start()
  }

  stop() {
    loop.stop()
  }
}

export { World }
