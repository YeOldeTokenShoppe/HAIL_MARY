import { useEffect } from 'react'

const ReservedScreen = () => {
  useEffect(() => {
    const draw = () => {
      const canvas = window['__screen3Canvas']
      const texture = window['__screen3Texture']
      if (!canvas || !texture) return

      const ctx = canvas.getContext('2d')

      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, 512, 320)

      ctx.fillStyle = 'rgba(0, 255, 255, 0.4)'
      ctx.font = 'bold 20px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('Reserved for you', 256, 160)
      ctx.textAlign = 'left'

      texture.needsUpdate = true
    }

    // Draw once, then on a slow interval in case canvas isn't ready immediately
    draw()
    const intervalId = setInterval(draw, 1000)
    return () => clearInterval(intervalId)
  }, [])

  return null
}

export default ReservedScreen
