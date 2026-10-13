import { ColorKeyframeTrack, NumberKeyframeTrack, InterpolateLinear, InterpolateDiscrete } from 'three'

// The tunnel discards exported lights. Support the material pointer channels
// used by its dioramas, in the same clips/mixer as their skeletal animation.
export function gltfEmissiveAnimation(parser) {
  return {
    name: 'KHR_animation_pointer',
    async afterRoot(gltf) {
      const bindings = new Map()
      for (const scene of gltf.scenes) {
        scene.traverse((object) => {
          if (!object.material) return
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material, slot) => {
            const index = parser.associations.get(material)?.materials
            if (index === undefined) return
            if (!bindings.has(index)) bindings.set(index, new Map())
            // Shared materials need just one binding; cloned materials each
            // need their own, even when they came from the same glTF material.
            const path = Array.isArray(object.material)
              ? `${object.uuid}.material[${slot}]` : `${object.uuid}.material`
            if (!bindings.get(index).has(material)) bindings.get(index).set(material, path)
          })
        })
      }
      await Promise.all((parser.json.animations || []).map(async (definition, index) => {
        const clip = gltf.animations[index]
        for (const channel of definition.channels) {
          const pointer = channel.target.extensions?.KHR_animation_pointer?.pointer
          const match = pointer?.match(/^\/materials\/(\d+)\/(emissiveFactor|extensions\/KHR_materials_emissive_strength\/emissiveStrength)$/)
          if (!match) continue
          const targets = bindings.get(Number(match[1]))
          if (!targets) continue
          const sampler = definition.samplers[channel.sampler]
          const interpolation = sampler.interpolation || 'LINEAR'
          if (!['LINEAR', 'STEP', 'CUBICSPLINE'].includes(interpolation)) {
            throw new Error(`Unsupported emissive animation interpolation: ${interpolation}`)
          }
          const [input, output] = await Promise.all([
            parser.getDependency('accessor', sampler.input),
            parser.getDependency('accessor', sampler.output),
          ])
          const isColor = match[2] === 'emissiveFactor'
          const Track = isColor ? ColorKeyframeTrack : NumberKeyframeTrack
          for (const path of targets.values()) {
            const track = new Track(
              `${path}.${isColor ? 'emissive' : 'emissiveIntensity'}`,
              input.array, output.array,
              interpolation === 'STEP' ? InterpolateDiscrete : InterpolateLinear,
            )
            if (interpolation === 'CUBICSPLINE') parser._createCubicSplineTrackInterpolant(track)
            clip.tracks.push(track)
          }
        }
        clip.resetDuration()
      }))
    },
  }
}
