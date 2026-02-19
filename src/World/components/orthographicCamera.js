import { OrthographicCamera } from 'three'

function createOrthographicCamera() {
    const frustumSize = 20
    const aspect = window.innerWidth / window.innerHeight
    const camera = new OrthographicCamera(
        frustumSize * aspect / -2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        frustumSize / -2,
        1,
        1000
    );

    // Position it isometric-like
    camera.position.set(50, 50, 50)
    camera.lookAt(0, 0, 0)

    return camera
}

export { createOrthographicCamera }
