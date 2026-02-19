import { Vector3, Quaternion } from 'three'
import { Octree } from 'three/examples/jsm/math/Octree'
import { Capsule } from 'three/examples/jsm/math/Capsule'

function createCharacterController(tiger, idleAction, walkAction, runAction, mixer, camera, collisionMesh, joystick) {
    const WALK_SPEED = 5
    const RUN_SPEED = 10
    const GRAVITY = 30
    const STEPS_PER_FRAME = 5
    const CAMERA_OFFSET = new Vector3(-20, 20, 20)

    // ── Octree collision world ──────────────────────────────────────────
    const worldOctree = new Octree()
    if (collisionMesh) worldOctree.fromGraphNode(collisionMesh)

    // Capsule: bottom point, top point, radius
    const capsuleBottom = new Vector3(tiger.position.x, tiger.position.y + 0.3, tiger.position.z)
    const capsuleTop = new Vector3(tiger.position.x, tiger.position.y + 1.2, tiger.position.z)
    const tigerCapsule = new Capsule(capsuleBottom, capsuleTop, 0.3)

    const velocity = new Vector3()
    const moveDir = new Vector3()
    const targetQuat = new Quaternion()
    const worldUp = new Vector3(0, 1, 0)
    const cameraForward = new Vector3()
    const cameraRight = new Vector3()

    let onFloor = false

    // Animation state
    let activeAction = idleAction

    const keyStates = {}
    document.addEventListener('keydown', e => { keyStates[e.code] = true })
    document.addEventListener('keyup', e => { keyStates[e.code] = false })

    // ── Helpers ─────────────────────────────────────────────────────────

    function fadeToAction(toAction, duration = 0.2) {
        if (activeAction === toAction) return
        activeAction.fadeOut(duration)
        toAction.reset().fadeIn(duration).play()
        activeAction = toAction
    }

    function handleCollisions() {
        const result = worldOctree.capsuleIntersect(tigerCapsule)
        onFloor = false
        if (result) {
            onFloor = result.normal.y > 0
            if (!onFloor) {
                velocity.addScaledVector(result.normal, -result.normal.dot(velocity))
            }
            tigerCapsule.translate(result.normal.multiplyScalar(result.depth))
        }
    }

    function applyPhysics(dt, moving, jumping) {
        if (onFloor) {
            if (!moving) {
                // Stop instantly — no sliding
                velocity.x = 0
                velocity.z = 0
            }

            if (jumping) {
                velocity.y = 12 // JUMP_FORCE
                onFloor = false
            } else {
                // Damp Y on floor to avoid drift
                velocity.y = Math.max(0, velocity.y + (Math.exp(-4 * dt) - 1) * velocity.y)
            }
        } else {
            // In the air: apply gravity and a little air resistance
            velocity.y -= GRAVITY * dt
            const airDamp = Math.exp(-1 * dt) - 1
            velocity.addScaledVector(velocity, airDamp)
        }

        // Move capsule by accumulated velocity
        tigerCapsule.translate(velocity.clone().multiplyScalar(dt))
        handleCollisions()

        // Sync tiger mesh to capsule base (bottom + radius offset)
        tiger.position.set(
            tigerCapsule.start.x,
            tigerCapsule.start.y - tigerCapsule.radius,
            tigerCapsule.start.z
        )

        // Safety teleport if fallen out of bounds
        if (tiger.position.y < -25) {
            tigerCapsule.start.set(0, 0.6, 0)
            tigerCapsule.end.set(0, 1.5, 0)
            velocity.set(0, 0, 0)
        }
    }

    function gatherInput(dt) {
        moveDir.set(0, 0, 0)

        // Derive camera-space axes projected onto XZ plane
        cameraForward.subVectors(tiger.position, camera.position)
        cameraForward.y = 0
        cameraForward.normalize()

        cameraRight.crossVectors(cameraForward, worldUp).negate()

        // Keyboard Input
        if (keyStates['KeyW']) moveDir.add(cameraForward)
        if (keyStates['KeyS']) moveDir.addScaledVector(cameraForward, -1)
        if (keyStates['KeyA']) moveDir.addScaledVector(cameraRight, 1)
        if (keyStates['KeyD']) moveDir.addScaledVector(cameraRight, -1)

        // Joystick Input (Mobile)
        if (joystick && joystick.active) {
            moveDir.addScaledVector(cameraRight, -joystick.vector.x)
            moveDir.addScaledVector(cameraForward, joystick.vector.y)
        }

        const moving = moveDir.lengthSq() > 0.001
        const running = keyStates['ShiftLeft']
        const jumping = keyStates['Space'] || (joystick && joystick.jumpActive)
        const currentSpeed = running ? RUN_SPEED : WALK_SPEED

        if (moving) {
            moveDir.normalize()
            // Set velocity directly — no drift
            velocity.x = moveDir.x * currentSpeed
            velocity.z = moveDir.z * currentSpeed

            // Rotate tiger to face movement direction (+ Math.PI flips model)
            targetQuat.setFromAxisAngle(worldUp, Math.atan2(moveDir.x, moveDir.z) + Math.PI)
            tiger.quaternion.slerp(targetQuat, 12 * dt)
        }

        return { moving, running, jumping }
    }

    function tick(delta) {
        // Evaluate input state just once for animation logic
        const inputState = gatherInput(delta / STEPS_PER_FRAME * STEPS_PER_FRAME)

        // Physics sub-steps
        for (let i = 0; i < STEPS_PER_FRAME; i++) {
            const dt = Math.min(0.05, delta) / STEPS_PER_FRAME
            const { moving, jumping } = gatherInput(dt)
            applyPhysics(dt, moving, jumping)
        }

        // ── Animation blending ──────────────────────────────────────────
        if (inputState.moving) {
            if (inputState.running) {
                fadeToAction(runAction)
            } else {
                fadeToAction(walkAction)
            }
        } else {
            fadeToAction(idleAction)
        }

        mixer.update(delta)

        // ── Follow camera ────────────────────────────────────────────────
        camera.position.copy(tiger.position).add(CAMERA_OFFSET)
        camera.lookAt(tiger.position)
    }

    return { tick }
}

export { createCharacterController }
