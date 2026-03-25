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
  let sandMesh     = null   // sea floor mesh for bathymetry raycasting
  let oceanMesh    = null   // user authored ocean mesh
  let spawnNode    = null   // respawn empty location

  // 1. Traverse to find GroundRegion, sand mesh, and setup shadows
  house.traverse(n => {
    if (n.name === 'GroundRegion') {
      groundRegion = n
    }
    
    if (n.name === 'spawn') {
      spawnNode = n
      console.log('House: found spawn point')
    }

    if (n.isMesh) {
      const nameLower = n.name.toLowerCase()
      const matName   = (n.material?.name || '').toLowerCase()

      // Detect the sand / beach mesh by name or material name
      const isSand = ['sand', 'praia', 'beach', 'areia', 'sea', 'floor']
        .some(token => nameLower.includes(token) || matName.includes(token))

      if (isSand) {
        sandMesh = n
        console.log('BathymetrySystem: found sand mesh →', n.name)
      }

      const isOcean = ['ocean', 'water', 'oceano', 'agua']
        .some(token => nameLower.includes(token) || matName.includes(token))
      
      if (isOcean) {
        oceanMesh = n
        console.log('OceanSystem: found ocean mesh →', n.name)
      }

      const isGlass = matName.includes('vidro') || matName.includes('glass')

      if (isGlass) {
        n.castShadow = false
        n.material.transparent = true
        n.material.opacity = 0.5
      } else {
        n.castShadow    = true
        n.receiveShadow = true
      }
    }
  })

  // 2. Center the house
  const box = new Box3().setFromObject(house)
  const center = box.getCenter(new Vector3())
  house.position.x += (house.position.x - center.x)
  house.position.z += (house.position.z - center.z)

  // 3. Capture GroundRegion World Box and Detach
  let groundRegionBox = null
  if (groundRegion) {
    house.updateMatrixWorld(true)
    groundRegionBox = new Box3().setFromObject(groundRegion)
    if (groundRegion.parent) {
      groundRegion.parent.remove(groundRegion)
    }
  }

  return { house, groundRegionBox, sandMesh, oceanMesh, spawnNode }
}

export { loadHouse }