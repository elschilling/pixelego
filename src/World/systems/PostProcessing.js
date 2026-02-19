import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPixelatedPass } from 'three/examples/jsm/postprocessing/RenderPixelatedPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

function createPostProcessing(scene, camera, renderer) {
    const composer = new EffectComposer(renderer)

    // Pixelation pass
    const pixelPass = new RenderPixelatedPass(3, scene, camera)
    pixelPass.normalEdgeStrength = 0.3
    pixelPass.depthEdgeStrength = 0.4
    composer.addPass(pixelPass)

    // Output pass for color space handling
    const outputPass = new OutputPass()
    composer.addPass(outputPass)

    return {
        composer,
        pixelPass,
        outputPass,
        updateSize(width, height) {
            composer.setSize(width, height)
            pixelPass.setSize(width, height)
        },
        setCamera(camera) {
            pixelPass.camera = camera
        }
    }
}

export { createPostProcessing }
