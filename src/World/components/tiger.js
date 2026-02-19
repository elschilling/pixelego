import { AnimationMixer } from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

async function loadTiger() {
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
    const gltfLoader = new GLTFLoader()
    gltfLoader.setDRACOLoader(dracoLoader)

    const gltfData = await gltfLoader.loadAsync('/assets/models/tigre.glb')
    const tiger = gltfData.scene
    tiger.name = 'tiger'

    tiger.traverse(n => {
        if (n.isMesh) {
            n.castShadow = true
            n.receiveShadow = true
        }
    })

    // Scale tiger to fit the scene
    tiger.scale.set(1, 1, 1)
    tiger.position.set(0, 5, 10)

    const mixer = new AnimationMixer(tiger)

    const clips = gltfData.animations
    const idleClip = clips.find(c => c.name === 'Idle') || clips[0]
    const walkClip = clips.find(c => c.name === 'Walk') || clips[2]
    const runClip = clips.find(c => c.name === 'Run') || clips[1]

    const idleAction = mixer.clipAction(idleClip)
    const walkAction = mixer.clipAction(walkClip)
    const runAction = mixer.clipAction(runClip)

    idleAction.play()

    return { tiger, mixer, idleAction, walkAction, runAction }
}

export { loadTiger }
