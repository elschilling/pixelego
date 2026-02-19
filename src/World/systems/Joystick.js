import { Vector2 } from 'three'

class Joystick {
    constructor() {
        this.container = document.getElementById('joystick-container')
        this.base = document.getElementById('joystick-base')
        this.knob = document.getElementById('joystick-knob')

        this.vector = new Vector2(0, 0)
        this.active = false

        this.maxDistance = 60 // Half of container width
        this.center = new Vector2(0, 0)

        this.init()
    }

    init() {
        if (!this.container) return

        this.container.addEventListener('touchstart', (e) => this.onStart(e), { passive: false })
        window.addEventListener('touchmove', (e) => this.onMove(e), { passive: false })
        window.addEventListener('touchend', (e) => this.onEnd(e), { passive: false })

        // Jump button handling
        this.jumpButton = document.getElementById('jump-button')
        this.jumpActive = false
        if (this.jumpButton) {
            this.jumpButton.addEventListener('touchstart', (e) => {
                this.jumpActive = true
                this.jumpButton.style.background = 'rgba(255, 255, 255, 0.8)'
            }, { passive: true })
            this.jumpButton.addEventListener('touchend', (e) => {
                this.jumpActive = false
                this.jumpButton.style.background = 'rgba(255, 255, 255, 0.4)'
            }, { passive: true })
        }
    }

    onStart(e) {
        this.active = true
        // Store which touch started the joystick
        this.touchId = e.changedTouches[0].identifier

        const rect = this.base.getBoundingClientRect()
        this.center.set(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
        )
        this.onMove(e)
    }

    onMove(e) {
        if (!this.active) return

        // Find the joystick touch among all active touches
        const touch = Array.from(e.touches).find(t => t.identifier === this.touchId)
        if (!touch) return

        e.preventDefault()

        const touchPos = new Vector2(touch.clientX, touch.clientY)
        const delta = touchPos.clone().sub(this.center)
        const distance = Math.min(delta.length(), this.maxDistance)

        delta.normalize()

        // Final normalized vector
        this.vector.set(delta.x, -delta.y).multiplyScalar(distance / this.maxDistance)

        // Visual position of knob
        const knobPos = delta.multiplyScalar(distance)
        this.knob.style.transform = `translate(${knobPos.x}px, ${knobPos.y}px)`
    }

    onEnd(e) {
        // Only stop if the joystick touch ended
        const touch = Array.from(e.changedTouches).find(t => t.identifier === this.touchId)
        if (!touch) return

        this.active = false
        this.vector.set(0, 0)
        this.knob.style.transform = `translate(0px, 0px)`
    }
}

export { Joystick }
