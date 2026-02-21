import { Vector3, Box3 } from 'three'
import gsap from 'gsap'

class DoorInteraction {
    constructor(house, character, onAddCollider, onRemoveCollider) {
        this.house = house
        this.onAddCollider = onAddCollider || (() => { })
        this.onRemoveCollider = onRemoveCollider || (() => { })
        this.character = character
        this.door = null
        this.doorWorldPos = new Vector3()
        this.doorColliderBox = null   // Box3 collider for the closed door
        this.isOpen = false
        this.isAnimating = false
        this.isNear = false

        // Proximity threshold (world units)
        this.interactionRadius = 2.5

        // UI elements
        this.promptEl = document.getElementById('door-prompt')
        this.doorButtonEl = document.getElementById('door-button')

        // Mobile button tap handler
        if (this.doorButtonEl) {
            this.doorButtonEl.addEventListener('touchstart', (e) => {
                e.preventDefault()
                this._handleInteract()
            })
        }

        // Key handling with debounce
        this._keyDown = false
        this._onKeyDown = (e) => {
            if (e.code === 'KeyE' && !this._keyDown) {
                this._keyDown = true
                this._handleInteract()
            }
        }
        this._onKeyUp = (e) => {
            if (e.code === 'KeyE') this._keyDown = false
        }
        document.addEventListener('keydown', this._onKeyDown)
        document.addEventListener('keyup', this._onKeyUp)

        this.init()
    }

    init() {
        this.house.traverse(child => {
            if (child.name === 'portaEntrada') {
                this.door = child
            }
        })

        if (!this.door) {
            console.warn('DoorInteraction: "portaEntrada" not found in house model.')
            return
        }

        // Remember the door's parent for detach/reattach
        this.doorParent = this.door.parent

        // Store the door's initial rotation for toggling
        this.closedRotationY = this.door.rotation.y
        this.openRotationY = this.closedRotationY + Math.PI / 2 // 90° swing

        // Calculate the door's world-space center for proximity checks
        this.house.updateMatrixWorld(true)
        const box = new Box3().setFromObject(this.door)
        box.getCenter(this.doorWorldPos)

        // Compute and register the door's collision box (closed state)
        this.doorColliderBox = new Box3().setFromObject(this.door)
        this.onAddCollider(this.doorColliderBox)
    }

    _handleInteract() {
        if (!this.isNear || this.isAnimating || !this.door) return

        this.isAnimating = true
        const opening = !this.isOpen
        const targetY = opening ? this.openRotationY : this.closedRotationY

        gsap.to(this.door.rotation, {
            y: targetY,
            duration: 0.6,
            ease: 'power2.inOut',
            onComplete: () => {
                this.isOpen = opening
                this.isAnimating = false
                this._updatePromptText()
                this._updateCollision()
            }
        })
    }

    _updateCollision() {
        if (!this.doorColliderBox) return

        if (this.isOpen) {
            this.onRemoveCollider(this.doorColliderBox)
        } else {
            // Recompute box for the closed door position
            this.house.updateMatrixWorld(true)
            this.doorColliderBox.setFromObject(this.door)
            this.onAddCollider(this.doorColliderBox)
        }
    }

    _updatePromptText() {
        const text = this.isOpen ? 'close' : 'open'
        if (this.promptEl) {
            this.promptEl.textContent = `Press E to ${text}`
        }
        if (this.doorButtonEl) {
            this.doorButtonEl.textContent = text.toUpperCase()
        }
    }

    _showPrompt() {
        if (this.promptEl) {
            this._updatePromptText()
            this.promptEl.classList.add('visible')
        }
        if (this.doorButtonEl) {
            this._updatePromptText()
            this.doorButtonEl.classList.add('visible')
        }
    }

    _hidePrompt() {
        if (this.promptEl) {
            this.promptEl.classList.remove('visible')
        }
        if (this.doorButtonEl) {
            this.doorButtonEl.classList.remove('visible')
        }
    }

    tick(delta) {
        if (!this.door) return

        // Recalculate door world position (in case house moves)
        const box = new Box3().setFromObject(this.door)
        box.getCenter(this.doorWorldPos)

        // Check XZ distance to avoid Y affecting proximity
        const dx = this.character.position.x - this.doorWorldPos.x
        const dz = this.character.position.z - this.doorWorldPos.z
        const distXZ = Math.sqrt(dx * dx + dz * dz)

        const wasNear = this.isNear
        this.isNear = distXZ < this.interactionRadius

        if (this.isNear && !wasNear) {
            this._showPrompt()
        } else if (!this.isNear && wasNear) {
            this._hidePrompt()
        }
    }

    dispose() {
        document.removeEventListener('keydown', this._onKeyDown)
        document.removeEventListener('keyup', this._onKeyUp)
    }
}

export { DoorInteraction }
