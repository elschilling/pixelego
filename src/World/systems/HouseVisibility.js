import { Box3, Vector3 } from 'three'
import gsap from 'gsap'

class HouseVisibility {
    constructor(house, character, groundRegionBox = null, camera = null) {
        this.house = house
        this.character = character
        this.groundRegionBox = groundRegionBox
        this.camera = camera

        // Uniforms for the proximity shader
        this.sharedUniforms = {
            uPlayerPos: { value: new Vector3() },
            uRadius: { value: 6.0 },
            uFalloff: { value: 2.0 },
            uHeightLimit: { value: 3.5 }, // Restricts transparency vertically
            uMinOpacity: { value: 0.12 }
        }

        this.groups = [
            { name: 'Cobertura', object: null, currentOpacity: 1, targetOpacity: 1 },
            { name: 'Superior', object: null, currentOpacity: 1, targetOpacity: 1 },
        ]

        this._lastTargetRadius = 6.0
        this._lastInGroundRegion = false
        this._zoomOutside = 1.0
        this._zoomInside = 1.5
        this.init()
    }

    init() {
        // First, record groups for the floor-visibility system
        this.house.traverse(child => {
            const g = this.groups.find(x => x.name === child.name)
            if (g) {
                g.object = child
            }
        })

        // Second, prepare materials for both fading and proximity transparency
        this.house.traverse(node => {
            if (node.isMesh && node.material) {
                // Determine if this mesh is part of a group that needs to fade (Superior or Cobertura)
                let isInGroup = false;
                node.traverseAncestors(a => {
                    if (this.groups.some(g => g.object === a)) {
                        isInGroup = true;
                    }
                });

                const materials = Array.isArray(node.material) ? node.material : [node.material]

                materials.forEach((mat, index) => {
                    const matName = (mat.name || "").toLowerCase();
                    const isWall = matName.includes('wall') || matName.includes('parede');
                    const isGlass = matName.includes('vidro') || matName.includes('glass');

                    // Proceed only if it's a wall (for shader), glass, or in a group (for fading)
                    if (!isWall && !isGlass && !isInGroup) return;

                    // Clone to avoid affecting shared assets
                    const newMat = mat.clone()
                    newMat.transparent = true

                    // Store original opacity for the visibility system
                    newMat.userData.baseOpacity = mat.opacity;

                    // Only apply proximity shader to walls
                    if (isWall) {
                        newMat.onBeforeCompile = (shader) => {
                            shader.uniforms.uPlayerPos = this.sharedUniforms.uPlayerPos
                            shader.uniforms.uRadius = this.sharedUniforms.uRadius
                            shader.uniforms.uFalloff = this.sharedUniforms.uFalloff
                            shader.uniforms.uHeightLimit = this.sharedUniforms.uHeightLimit
                            shader.uniforms.uMinOpacity = this.sharedUniforms.uMinOpacity

                            shader.vertexShader = `
                                varying vec3 vWorldPosition;
                                ${shader.vertexShader}
                            `.replace(
                                '#include <worldpos_vertex>',
                                `
                                #include <worldpos_vertex>
                                vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
                                `
                            )

                            shader.fragmentShader = `
                                varying vec3 vWorldPosition;
                                uniform vec3 uPlayerPos;
                                uniform float uRadius;
                                uniform float uFalloff;
                                uniform float uHeightLimit;
                                uniform float uMinOpacity;
                                ${shader.fragmentShader}
                            `.replace(
                                '#include <dithering_fragment>',
                                `
                                #include <dithering_fragment>
                                
                                // Cylindrical distance (XZ only)
                                float distXZ = distance(vWorldPosition.xz, uPlayerPos.xz);
                                // Vertical distance relative to player
                                float dy = vWorldPosition.y - uPlayerPos.y;
                                
                                // horizontal falloff
                                float alphaXZ = smoothstep(uRadius - uFalloff, uRadius, distXZ);
                                
                                // Vertical bounds (Asymmetric)
                                // Transparency window: from ~0.1 below feet to ~3.0 above
                                float alphaY_bottom = 1.0 - smoothstep(-0.3, -0.1, dy);
                                float alphaY_top = smoothstep(3.0, 3.5, dy);
                                float alphaY = max(alphaY_bottom, alphaY_top);
                                
                                // Final proximity factor
                                float proximityAlpha = max(alphaXZ, alphaY);
                                
                                gl_FragColor.a *= (proximityAlpha * (1.0 - uMinOpacity) + uMinOpacity);
                                `
                            )
                        }
                    }

                    if (Array.isArray(node.material)) {
                        node.material[index] = newMat
                    } else {
                        node.material = newMat
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

        gsap.to(group, {
            currentOpacity: target,
            duration: 0.5,
            ease: 'power2.inOut',
            onUpdate: () => {
                group.object.traverse(node => {
                    if (node.isMesh && node.material) {
                        const mats = Array.isArray(node.material) ? node.material : [node.material]
                        mats.forEach(m => {
                            const baseOpacity = m.userData.baseOpacity !== undefined ? m.userData.baseOpacity : 1.0;
                            m.opacity = group.currentOpacity * baseOpacity;
                        })
                    }
                })
            }
        })
    }

    tick(delta) {
        // Update shared proximity uniform
        this.sharedUniforms.uPlayerPos.value.copy(this.character.position)

        const playerY = this.character.position.y
        const playerPos = this.character.position

        // Check if player is inside GroundRegion (Trigger Volume)
        let inGroundRegion = false
        if (this.groundRegionBox) {
            inGroundRegion = this.groundRegionBox.containsPoint(playerPos)
        }

        // ── Proximity Radius Animation ──────────────────────────────────
        const targetRadius = inGroundRegion ? 6.0 : 0.0
        if (this._lastTargetRadius !== targetRadius) {
            this._lastTargetRadius = targetRadius
            gsap.to(this.sharedUniforms.uRadius, {
                value: targetRadius,
                duration: 0.5,
                ease: 'power2.inOut'
            })
        }

        // ── Camera Zoom Animation ───────────────────────────────────────
        if (this.camera && inGroundRegion !== this._lastInGroundRegion) {
            this._lastInGroundRegion = inGroundRegion
            const targetZoom = inGroundRegion ? this._zoomInside : this._zoomOutside
            gsap.to(this.camera, {
                zoom: targetZoom,
                duration: 0.8,
                ease: 'power2.inOut',
                onUpdate: () => this.camera.updateProjectionMatrix()
            })
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
