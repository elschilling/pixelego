import { Vector3 } from 'three'
import { loadHouse } from './components/house/house.js'
import { loadBirds } from './components/birds/birds.js'
import { createBirdCamera } from './components/birdCamera.js'
import { createOrthographicCamera } from './components/orthographicCamera.js'
import { createFirstPersonCamera } from './components/firstPersonCamera.js'
import { PerspectiveCamera } from 'three'
import { createBase } from './components/base.js'
import { createLights } from './components/lights.js'
import { createScene } from './components/scene.js'
import { createDirectionalLightHelper, createShadowCameraHelper, createAxesHelper } from './components/helpers.js'
import { createSunSphere } from './components/sunSphere.js'

import { createGUI, addOceanGUI } from './systems/gui.js'
import { createControls } from './systems/controls.js'
import { createRenderer } from './systems/renderer.js'
import { createPostProcessing } from './systems/PostProcessing.js'
import { OceanSystem } from './ocean/OceanSystem.js'
import { Resizer } from './systems/Resizer.js'
import { Loop } from './systems/Loop.js'
import { SunPath } from './systems/SunPath.js'
import { DynamicSky } from './systems/DynamicSky.js'
import { createPlayer } from './systems/player.js'
import { loadTiger } from './components/tiger.js'
import { createCharacterController } from './systems/characterController.js'
import { HouseVisibility } from './systems/HouseVisibility.js'
import { DoorInteraction } from './systems/DoorInteraction.js'
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
  radius: 60,
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
  },
  swim() {
    activeCamera = swimCamera
    loop.camera = swimCamera
    resizer.camera = swimCamera
    postProcessing.setCamera(swimCamera)
    controls.object = swimCamera
    resizer.onResize()
  }
}

let tl = gsap.timeline({ repeta: -1 })

let activeCamera, birdCamera, firstPersonCamera, orthographicCamera, swimCamera
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
    
    swimCamera = new PerspectiveCamera(40, 1, 0.1, 400)
    
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

    // sunLight lives inside sunPath.sunPathLight and casts shadows from there —
    // do NOT add it to the scene directly or Three.js will reparent it away from
    // sphereLight.children[], which DynamicSky.tick() depends on.
    scene.add(sky.sky, ambientLight, sunHelper, sunShadowHelper, sunPath.sunPathLight)

    this.gui = createGUI(params, ambientLight, sunLight, sunHelper, sunShadowHelper, sunPath, controls, skyControl, cameraControl, postProcessing)
    resizer = new Resizer(container, activeCamera, renderer, postProcessing)
  }

  async init() {
    // ── Ocean ───────────────────────────────────────────────────────
    const oceanSystem = new OceanSystem()
    scene.add(oceanSystem.mesh)
    loop.updatables.push(oceanSystem)
    this.oceanSystem = oceanSystem   // expose for GUI
    addOceanGUI(this.gui, oceanSystem)

    const { house, groundRegionBox, sandMesh, oceanMesh, spawnNode } = await loadHouse()
    
    let spawnPos = new Vector3(0, 0, 0)
    if (spawnNode) {
      house.updateMatrixWorld(true)
      spawnNode.getWorldPosition(spawnPos)
    }

    // Bind to the user's custom ocean mesh if one was modeled in the house GLB
    // We do this before rebaking so the bathymetry centers over the new mesh.
    if (oceanMesh) {
      oceanSystem.useCustomMesh(oceanMesh)
    }

    const birds = await loadBirds()
    for (var b = 0; b < birds.children.length; b++) {
      loop.updatables.push(birds.children[b])
    }
    scene.add(house, birds)

    // Bake the bathymetry depth map from the real sand mesh geometry
    if (sandMesh) {
      house.updateMatrixWorld(true)
      oceanSystem.rebakeBathymetry(sandMesh, renderer)
    } else {
      console.warn('World: no sand mesh found — using fallback deep-water depth')
    }

    tl.to(birds.position, { duration: 60, delay: 1, x: 100, z: 120 })

    // ── Exclude door from static Octree (handled by dynamic collider) ──
    let doorMesh = null
    let doorParent = null
    house.traverse(child => {
      if (child.name === 'portaEntrada') {
        doorMesh = child
        doorParent = child.parent
      }
    })
    if (doorMesh && doorParent) doorParent.remove(doorMesh)

    // Remove oceanMesh temporarily so the tiger walks on the sea floor, not the flat rigid water surface
    let oceanParent = null
    if (oceanMesh) {
      oceanParent = oceanMesh.parent
      if (oceanParent) oceanParent.remove(oceanMesh)
    }

    const player = createPlayer(firstPersonCamera, house)
    loop.updatables.push(player)

    // ── Tiger character ─────────────────────────────────────────────────
    const { tiger, mixer, idleAction, walkAction, runAction, swimAction } = await loadTiger()
    
    // Move tiger to the extracted spawn node location
    tiger.position.copy(spawnPos)
    
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
      tiger, idleAction, walkAction, runAction, swimAction, mixer, 
      () => activeCamera, cameraControl,
      house, joystick, spawnPos, sandMesh, oceanSystem
    )
    loop.updatables.push(characterController)

    // Re-attach elements excluded from the static Octree
    if (doorMesh && doorParent) doorParent.add(doorMesh)
    if (oceanMesh && oceanParent) oceanParent.add(oceanMesh)

    const houseVisibility = new HouseVisibility(house, tiger, groundRegionBox, orthographicCamera)
    loop.updatables.push(houseVisibility)

    const doorInteraction = new DoorInteraction(
      house, tiger,
      (box) => characterController.addCollider(box),
      (box) => characterController.removeCollider(box)
    )
    loop.updatables.push(doorInteraction)
  }

  start() {
    loop.start()
  }

  stop() {
    loop.stop()
  }
}

export { World }
