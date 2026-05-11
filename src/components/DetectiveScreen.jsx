import { useEffect, useRef } from 'react'

// DetectiveScreen — paints onto Screen3's canvas (512x320). Themed as a
// crypto-fraud investigation terminal for the Detective character: rotating
// case files of suspicious addresses, a threat radar, and a live alert feed.
//
// All data is generated client-side from a deterministic seeded RNG so
// addresses look real but don't libel anyone. The seed advances on a slow
// timer to give the impression of a live caseload.

const W = 512
const H = 320

const SCAM_TYPES = [
  { type: 'RUG PULL',      severity: 'CRIT', tag: 'EXIT_LIQ',  weight: 4 },
  { type: 'HONEYPOT',      severity: 'CRIT', tag: 'TRAP',      weight: 3 },
  { type: 'WALLET DRAIN',  severity: 'CRIT', tag: 'SWEEP',     weight: 3 },
  { type: 'EXIT SCAM',     severity: 'CRIT', tag: 'DEAD',      weight: 2 },
  { type: 'PHISHING',      severity: 'HIGH', tag: 'DRAINER',   weight: 5 },
  { type: 'PONZI',         severity: 'HIGH', tag: 'YIELD',     weight: 3 },
  { type: 'FAKE AIRDROP',  severity: 'HIGH', tag: 'APPROVAL',  weight: 4 },
  { type: 'PUMP & DUMP',   severity: 'MED',  tag: 'WASH',      weight: 3 },
  { type: 'IMPERSONATION', severity: 'MED',  tag: 'CLONE',     weight: 2 },
  { type: 'FAKE NFT',      severity: 'MED',  tag: 'MINT',      weight: 2 },
]

const SEVERITY_COLORS = {
  CRIT: '#ff3b3b',
  HIGH: '#ff9d3b',
  MED:  '#ffd84d',
}

const STATUS_LABELS = ['UNDER INV.', 'ON WATCH', 'TRACING', 'FROZEN', 'COLD']

const TICKER_TEMPLATES = [
  'WALLET {addr} flagged — outflow spike, exchanges notified',
  'Bridge contract {addr} drained — {amt} ETH siphoned in 11 min',
  'Token {addr} marked HONEYPOT — buy enabled, sell reverts',
  'Cluster of {n} wallets linked to "{name}" rug — analysis ongoing',
  'Phishing kit "{name}" cloned — new domain {dom} active',
  'Address {addr} matches OFAC pattern — escalated to compliance',
  'Approval-drainer signature on {addr} — owners alerted',
  'Mixer hop traced — {addr} → {addr2} via tornado-clone',
  'Deepfake CEO endorses fake presale — channel "{name}" reported',
  'NFT mint "{name}" reverts post-mint — funds routed to {addr}',
]

const ALIAS_NAMES = [
  'NeoMoonDAO', 'PonziPalm', 'FluffSwap', 'DrainoFi', 'GhostBridge',
  'RugRoyale', 'HoneyVault', 'BlackInk', 'StolenSeed', 'WickFinance',
  'CarbonHydra', 'MiraSwap', 'VoidFi', 'ShadowOrbit', 'PhantomYield',
]

const DOMAIN_FRAGS = ['claim', 'bonus', 'airdrop', 'staking', 'rewards', 'connect', 'verify']
const DOMAIN_TLDS = ['xyz', 'site', 'app', 'finance', 'money', 'live']

// Mulberry32: deterministic seeded RNG so a given seed yields the same
// caseload — the seed advances slowly so the panel "investigates new cases"
// without flicker between paints.
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const HEX = '0123456789abcdef'
function rngAddr(rng) {
  let s = '0x'
  for (let i = 0; i < 40; i++) s += HEX[Math.floor(rng() * 16)]
  return s
}

function shortAddr(a) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

function pickWeighted(rng, list) {
  const total = list.reduce((s, x) => s + (x.weight || 1), 0)
  let r = rng() * total
  for (const item of list) {
    r -= item.weight || 1
    if (r <= 0) return item
  }
  return list[list.length - 1]
}

