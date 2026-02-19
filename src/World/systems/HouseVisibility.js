import { Box3 } from 'three'
import gsap from 'gsap'

class HouseVisibility {
    constructor(house, character, groundRegionBox = null) {
        this.house = house
        this.character = character
        this.groundRegionBox = groundRegionBox

        this.groups = [
            { name: 'Cobertura', object: null, currentOpacity: 1, targetOpacity: 1 },
            { name: 'Superior', object: null, currentOpacity: 1, targetOpacity: 1 },
        ]

        this.init()
    }

    init() {
        this.house.traverse(child => {
            const g = this.groups.find(x => x.name === child.name)
            if (g) {
                g.object = child

                // Prepare all materials for transparency
                child.traverse(node => {
                    if (node.isMesh && node.material) {
                        // Clone material to avoid affecting other objects if shared
                        node.material = node.material.clone()
                        node.material.transparent = true
                        node.material.opacity = 1
                    }
                })
            }
        })
    }

    updateGroupVisibility(groupName, visible) {
        const group = this.groups.find(g => g.name === groupName)
        if (!group || !group.object) return

        const target = visible ? 1 : 0
        if (group.targetOpacity === target) return

        group.targetOpacity = target

        // If becoming visible, ensure object is visible before fade starts
        if (visible) group.object.visible = true

        gsap.to(group, {
            currentOpacity: target,
            duration: 0.5,
            ease: 'power2.inOut',
            onUpdate: () => {
                group.object.traverse(node => {
                    if (node.isMesh && node.material) {
                        node.material.opacity = group.currentOpacity
                    }
                })
            },
            onComplete: () => {
                // If completely faded out, hide object for performance
                if (!visible) group.object.visible = false
            }
        })
    }

    tick(delta) {
        const playerY = this.character.position.y
        const playerPos = this.character.position

        // Check if player is inside GroundRegion (Trigger Volume)
        let inGroundRegion = false
        if (this.groundRegionBox) {
            inGroundRegion = this.groundRegionBox.containsPoint(playerPos)
        }

        if (inGroundRegion) {
            // Inside the volume
            if (playerY >= 4) {
                // High enough (2nd Floor)
                this.updateGroupVisibility('Superior', true)
                this.updateGroupVisibility('Cobertura', false)
            } else {
                // Ground Floor
                this.updateGroupVisibility('Superior', false)
                this.updateGroupVisibility('Cobertura', false)
            }
        } else {
            // Outside the volume -> Show everything (Exterior view)
            this.updateGroupVisibility('Superior', true)
            this.updateGroupVisibility('Cobertura', true)
        }
    }
}

export { HouseVisibility }
