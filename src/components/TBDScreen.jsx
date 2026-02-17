import { useEffect } from 'react'

const TBDScreen = () => {
  useEffect(() => {
    const draw = () => {
      const canvas = window['__screen2Canvas']
      const texture = window['__screen2Texture']
      if (!canvas || !texture) return

      const ctx = canvas.getContext('2d')

      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, 512, 320)

      ctx.fillStyle = 'rgba(0, 255, 255, 0.4)'
      ctx.font = 'bold 20px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('TBD', 256, 160)
      ctx.textAlign = 'left'

      texture.needsUpdate = true
    }

    draw()
    const intervalId = setInterval(draw, 1000)
    return () => clearInterval(intervalId)
  }, [])

  return null
}

export default TBDScreen
