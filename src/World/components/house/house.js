import { Box3, Vector3 } from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { setupModel } from './setupModel'

async function loadHouse() {
  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
  const gltfLoader = new GLTFLoader()
  gltfLoader.setDRACOLoader(dracoLoader)
  const houseData = await gltfLoader.loadAsync('/assets/models/House-c.glb')
  const house = setupModel(houseData)

  let groundRegion = null

  // 1. Traverse to find GroundRegion and setup shadows
  house.traverse(n => {
    if (n.name === 'GroundRegion') {
      groundRegion = n
    }
    if (n.isMesh) {
      if (n.material.name === 'esquadria.vidro') {
        n.castShadow = false
      } else {
        n.castShadow = true
        n.receiveShadow = true
      }
    }
  })

  // 2. Center the house
  const box = new Box3().setFromObject(house)
  const center = box.getCenter(new Vector3())
  house.position.x += (house.position.x - center.x)
  house.position.z += (house.position.z - center.z)
  // house.position.y = 2.2

  // 3. Capture GroundRegion World Box and Detach
  let groundRegionBox = null
  if (groundRegion) {
    house.updateMatrixWorld(true) // Ensure transforms are applied
    groundRegionBox = new Box3().setFromObject(groundRegion)
    if (groundRegion.parent) {
      groundRegion.parent.remove(groundRegion)
    }
  }

  return { house, groundRegionBox }
}

export { loadHouse }