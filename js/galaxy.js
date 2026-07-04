/* eslint-disable no-redeclare, no-unused-vars */
/* ===== Galaxy (星河动画) — self-contained IIFE ===== */
(function () {
  

  /* ---- DOM refs ---- */
  const $canvas  = document.getElementById('galaxy-canvas')
  if (!$canvas) {return}
  const $viewport = $canvas.parentElement
  const $theme    = document.getElementById('galaxy-theme')
  const $speed    = document.getElementById('galaxy-speed')
  const $count    = document.getElementById('galaxy-count')
  const $interact = document.getElementById('galaxy-interact')
  const $fps      = document.getElementById('galaxy-fps')
  const $pcount   = document.getElementById('galaxy-particles')
  const $panel    = document.getElementById('tool-galaxy')
  const reduceMotionQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null

  const ctx = $canvas.getContext('2d')

  /* ---- Color themes ---- */
  const THEMES = {
    bluePurple: {
      name: '蓝紫',
      clouds: [
        { hue: 275, sat: 75, light: 42, spread: 0.28 },
        { hue: 250, sat: 70, light: 38, spread: 0.24 },
        { hue: 295, sat: 65, light: 35, spread: 0.20 },
        { hue: 220, sat: 60, light: 30, spread: 0.16 },
        { hue: 310, sat: 55, light: 28, spread: 0.13 }
      ],
      bandAngle: -0.55,
      starHueLo: 200, starHueHi: 300
    },
    pinkOrange: {
      name: '粉橙',
      clouds: [
        { hue: 340, sat: 75, light: 42, spread: 0.28 },
        { hue: 10, sat: 70, light: 38, spread: 0.24 },
        { hue: 320, sat: 65, light: 35, spread: 0.20 },
        { hue: 30, sat: 60, light: 30, spread: 0.16 },
        { hue: 350, sat: 55, light: 28, spread: 0.13 }
      ],
      bandAngle: -0.55,
      starHueLo: 320, starHueHi: 30
    },
    cyanGreen: {
      name: '青绿',
      clouds: [
        { hue: 180, sat: 70, light: 38, spread: 0.28 },
        { hue: 160, sat: 65, light: 35, spread: 0.24 },
        { hue: 200, sat: 60, light: 32, spread: 0.20 },
        { hue: 140, sat: 55, light: 28, spread: 0.16 },
        { hue: 220, sat: 50, light: 25, spread: 0.13 }
      ],
      bandAngle: -0.55,
      starHueLo: 140, starHueHi: 220
    },
    rainbow: {
      name: '彩虹',
      clouds: [
        { hue: 280, sat: 70, light: 42, spread: 0.28 },
        { hue: 340, sat: 65, light: 38, spread: 0.24 },
        { hue: 200, sat: 65, light: 35, spread: 0.20 },
        { hue: 160, sat: 60, light: 30, spread: 0.16 },
        { hue: 30, sat: 55, light: 28, spread: 0.13 }
      ],
      bandAngle: -0.55,
      starHueLo: 0, starHueHi: 360
    }
  }

  /* ---- State ---- */
  let themeKey    = 'bluePurple'
  let speedMul    = 1
  let targetCount = 1000
  let interactMode = 'attract'
  let running     = false
  let rafId       = null
  const mouse       = { x: -9999, y: -9999, active: false }
  let time        = 0

  /* Star field */
  let stars = []

  /* Milky way band — cached */
  let bandCache = null
  let bandCacheKey = ''

  /* Shooting stars */
  const shootingStars = []

  /* Mouse trail */
  let trail = []

  /* FPS */
  let fpsFrames = 0, fpsTime = 0, fpsVal = 0

  /* ---- Helpers ---- */
  function rand(a, b) { return Math.random() * (b - a) + a }
  function lerp(a, b, t) { return a + (b - a) * t }

  /* random hue that wraps around 360 when lo > hi */
  function randHue(lo, hi) {
    if (hi >= lo) {return rand(lo, hi)}
    return lo + Math.random() * ((hi + 360) - lo) % 360
  }

  function prefersReducedMotion() {
    return !!(reduceMotionQuery && reduceMotionQuery.matches)
  }

  function isPanelVisible() {
    return !$panel || !$panel.hidden
  }

  /* ---- Resize ---- */
  let cw = 0, ch = 0, cx = 0, cy = 0

  function resize() {
    const rect = $viewport.getBoundingClientRect()
    cw = rect.width
    ch = rect.height
    if (cw < 1 || ch < 1) {return}
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    $canvas.width  = cw * dpr
    $canvas.height = ch * dpr
    $canvas.style.width  = cw + 'px'
    $canvas.style.height = ch + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    cx = cw / 2
    cy = ch / 2
    bandCacheKey = ''
    initStars()
  }

  /* ============================================================
     STAR FIELD — scattered twinkling stars of varying brightness
     ============================================================ */
  function initStars() {
    stars = []
    const area = cw * ch
    /* layer 1: many tiny dim background specks */
    const dimCount = Math.min(Math.floor(area / 120), 4000)
    for (let i = 0; i < dimCount; i++) {
      stars.push({
        x: rand(0, cw), y: rand(0, ch),
        r: rand(0.2, 0.5),
        brightness: rand(0.05, 0.25),
        twinkleSpeed: rand(0.2, 1.5),
        twinklePhase: rand(0, Math.PI * 2),
        hue: rand(200, 280),
        ox: 0, oy: 0
      })
    }
    /* layer 2: medium stars */
    const midCount = Math.min(Math.floor(area / 400), 600)
    for (let i = 0; i < midCount; i++) {
      stars.push({
        x: rand(0, cw), y: rand(0, ch),
        r: rand(0.6, 1.2),
        brightness: rand(0.3, 0.65),
        twinkleSpeed: rand(0.3, 2.0),
        twinklePhase: rand(0, Math.PI * 2),
        hue: rand(200, 280),
        ox: 0, oy: 0
      })
    }
    /* layer 3: bright stars with glow */
    const brightCount = Math.min(Math.floor(area / 3000), 80)
    for (let i = 0; i < brightCount; i++) {
      stars.push({
        x: rand(0, cw), y: rand(0, ch),
        r: rand(1.4, 2.5),
        brightness: rand(0.7, 0.95),
        twinkleSpeed: rand(0.4, 2.0),
        twinklePhase: rand(0, Math.PI * 2),
        hue: rand(200, 280),
        ox: 0, oy: 0
      })
    }
    /* layer 4: very bright stars with cross rays */
    const vBrightCount = Math.min(Math.floor(area / 15000), 15)
    for (let i = 0; i < vBrightCount; i++) {
      stars.push({
        x: rand(0, cw), y: rand(0, ch),
        r: rand(2.5, 3.5),
        brightness: rand(0.9, 1.0),
        twinkleSpeed: rand(0.3, 1.2),
        twinklePhase: rand(0, Math.PI * 2),
        hue: rand(200, 280),
        ox: 0, oy: 0
      })
    }
  }

  function drawStars() {
    /* dim stars — individual fillRect with per-star twinkle */
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i]
      if (s.r >= 0.6) {continue}
      const tw = (Math.sin(time * s.twinkleSpeed + s.twinklePhase) + 1) * 0.5
      const alpha = lerp(0.03, s.brightness, tw)
      if (alpha < 0.06) {continue}
      ctx.fillStyle = 'hsla(220, 20%, 92%, ' + alpha + ')'
      ctx.fillRect(s.x + s.ox, s.y + s.oy, s.r, s.r)
    }

    /* medium and bright stars individually */
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i]
      if (s.r < 0.6) {continue}
      const tw = (Math.sin(time * s.twinkleSpeed + s.twinklePhase) + 1) * 0.5
      const alpha = lerp(0.04, s.brightness, tw)
      const x = s.x + s.ox
      const y = s.y + s.oy

      /* glow halo for medium+ stars */
      if (s.r > 0.9 && alpha > 0.3) {
        ctx.beginPath()
        ctx.arc(x, y, s.r * 6, 0, Math.PI * 2)
        ctx.fillStyle = 'hsla(' + s.hue + ', 35%, 90%, ' + (alpha * 0.08) + ')'
        ctx.fill()

        /* strong diffraction spikes for very bright stars */
        if (s.r > 2.0 && alpha > 0.6) {
          const spikeLen = s.r * 10
          ctx.strokeStyle = 'hsla(' + s.hue + ', 30%, 92%, ' + (alpha * 0.22) + ')'
          ctx.lineWidth = 0.7
          ctx.beginPath()
          ctx.moveTo(x - spikeLen, y); ctx.lineTo(x + spikeLen, y)
          ctx.moveTo(x, y - spikeLen); ctx.lineTo(x, y + spikeLen)
          ctx.stroke()
          const sl2 = spikeLen * 0.5
          ctx.strokeStyle = 'hsla(' + s.hue + ', 25%, 90%, ' + (alpha * 0.1) + ')'
          ctx.lineWidth = 0.4
          ctx.beginPath()
          ctx.moveTo(x - sl2, y - sl2); ctx.lineTo(x + sl2, y + sl2)
          ctx.moveTo(x + sl2, y - sl2); ctx.lineTo(x - sl2, y + sl2)
          ctx.stroke()
        }
      }

      /* core */
      ctx.beginPath()
      ctx.arc(x, y, s.r, 0, Math.PI * 2)
      ctx.fillStyle = 'hsla(' + s.hue + ', 15%, 97%, ' + alpha + ')'
      ctx.fill()
    }
  }

  /* ============================================================
     MILKY WAY BAND — diagonal nebula glow (cached)
     ============================================================ */
  function buildBandCache() {
    const theme = THEMES[themeKey]
    const key = cw + ',' + ch + ',' + themeKey
    if (bandCache && bandCacheKey === key) {return}
    bandCacheKey = key
    if (!bandCache) {bandCache = document.createElement('canvas')}
    bandCache.width = $canvas.width
    bandCache.height = $canvas.height
    const bc = bandCache.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    bc.setTransform(dpr, 0, 0, dpr, 0, 0)

    const angle = theme.bandAngle
    const diag = Math.sqrt(cw * cw + ch * ch)
    const bandCx = cw * 0.48
    const bandCy = ch * 0.52
    const perpX = -Math.sin(angle)
    const perpY = Math.cos(angle)

    /* hue gradient: left end → right end across the band */
    const hueStart = theme.clouds[0].hue - 35
    const hueEnd   = theme.clouds[0].hue + 65

    function hueAt(tNorm) {
      return hueStart + (hueEnd - hueStart) * (tNorm + 0.5)
    }

    /* width variation along band (natural bulges) */
    function bandWidthMul(t) {
      return 1.0 + 0.3 * Math.sin(t * 4.5 + 0.8) + 0.15 * Math.sin(t * 8.3 + 2.1)
    }

    /* --- Layer 0: continuous smooth backbone strokes --- */
    for (let pass = 0; pass < 3; pass++) {
      const w = diag * (0.18 - pass * 0.04)
      const alpha = [0.06, 0.04, 0.025][pass]
      const steps = 50
      for (let si = 0; si <= steps; si++) {
        const t = (si / steps) - 0.5
        const bw = w * bandWidthMul(t)
        const bx = bandCx + Math.cos(angle) * t * diag * 0.82
        const by = bandCy + Math.sin(angle) * t * diag * 0.82
        const h = hueAt(t)
        const g = bc.createRadialGradient(bx, by, 0, bx, by, bw)
        g.addColorStop(0, 'hsla(' + h + ', 60%, 40%, ' + alpha + ')')
        g.addColorStop(0.5, 'hsla(' + (h + 15) + ', 50%, 35%, ' + (alpha * 0.4) + ')')
        g.addColorStop(1, 'hsla(' + h + ', 40%, 25%, 0)')
        bc.fillStyle = g
        bc.beginPath()
        bc.arc(bx, by, bw, 0, Math.PI * 2)
        bc.fill()
      }
    }

    /* --- Layer 1: wide atmospheric haze --- */
    for (let si = 0; si <= 40; si++) {
      const t = (si / 40) - 0.5
      const bw = bandWidthMul(t)
      const bx = bandCx + Math.cos(angle) * t * diag * 0.82
      const by = bandCy + Math.sin(angle) * t * diag * 0.82
      const coreR = diag * rand(0.12, 0.2) * bw
      const h = hueAt(t)
      const g = bc.createRadialGradient(bx, by, 0, bx, by, coreR)
      g.addColorStop(0, 'hsla(' + h + ', 50%, 30%, 0.04)')
      g.addColorStop(0.5, 'hsla(' + (h + 15) + ', 40%, 25%, 0.02)')
      g.addColorStop(1, 'hsla(' + h + ', 30%, 20%, 0)')
      bc.fillStyle = g
      bc.beginPath()
      bc.arc(bx, by, coreR, 0, Math.PI * 2)
      bc.fill()
    }

    /* --- Layer 2: main cloud layers (more segments for smoothness) --- */
    for (let ci = 0; ci < theme.clouds.length; ci++) {
      const cloud = theme.clouds[ci]
      const bandWidth = diag * cloud.spread * 1.2

      const segments = 28
      for (let si = 0; si <= segments; si++) {
        const t = (si / segments) - 0.5
        const bw = bandWidthMul(t)
        let bx = bandCx + Math.cos(angle) * t * diag * 0.8
        let by = bandCy + Math.sin(angle) * t * diag * 0.8
        const shift = Math.sin(t * 6 + ci * 2.1) * bandWidth * 0.3 * bw
        bx += perpX * shift
        by += perpY * shift

        const rx = bandWidth * bw * rand(0.6, 1.15)
        const ry = bandWidth * bw * rand(0.3, 0.55)
        const h = hueAt(t) + rand(-8, 8)
        const s = cloud.sat
        const l = cloud.light

        const g = bc.createRadialGradient(bx, by, 0, bx, by, rx)
        g.addColorStop(0, 'hsla(' + h + ',' + s + '%,' + l + '%, 0.18)')
        g.addColorStop(0.12, 'hsla(' + (h + 6) + ',' + (s - 2) + '%,' + (l - 2) + '%, 0.13)')
        g.addColorStop(0.35, 'hsla(' + (h + 15) + ',' + (s - 5) + '%,' + (l - 5) + '%, 0.06)')
        g.addColorStop(1, 'hsla(' + h + ',' + s + '%,' + l + '%, 0)')

        bc.save()
        bc.translate(bx, by)
        bc.rotate(angle + rand(-0.08, 0.08))
        bc.scale(1, ry / rx)
        bc.beginPath()
        bc.arc(0, 0, rx, 0, Math.PI * 2)
        bc.fillStyle = g
        bc.fill()
        bc.restore()
      }
    }

    /* --- Layer 3: bright dense core --- */
    for (let si = 0; si <= 45; si++) {
      const t = (si / 45) - 0.5
      const bw = bandWidthMul(t)
      let bx = bandCx + Math.cos(angle) * t * diag * 0.72
      let by = bandCy + Math.sin(angle) * t * diag * 0.72
      const shift = Math.sin(t * 3.5) * diag * 0.015
      bx += perpX * shift
      by += perpY * shift
      const coreR = diag * rand(0.025, 0.065) * bw
      const h = hueAt(t) + rand(-6, 6)
      const g = bc.createRadialGradient(bx, by, 0, bx, by, coreR)
      g.addColorStop(0, 'hsla(' + h + ', 70%, 55%, 0.14)')
      g.addColorStop(0.25, 'hsla(' + (h + 10) + ', 60%, 48%, 0.07)')
      g.addColorStop(1, 'hsla(' + h + ', 40%, 30%, 0)')
      bc.fillStyle = g
      bc.beginPath()
      bc.arc(bx, by, coreR, 0, Math.PI * 2)
      bc.fill()
    }

    /* --- Layer 4: scattered bright nebula knots --- */
    for (let ki = 0; ki < 18; ki++) {
      const t = rand(-0.42, 0.42)
      const bw = bandWidthMul(t)
      const spread = rand(-diag * 0.06, diag * 0.06) * bw
      const bx = bandCx + Math.cos(angle) * t * diag * 0.72 + perpX * spread
      const by = bandCy + Math.sin(angle) * t * diag * 0.72 + perpY * spread
      const coreR = diag * rand(0.012, 0.035)
      const h = hueAt(t) + rand(-12, 12)
      const g = bc.createRadialGradient(bx, by, 0, bx, by, coreR)
      g.addColorStop(0, 'hsla(' + h + ', 80%, 60%, 0.18)')
      g.addColorStop(0.3, 'hsla(' + (h + 8) + ', 65%, 50%, 0.08)')
      g.addColorStop(1, 'hsla(' + h + ', 50%, 35%, 0)')
      bc.fillStyle = g
      bc.beginPath()
      bc.arc(bx, by, coreR, 0, Math.PI * 2)
      bc.fill()
    }

    /* --- Layer 5: warm golden/white center highlights --- */
    for (let si = 0; si <= 30; si++) {
      const t = (si / 30) - 0.5
      const bw = bandWidthMul(t)
      let bx = bandCx + Math.cos(angle) * t * diag * 0.72
      let by = bandCy + Math.sin(angle) * t * diag * 0.72
      const shift = Math.sin(t * 3) * diag * 0.01
      bx += perpX * shift
      by += perpY * shift
      const coreR = diag * rand(0.015, 0.035) * bw
      /* warm white/golden hue */
      const h = hueAt(t) * 0.3 + 40
      const g = bc.createRadialGradient(bx, by, 0, bx, by, coreR)
      g.addColorStop(0, 'hsla(' + h + ', 40%, 80%, 0.08)')
      g.addColorStop(0.4, 'hsla(' + (h + 10) + ', 30%, 65%, 0.04)')
      g.addColorStop(1, 'hsla(' + h + ', 20%, 50%, 0)')
      bc.fillStyle = g
      bc.beginPath()
      bc.arc(bx, by, coreR, 0, Math.PI * 2)
      bc.fill()
    }

    /* --- Layer 6: edge softening (very wide, very faint) --- */
    for (let si = 0; si <= 20; si++) {
      const t = (si / 20) - 0.5
      const bw = bandWidthMul(t)
      const bx = bandCx + Math.cos(angle) * t * diag * 0.85
      const by = bandCy + Math.sin(angle) * t * diag * 0.85
      const coreR = diag * rand(0.2, 0.35) * bw
      const h = hueAt(t)
      const g = bc.createRadialGradient(bx, by, 0, bx, by, coreR)
      g.addColorStop(0, 'hsla(' + h + ', 35%, 25%, 0.025)')
      g.addColorStop(0.6, 'hsla(' + (h + 10) + ', 25%, 20%, 0.01)')
      g.addColorStop(1, 'hsla(' + h + ', 20%, 15%, 0)')
      bc.fillStyle = g
      bc.beginPath()
      bc.arc(bx, by, coreR, 0, Math.PI * 2)
      bc.fill()
    }
  }

  function drawBand() {
    buildBandCache()
    if (bandCache) {
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(bandCache, 0, 0)
      ctx.restore()
    }
  }

  /* ============================================================
     PARTICLE FIELD — small glowing dots scattered in the band
     ============================================================ */
  let particles = []
  const MAX_PARTICLES = 5000

  function spawnParticle() {
    const theme = THEMES[themeKey]
    const angle = theme.bandAngle
    const diag = Math.sqrt(cw * cw + ch * ch)
    const bandCx = cw * 0.48
    const bandCy = ch * 0.52
    const t = rand(-0.45, 0.45)
    /* gaussian-like concentration near band center */
    const spread = (rand(-1, 1) + rand(-1, 1)) * diag * 0.055
    const x = bandCx + Math.cos(angle) * t * diag * 0.75 + (-Math.sin(angle)) * spread
    const y = bandCy + Math.sin(angle) * t * diag * 0.75 + Math.cos(angle) * spread
    const hue = randHue(theme.starHueLo, theme.starHueHi)
    return {
      x: x, y: y,
      baseX: x, baseY: y,
      size: rand(0.4, 2.0),
      hue: hue,
      sat: rand(30, 80),
      light: rand(50, 85),
      alpha: rand(0.3, 0.9),
      twinkleSpeed: rand(0.3, 3),
      twinklePhase: rand(0, Math.PI * 2),
      ox: 0, oy: 0,
      /* slow drift */
      dx: rand(-0.08, 0.08),
      dy: rand(-0.03, 0.03)
    }
  }

  function ensureParticles() {
    while (particles.length < targetCount && particles.length < MAX_PARTICLES) {
      particles.push(spawnParticle())
    }
    while (particles.length > targetCount) {
      particles.pop()
    }
  }

  function drawParticle(p) {
    p.baseX += p.dx * speedMul
    p.baseY += p.dy * speedMul

    /* wrap around */
    if (p.baseX < -20) {p.baseX = cw + 20}
    if (p.baseX > cw + 20) {p.baseX = -20}
    if (p.baseY < -20) {p.baseY = ch + 20}
    if (p.baseY > ch + 20) {p.baseY = -20}

    /* mouse interaction */
    if (interactMode !== 'none' && mouse.active) {
      const dx = p.baseX - mouse.x
      const dy = p.baseY - mouse.y
      const d2 = dx * dx + dy * dy
      const radius = 150
      if (d2 < radius * radius) {
        const d = Math.sqrt(d2) || 1
        const force = (1 - d / radius) * 25
        const dir = interactMode === 'attract' ? -1 : 1
        p.ox += (dx / d) * force * dir * 0.06
        p.oy += (dy / d) * force * dir * 0.06
      }
    }
    p.ox *= 0.94
    p.oy *= 0.94

    const x = p.baseX + p.ox
    const y = p.baseY + p.oy

    const tw = (Math.sin(time * p.twinkleSpeed + p.twinklePhase) + 1) * 0.5
    const alpha = lerp(0.1, p.alpha, tw)

    /* glow for larger particles */
    if (p.size > 1.2 && alpha > 0.4) {
      ctx.beginPath()
      ctx.arc(x, y, p.size * 3, 0, Math.PI * 2)
      ctx.fillStyle = 'hsla(' + p.hue + ',' + p.sat + '%,' + p.light + '%,' + (alpha * 0.12) + ')'
      ctx.fill()
    }

    /* core */
    ctx.beginPath()
    ctx.arc(x, y, p.size, 0, Math.PI * 2)
    ctx.fillStyle = 'hsla(' + p.hue + ',' + p.sat + '%,' + p.light + '%,' + alpha + ')'
    ctx.fill()
  }

  /* ============================================================
     SHOOTING STARS
     ============================================================ */
  function maybeSpawnShootingStar() {
    if (Math.random() > 0.004 * speedMul) {return}
    const fromLeft = Math.random() < 0.5
    shootingStars.push({
      x: fromLeft ? rand(0, cw * 0.3) : rand(cw * 0.7, cw),
      y: rand(0, ch * 0.4),
      vx: fromLeft ? rand(2, 5) : rand(-5, -2),
      vy: rand(1, 4),
      life: 1,
      decay: rand(0.008, 0.02),
      hue: rand(200, 300),
      len: rand(30, 80)
    })
  }

  function drawShootingStars() {
    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const s = shootingStars[i]
      s.x += s.vx * speedMul
      s.y += s.vy * speedMul
      s.life -= s.decay * speedMul
      if (s.life <= 0) { shootingStars.splice(i, 1); continue }

      const tailX = s.x - s.vx * s.len * 0.15
      const tailY = s.y - s.vy * s.len * 0.15
      const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y)
      grad.addColorStop(0, 'hsla(' + s.hue + ', 60%, 80%, 0)')
      grad.addColorStop(0.7, 'hsla(' + s.hue + ', 80%, 90%, ' + (s.life * 0.6) + ')')
      grad.addColorStop(1, 'hsla(' + s.hue + ', 100%, 98%, ' + s.life + ')')

      ctx.beginPath()
      ctx.moveTo(tailX, tailY)
      ctx.lineTo(s.x, s.y)
      ctx.strokeStyle = grad
      ctx.lineWidth = 1.5
      ctx.stroke()

      /* head glow */
      ctx.beginPath()
      ctx.arc(s.x, s.y, 2, 0, Math.PI * 2)
      ctx.fillStyle = 'hsla(' + s.hue + ', 100%, 98%, ' + s.life + ')'
      ctx.fill()
    }
  }

  /* ============================================================
     MOUSE TRAIL
     ============================================================ */
  function drawMouseTrail() {
    if (!mouse.active || interactMode === 'none') { trail = []; return }
    trail.push({ x: mouse.x, y: mouse.y, life: 1 })
    if (trail.length > 25) {trail.shift()}
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i]
      t.life -= 0.04
      if (t.life <= 0) {continue}
      const hue = THEMES[themeKey].clouds[0].hue + i * 5
      ctx.beginPath()
      ctx.arc(t.x, t.y, 1.5 + i * 0.08, 0, Math.PI * 2)
      ctx.fillStyle = 'hsla(' + hue + ', 70%, 70%, ' + (t.life * 0.25) + ')'
      ctx.fill()
    }
    trail = trail.filter(function (t) { return t.life > 0 })
  }

  /* ============================================================
     MAIN LOOP
     ============================================================ */
  function render(ts) {
    time = ts / 1000

    /* FPS */
    fpsFrames++
    if (ts - fpsTime >= 1000) {
      fpsVal = fpsFrames
      fpsFrames = 0
      fpsTime = ts
      if ($fps) {$fps.textContent = fpsVal + ' FPS'}
    }

    /* clear to pure black */
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, cw, ch)

    /* milky way band (additive) */
    ctx.globalCompositeOperation = 'lighter'
    drawBand()

    /* background star field */
    ctx.globalCompositeOperation = 'source-over'
    drawStars()

    /* particles in the band */
    ctx.globalCompositeOperation = 'lighter'
    ensureParticles()
    for (let i = 0; i < particles.length; i++) {
      drawParticle(particles[i])
    }

    /* shooting stars */
    ctx.globalCompositeOperation = 'source-over'
    maybeSpawnShootingStar()
    drawShootingStars()
    drawMouseTrail()

    /* particle count */
    if ($pcount) {$pcount.textContent = (stars.length + particles.length) + ' 星'}
  }

  function frame(ts) {
    if (!running) {return}
    rafId = requestAnimationFrame(frame)
    render(ts)
  }

  /* ---- Start / Stop ---- */
  function drawStaticFrame() {
    stop()
    resize()
    ensureParticles()
    render((window.performance && window.performance.now) ? window.performance.now() : 0)
    if ($fps) {$fps.textContent = '动画已按系统偏好暂停'}
  }

  function start() {
    if (running) {return}
    if (prefersReducedMotion()) {
      drawStaticFrame()
      return
    }
    running = true
    resize()
    ensureParticles()
    if (!rafId) {rafId = requestAnimationFrame(frame)}
  }

  function stop() {
    running = false
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
  }

  function rebuild() {
    particles = []
    ensureParticles()
    if (prefersReducedMotion() && isPanelVisible()) {drawStaticFrame()}
  }

  function handleReducedMotionChange() {
    if (!isPanelVisible()) {return}
    if (prefersReducedMotion()) {
      drawStaticFrame()
    } else {
      start()
    }
  }

  /* ---- Event bindings ---- */
  if ($theme) {
    $theme.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-galaxy-theme]')
      if (!btn) {return}
      themeKey = btn.getAttribute('data-galaxy-theme')
      bandCacheKey = ''
      $theme.querySelectorAll('.galaxy-theme-btn').forEach(function (b) {
        b.classList.toggle('active', b === btn)
      })
      /* recolor stars to match theme */
      const theme = THEMES[themeKey]
      for (let i = 0; i < stars.length; i++) {
        stars[i].hue = randHue(theme.starHueLo, theme.starHueHi)
      }
      for (let i = 0; i < particles.length; i++) {
        particles[i].hue = randHue(theme.starHueLo, theme.starHueHi)
      }
      if (prefersReducedMotion() && isPanelVisible()) {drawStaticFrame()}
    })
  }

  if ($speed) {
    $speed.addEventListener('input', function () {
      speedMul = parseFloat($speed.value) || 1
      const label = document.getElementById('galaxy-speed-val')
      if (label) {label.textContent = speedMul.toFixed(1) + 'x'}
    })
  }

  if ($count) {
    $count.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-galaxy-count]')
      if (!btn) {return}
      targetCount = parseInt(btn.getAttribute('data-galaxy-count'), 10)
      $count.querySelectorAll('.galaxy-count-btn').forEach(function (b) {
        b.classList.toggle('active', b === btn)
      })
      rebuild()
    })
  }

  if ($interact) {
    $interact.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-galaxy-interact]')
      if (!btn) {return}
      interactMode = btn.getAttribute('data-galaxy-interact')
      $interact.querySelectorAll('.galaxy-interact-btn').forEach(function (b) {
        b.classList.toggle('active', b === btn)
      })
    })
  }

  /* Mouse tracking */
  $canvas.addEventListener('mousemove', function (e) {
    const rect = $canvas.getBoundingClientRect()
    mouse.x = e.clientX - rect.left
    mouse.y = e.clientY - rect.top
    mouse.active = true
  })
  $canvas.addEventListener('mouseleave', function () {
    mouse.active = false
    mouse.x = -9999; mouse.y = -9999
  })

  /* Touch */
  $canvas.addEventListener('touchmove', function (e) {
    e.preventDefault()
    const touch = e.touches[0]
    const rect = $canvas.getBoundingClientRect()
    mouse.x = touch.clientX - rect.left
    mouse.y = touch.clientY - rect.top
    mouse.active = true
  }, { passive: false })
  $canvas.addEventListener('touchend', function () { mouse.active = false })

  /* Resize */
  let resizeTimer = null
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(function () {
      if (prefersReducedMotion() && isPanelVisible()) {drawStaticFrame(); return}
      resize()
    }, 150)
  })

  /* Pause when tab hidden */
  if ($panel) {
    new MutationObserver(function () {
      if ($panel.hidden) { stop(); return }
      if (prefersReducedMotion()) { drawStaticFrame(); return }
      requestAnimationFrame(function () { resize(); start() })
    }).observe($panel, { attributes: true, attributeFilter: ['hidden'] })
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {stop()}
    else if (isPanelVisible()) {start()}
  })

  window.addEventListener('beforeunload', stop)

  if (reduceMotionQuery) {
    if (typeof reduceMotionQuery.addEventListener === 'function') {
      reduceMotionQuery.addEventListener('change', handleReducedMotionChange)
    } else if (typeof reduceMotionQuery.addListener === 'function') {
      reduceMotionQuery.addListener(handleReducedMotionChange)
    }
  }

  /* ---- Auto-start ---- */
  if (isPanelVisible()) {
    start()
  }
})()