function generateCases(seed, count) {
  const rng = mulberry32(seed)
  const out = []
  for (let i = 0; i < count; i++) {
    const t = pickWeighted(rng, SCAM_TYPES)
    const risk = Math.floor(60 + rng() * 40) // 60–99
    const status = STATUS_LABELS[Math.floor(rng() * STATUS_LABELS.length)]
    const ageMin = Math.floor(1 + rng() * 240)
    const lossEth = (rng() * (t.severity === 'CRIT' ? 800 : 80)).toFixed(1)
    out.push({
      id: `CASE-${(seed + i * 7919).toString(16).slice(-5).toUpperCase()}`,
      addr: rngAddr(rng),
      ...t,
      risk,
      status,
      ageMin,
      lossEth,
    })
  }
  return out
}

function generateTickerLine(seed) {
  const rng = mulberry32(seed * 31 + 7)
  const tpl = TICKER_TEMPLATES[Math.floor(rng() * TICKER_TEMPLATES.length)]
  const addr = shortAddr(rngAddr(rng))
  const addr2 = shortAddr(rngAddr(rng))
  const name = ALIAS_NAMES[Math.floor(rng() * ALIAS_NAMES.length)]
  const dom = `${DOMAIN_FRAGS[Math.floor(rng() * DOMAIN_FRAGS.length)]}-${name.toLowerCase()}.${DOMAIN_TLDS[Math.floor(rng() * DOMAIN_TLDS.length)]}`
  const amt = (rng() * 4000).toFixed(0)
  const n = Math.floor(rng() * 40 + 4)
  return tpl
    .replace('{addr2}', addr2)
    .replace('{addr}', addr)
    .replace('{name}', name)
    .replace('{dom}', dom)
    .replace('{amt}', amt)
    .replace('{n}', String(n))
}

// Button geometry (same Y as ReservedScreen so "Go Back" lines up visually)
const BTN_Y = 286
const BTN_H = 26
const BTN_R = 5
const BACK_BTN = { x: 412, w: 84 }

const DetectiveScreen = () => {
  const startTimeRef = useRef(Date.now())
  const selectedCaseRef = useRef(0)
  const seedRef = useRef(1)

  useEffect(() => {
    // Cycle the case seed every 8s so the caseload feels alive
    const seedInterval = setInterval(() => {
      seedRef.current = (seedRef.current + 1) % 9973
    }, 8000)

    // Click handler — tap "Go Back" to release camera focus, tap a case row
    // to highlight it.
    const handleScreen3Click = (event) => {
      const { uv } = event.detail || {}
      if (!uv) return
      const cx = uv.x * W
      const cy = uv.y * H

      if (
        cx >= BACK_BTN.x &&
        cx <= BACK_BTN.x + BACK_BTN.w &&
        cy >= BTN_Y &&
        cy <= BTN_Y + BTN_H
      ) {
        window.dispatchEvent(new CustomEvent('screenGoBack'))
        return
      }

      // Case rows occupy the left list area: x 12..276, y 92..252, four rows
      // each 40px tall. Pad the top by a few px so the "ACTIVE INVESTIGATIONS"
      // header is forgiving to tap.
      if (cx >= 12 && cx <= 276 && cy >= 88 && cy <= 252) {
        const row = Math.min(3, Math.max(0, Math.floor((cy - 92) / 40)))
        selectedCaseRef.current = row
      }
    }
    window.addEventListener('screen3Click', handleScreen3Click)

    const draw = () => {
      const canvas = window['__screen3Canvas']
      const texture = window['__screen3Texture']
      if (!canvas || !texture) return

      // Yield to EvidenceScreens while it owns this canvas (player is reading
      // an evidence card on Marisol's primary screen). Resume when the flag
      // clears (CONTINUE or rotate-away from the answer view).
      if (canvas.dataset && canvas.dataset.evidenceActive === 'true') return

      const ctx = canvas.getContext('2d')

      const now = Date.now()
      const t = (now - startTimeRef.current) / 1000
      const cases = generateCases(seedRef.current, 4)
      const sel = selectedCaseRef.current % cases.length

      // --- Background ---
      ctx.fillStyle = '#070a0d'
      ctx.fillRect(0, 0, W, H)

      // Subtle scanlines for noir CRT feel
      ctx.fillStyle = 'rgba(255,255,255,0.025)'
      for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1)

      // --- Header bar ---
      const grad = ctx.createLinearGradient(0, 0, W, 0)
      grad.addColorStop(0, 'rgba(255,80,40,0.18)')
      grad.addColorStop(1, 'rgba(40,200,255,0.10)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, 36)

      ctx.fillStyle = '#ff8a4d'
      ctx.font = 'bold 14px monospace'
      ctx.textBaseline = 'middle'
      ctx.fillText('CRYPTO FRAUD UNIT', 14, 14)

      ctx.fillStyle = 'rgba(220,220,230,0.65)'
      ctx.font = '10px monospace'
      ctx.fillText('// CASE FILE TERMINAL  //  CLEARANCE: TIER-3', 14, 28)

      // Live indicator
      const blink = (Math.sin(t * 4) + 1) / 2
      ctx.fillStyle = `rgba(255,60,60,${0.4 + blink * 0.6})`
      ctx.beginPath()
      ctx.arc(W - 56, 14, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ff5050'
      ctx.font = 'bold 10px monospace'
      ctx.fillText('LIVE', W - 46, 14)

      // Clock
      const d = new Date()
      const hh = String(d.getUTCHours()).padStart(2, '0')
      const mm = String(d.getUTCMinutes()).padStart(2, '0')
      const ss = String(d.getUTCSeconds()).padStart(2, '0')
      ctx.fillStyle = 'rgba(180,220,255,0.7)'
      ctx.font = '10px monospace'
      ctx.fillText(`${hh}:${mm}:${ss} UTC`, W - 130, 28)

      // --- Stats row ---
      const statsY = 42
      ctx.fillStyle = 'rgba(255,255,255,0.04)'
      ctx.fillRect(8, statsY, W - 16, 26)
      ctx.strokeStyle = 'rgba(255,138,77,0.35)'
      ctx.lineWidth = 1
      ctx.strokeRect(8, statsY, W - 16, 26)

      const statRng = mulberry32(seedRef.current * 13 + 1)
      const flagged = 47 + Math.floor(statRng() * 8)
      const traced = 1280 + Math.floor(statRng() * 60)
      const seizedM = (12.4 + statRng() * 1.2).toFixed(2)

      const drawStat = (x, label, value, color) => {
        ctx.fillStyle = 'rgba(180,200,220,0.55)'
        ctx.font = '9px monospace'
        ctx.textBaseline = 'top'
        ctx.fillText(label, x, statsY + 4)
        ctx.fillStyle = color
        ctx.font = 'bold 13px monospace'
        ctx.fillText(value, x, statsY + 14)
      }
      drawStat(16, 'FLAGGED 24H', String(flagged), '#ff8a4d')
      drawStat(140, 'WALLETS TRACED', String(traced), '#7ad7ff')
      drawStat(290, 'SEIZED', `$${seizedM}M`, '#7af0a4')
      drawStat(420, 'OPEN CASES', '203', '#ffd84d')

      // --- Active cases list (left) ---
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#ff8a4d'
      ctx.font = 'bold 11px monospace'
      ctx.fillText('ACTIVE INVESTIGATIONS', 14, 80)

      ctx.strokeStyle = 'rgba(255,138,77,0.25)'
      ctx.beginPath()
      ctx.moveTo(168, 80)
      ctx.lineTo(282, 80)
      ctx.stroke()

      const rowY0 = 92
      const rowH = 40
      cases.forEach((c, i) => {
        const y = rowY0 + i * rowH
        const isSel = i === sel
        // Row background
        ctx.fillStyle = isSel ? 'rgba(255,138,77,0.10)' : 'rgba(255,255,255,0.025)'
        ctx.beginPath()
        ctx.roundRect(12, y, 264, rowH - 4, 4)
        ctx.fill()
        ctx.strokeStyle = isSel ? 'rgba(255,138,77,0.55)' : 'rgba(255,255,255,0.06)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(12, y, 264, rowH - 4, 4)
        ctx.stroke()

        // Severity accent bar
        const sevColor = SEVERITY_COLORS[c.severity]
        ctx.fillStyle = sevColor
        ctx.fillRect(12, y, 4, rowH - 4)

        // Scam type + risk number inline
        ctx.fillStyle = sevColor
        ctx.font = 'bold 10px monospace'
        ctx.textBaseline = 'top'
        ctx.fillText(c.type, 22, y + 4)
        const typeW = ctx.measureText(c.type).width
        ctx.fillStyle = 'rgba(220,230,240,0.55)'
        ctx.font = '9px monospace'
        ctx.fillText(`· risk ${c.risk}`, 22 + typeW + 6, y + 5)

        // Case ID
        ctx.fillStyle = 'rgba(180,200,220,0.55)'
        ctx.font = '8px monospace'
        ctx.fillText(c.id, 22, y + 15)

        // Address
        ctx.fillStyle = 'rgba(220,230,240,0.85)'
        ctx.font = '9px monospace'
        ctx.fillText(shortAddr(c.addr), 22, y + 24)

        // Right-side status block
        ctx.fillStyle = 'rgba(180,200,220,0.55)'
        ctx.font = '8px monospace'
        ctx.fillText(c.status, 200, y + 4)

        ctx.fillStyle = '#ff8a4d'
        ctx.font = 'bold 9px monospace'
        ctx.fillText(`#${c.tag}`, 200, y + 15)

        ctx.fillStyle = 'rgba(220,230,240,0.85)'
        ctx.font = '9px monospace'
        ctx.fillText(`${c.ageMin}m ago`, 200, y + 24)

        // Thin risk meter pinned to row bottom edge — full inner width, no
        // overlap with text rows above.
        const riskY = y + rowH - 7
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.fillRect(22, riskY, 248, 2)
        ctx.fillStyle = sevColor
        ctx.fillRect(22, riskY, 248 * (c.risk / 100), 2)
      })

      // --- Right panel: Threat Radar ---
      const radarCx = 380
      const radarCy = 160
      const radarR = 64

      ctx.fillStyle = '#ff8a4d'
      ctx.font = 'bold 11px monospace'
      ctx.textBaseline = 'top'
      ctx.fillText('THREAT RADAR', 296, 80)

      // Radar circles
      ctx.strokeStyle = 'rgba(122, 215, 255, 0.18)'
      ctx.lineWidth = 1
      for (let r = radarR / 3; r <= radarR; r += radarR / 3) {
        ctx.beginPath()
        ctx.arc(radarCx, radarCy, r, 0, Math.PI * 2)
        ctx.stroke()
      }
      // Crosshair
      ctx.beginPath()
      ctx.moveTo(radarCx - radarR, radarCy)
      ctx.lineTo(radarCx + radarR, radarCy)
      ctx.moveTo(radarCx, radarCy - radarR)
      ctx.lineTo(radarCx, radarCy + radarR)
      ctx.stroke()

      // Sweep
      const sweepAngle = (t * 0.9) % (Math.PI * 2)
      const sweepGrad = ctx.createRadialGradient(radarCx, radarCy, 0, radarCx, radarCy, radarR)
      sweepGrad.addColorStop(0, 'rgba(122, 215, 255, 0.55)')
      sweepGrad.addColorStop(1, 'rgba(122, 215, 255, 0)')
      ctx.fillStyle = sweepGrad
      ctx.beginPath()
      ctx.moveTo(radarCx, radarCy)
      ctx.arc(radarCx, radarCy, radarR, sweepAngle - 0.5, sweepAngle)
      ctx.closePath()
      ctx.fill()

      // Sweep line
      ctx.strokeStyle = 'rgba(122, 215, 255, 0.85)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(radarCx, radarCy)
      ctx.lineTo(radarCx + Math.cos(sweepAngle) * radarR, radarCy + Math.sin(sweepAngle) * radarR)
      ctx.stroke()

      // Blips — deterministic per seed; brighten when sweep passes
      const blipRng = mulberry32(seedRef.current * 17 + 3)
      for (let i = 0; i < 9; i++) {
        const a = blipRng() * Math.PI * 2
        const r = blipRng() * (radarR - 8) + 4
        const bx = radarCx + Math.cos(a) * r
        const by = radarCy + Math.sin(a) * r
        const sevPick = blipRng()
        const blipColor =
          sevPick > 0.7 ? '#ff3b3b' : sevPick > 0.4 ? '#ff9d3b' : '#ffd84d'
        // Distance from sweep line
        let da = Math.abs(((a - sweepAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2))
        if (da > Math.PI) da = Math.PI * 2 - da
        const flash = Math.max(0, 1 - da / 0.8)
        ctx.fillStyle = blipColor
        ctx.globalAlpha = 0.35 + flash * 0.65
        ctx.beginPath()
        ctx.arc(bx, by, 2 + flash * 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }

      // Threat level under radar
      ctx.fillStyle = 'rgba(180,200,220,0.55)'
      ctx.font = '9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('THREAT LEVEL', radarCx, radarCy + radarR + 12)
      ctx.fillStyle = '#ff3b3b'
      ctx.font = 'bold 14px monospace'
      ctx.fillText('ELEVATED', radarCx, radarCy + radarR + 28)
      ctx.textAlign = 'left'

      // --- Selected case dossier (between list and bottom buttons) ---
      const c = cases[sel]
      const dossierY = 250
      ctx.fillStyle = 'rgba(255,138,77,0.08)'
      ctx.fillRect(8, dossierY, W - 16, 30)
      ctx.strokeStyle = 'rgba(255,138,77,0.35)'
      ctx.strokeRect(8, dossierY, W - 16, 30)

      ctx.fillStyle = '#ff8a4d'
      ctx.font = 'bold 9px monospace'
      ctx.textBaseline = 'top'
      ctx.fillText('DOSSIER', 14, dossierY + 4)

      ctx.fillStyle = 'rgba(220,230,240,0.92)'
      ctx.font = '10px monospace'
      ctx.fillText(`${c.id}  ${c.addr.slice(0, 22)}…  est. loss ${c.lossEth} ETH`, 14, dossierY + 16)

      // --- Bottom: ticker + Go Back button ---
      ctx.fillStyle = 'rgba(255,255,255,0.04)'
      ctx.fillRect(0, BTN_Y - 4, W, 38)

      ctx.fillStyle = '#ff8a4d'
      ctx.font = 'bold 9px monospace'
      ctx.textBaseline = 'middle'
      ctx.fillText('ALERT FEED ::', 12, BTN_Y + BTN_H / 2)

      // Scrolling ticker text
      const lineSeed = Math.floor(t / 6) + seedRef.current
      const text = generateTickerLine(lineSeed)
      const fullText = `  ${text}                              `
      ctx.font = '10px monospace'
      const measure = ctx.measureText(fullText).width
      const speed = 40 // px/s
      const offset = (t * speed) % measure
      ctx.save()
      ctx.beginPath()
      ctx.rect(96, BTN_Y, BACK_BTN.x - 96 - 8, BTN_H)
      ctx.clip()
      ctx.fillStyle = 'rgba(220,230,240,0.85)'
      ctx.fillText(fullText, 96 - offset, BTN_Y + BTN_H / 2)
      ctx.fillText(fullText, 96 - offset + measure, BTN_Y + BTN_H / 2)
      ctx.restore()

      // Go Back button
      ctx.fillStyle = 'rgba(0, 255, 255, 0.18)'
      ctx.beginPath()
      ctx.roundRect(BACK_BTN.x, BTN_Y, BACK_BTN.w, BTN_H, BTN_R)
      ctx.fill()
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.55)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(BACK_BTN.x, BTN_Y, BACK_BTN.w, BTN_H, BTN_R)
      ctx.stroke()
      ctx.fillStyle = 'rgba(0, 255, 255, 0.95)'
      ctx.font = '11px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('Go Back', BACK_BTN.x + BACK_BTN.w / 2, BTN_Y + BTN_H / 2 + 1)
      ctx.textAlign = 'left'

      // Outer frame
      ctx.strokeStyle = 'rgba(255,138,77,0.6)'
      ctx.lineWidth = 1
      ctx.strokeRect(2, 2, W - 4, H - 4)

      // CLASSIFIED stamp (subtle, top-right of dossier)
      ctx.save()
      ctx.translate(W - 76, 240)
      ctx.rotate(-0.18)
      ctx.strokeStyle = 'rgba(255,60,60,0.55)'
      ctx.lineWidth = 1.2
      ctx.strokeRect(-32, -8, 70, 16)
      ctx.fillStyle = 'rgba(255,80,80,0.85)'
      ctx.font = 'bold 10px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('CLASSIFIED', 3, 0)
      ctx.restore()
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'

      texture.needsUpdate = true
    }

    const intervalId = setInterval(draw, 80)
    return () => {
      clearInterval(intervalId)
      clearInterval(seedInterval)
      window.removeEventListener('screen3Click', handleScreen3Click)
    }
  }, [])

  return null
}

export default DetectiveScreen
