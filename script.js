(() => {
  const $ = (selector, root = document) => root.querySelector(selector)
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n))
  const lerp = (a, b, t) => a + (b - a) * t

  function hashString(value) {
    let h = 2166136261
    for (let i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return h >>> 0
  }

  function mulberry32(seed) {
    return function random() {
      let t = seed += 0x6D2B79F5
      t = Math.imul(t ^ t >>> 15, t | 1)
      t ^= t + Math.imul(t ^ t >>> 7, t | 61)
      return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
  }

  const marianaSeed = hashString('Mariana Machado 31102026')
  const rand = mulberry32(marianaSeed)
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  document.body.classList.add('locked')

  const gate = $('#gate')
  const enterButton = $('#enterButton')
  const experience = $('#experience')
  const soundButton = $('#soundButton')
  const flowerCountEl = $('#flowerCount')
  const progressBar = $('#progressBar')

  const visitKey = 'marianaFloresceVisits'
  const wishKey = 'marianaFloresceWish'

  const safeStorage = {
    get(key) {
      try { return window.localStorage.getItem(key) } catch { return null }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, value) } catch { /* modo privado ou arquivo local */ }
    }
  }

  const visits = Number(safeStorage.get(visitKey) || 0)
  safeStorage.set(visitKey, String(visits + 1))

  if (visits > 0) {
    $('.microcopy').textContent = 'você voltou e o jardim lembrou de você'
  }

  const today = new Date()
  if (today.getMonth() === 9 && today.getDate() === 31) {
    $('.microcopy').textContent = 'o jardim esperou até hoje para abrir'
  }

  let audioEngine = null
  let soundOn = false

  function createAmbientAudio() {
    if (audioEngine) return audioEngine
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return null

    const ctx = new AudioContext()
    const master = ctx.createGain()
    master.gain.value = 0.0001
    master.connect(ctx.destination)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 780
    filter.Q.value = 0.4
    filter.connect(master)

    const voices = [
      { f: 110, type: 'sine', gain: 0.028 },
      { f: 164.81, type: 'sine', gain: 0.018 },
      { f: 220, type: 'triangle', gain: 0.009 }
    ]

    const nodes = voices.map((voice, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const lfo = ctx.createOscillator()
      const lfoGain = ctx.createGain()
      osc.type = voice.type
      osc.frequency.value = voice.f
      gain.gain.value = voice.gain
      lfo.type = 'sine'
      lfo.frequency.value = 0.03 + i * 0.013
      lfoGain.gain.value = voice.f * 0.012
      lfo.connect(lfoGain)
      lfoGain.connect(osc.frequency)
      osc.connect(gain)
      gain.connect(filter)
      osc.start()
      lfo.start()
      return { osc, gain, lfo, lfoGain }
    })

    const shimmer = ctx.createOscillator()
    const shimmerGain = ctx.createGain()
    shimmer.type = 'sine'
    shimmer.frequency.value = 659.25
    shimmerGain.gain.value = 0.0018
    shimmer.connect(shimmerGain)
    shimmerGain.connect(master)
    shimmer.start()

    audioEngine = { ctx, master, nodes, shimmer, shimmerGain }
    return audioEngine
  }

  async function setSound(enabled) {
    const engine = createAmbientAudio()
    if (!engine) return
    if (engine.ctx.state === 'suspended') await engine.ctx.resume()
    soundOn = enabled
    const now = engine.ctx.currentTime
    engine.master.gain.cancelScheduledValues(now)
    engine.master.gain.setValueAtTime(Math.max(engine.master.gain.value, 0.0001), now)
    engine.master.gain.exponentialRampToValueAtTime(enabled ? 0.68 : 0.0001, now + 1.2)
    soundButton.classList.toggle('active', enabled)
    $('.sound-label').textContent = enabled ? 'som vivo' : 'som'
  }

  soundButton.addEventListener('click', () => setSound(!soundOn))

  enterButton.addEventListener('click', async () => {
    gate.classList.add('leaving')
    document.body.classList.add('entered')
    document.body.classList.remove('locked')
    experience.setAttribute('aria-hidden', 'false')
    if (!reducedMotion) await setSound(true)
    setTimeout(() => $('#sceneHero').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' }), 320)
  })

  window.addEventListener('scroll', () => {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    const p = clamp(window.scrollY / maxScroll, 0, 1)
    progressBar.style.width = `${p * 100}%`
  }, { passive: true })

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return
      const delay = Number(entry.target.dataset.delay || 0)
      setTimeout(() => entry.target.classList.add('visible'), delay)
      revealObserver.unobserve(entry.target)
    })
  }, { threshold: 0.16 })

  $$('.reveal').forEach((el, index) => {
    el.dataset.delay = String((index % 4) * 80)
    revealObserver.observe(el)
  })

  // Noite viva
  const nightCanvas = $('#nightCanvas')
  const nctx = nightCanvas.getContext('2d')
  let nw = 0
  let nh = 0
  let ndpr = 1
  let motes = []

  function resizeNight() {
    ndpr = Math.min(window.devicePixelRatio || 1, 2)
    nw = window.innerWidth
    nh = window.innerHeight
    nightCanvas.width = nw * ndpr
    nightCanvas.height = nh * ndpr
    nightCanvas.style.width = `${nw}px`
    nightCanvas.style.height = `${nh}px`
    nctx.setTransform(ndpr, 0, 0, ndpr, 0, 0)
    motes = Array.from({ length: Math.min(100, Math.floor(nw * nh / 15000)) }, (_, i) => ({
      x: rand() * nw,
      y: rand() * nh,
      r: 0.35 + rand() * 1.45,
      a: 0.05 + rand() * 0.32,
      vy: 0.025 + rand() * 0.11,
      sway: rand() * Math.PI * 2,
      phase: rand() * Math.PI * 2,
      firefly: i % 13 === 0
    }))
  }

  function drawNight(time) {
    nctx.clearRect(0, 0, nw, nh)
    motes.forEach(m => {
      m.y -= m.vy
      m.x += Math.sin(time * 0.0002 + m.sway) * 0.045
      if (m.y < -5) { m.y = nh + 5; m.x = rand() * nw }
      const pulse = m.firefly ? 0.4 + Math.sin(time * 0.002 + m.phase) * 0.35 : 1
      nctx.beginPath()
      nctx.fillStyle = m.firefly ? `rgba(218,205,133,${m.a * pulse})` : `rgba(201,222,195,${m.a})`
      nctx.arc(m.x, m.y, m.r * (m.firefly ? 1.8 : 1), 0, Math.PI * 2)
      nctx.fill()
      if (m.firefly) {
        const glow = nctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 14)
        glow.addColorStop(0, `rgba(225,207,129,${0.13 * pulse})`)
        glow.addColorStop(1, 'rgba(225,207,129,0)')
        nctx.fillStyle = glow
        nctx.fillRect(m.x - 14, m.y - 14, 28, 28)
      }
    })
    requestAnimationFrame(drawNight)
  }

  resizeNight()
  requestAnimationFrame(drawNight)

  // Jardim procedural que responde ao toque
  const gardenCanvas = $('#gardenCanvas')
  const gctx = gardenCanvas.getContext('2d')
  let gw = 0
  let gh = 0
  let gdpr = 1
  let flowers = []
  let flowerCount = 0
  let lastSpawn = { x: -999, y: -999 }
  let pointer = { x: gw / 2, y: gh / 2, active: false, movedAt: 0 }

  const flowerPalettes = [
    ['205,225,199', '223,205,211', '217,194,126'],
    ['169,199,164', '198,216,190', '235,223,185'],
    ['203,184,195', '232,215,220', '213,190,121'],
    ['151,186,192', '198,219,214', '226,205,145']
  ]

  function resizeGarden() {
    gdpr = Math.min(window.devicePixelRatio || 1, 2)
    gw = window.innerWidth
    gh = window.innerHeight
    gardenCanvas.width = gw * gdpr
    gardenCanvas.height = gh * gdpr
    gardenCanvas.style.width = `${gw}px`
    gardenCanvas.style.height = `${gh}px`
    gctx.setTransform(gdpr, 0, 0, gdpr, 0, 0)
  }

  function spawnFlower(x, y, special = false) {
    if (!document.body.classList.contains('entered')) return
    const local = mulberry32(hashString(`${Math.floor(x)} ${Math.floor(y)} ${marianaSeed} ${flowerCount}`))
    const palette = flowerPalettes[Math.floor(local() * flowerPalettes.length)]
    flowers.push({
      x, y,
      born: performance.now(),
      life: special ? 16000 : 10000 + local() * 6000,
      size: (special ? 1.5 : 0.75) * (16 + local() * 22),
      petals: 5 + Math.floor(local() * 5),
      angle: local() * Math.PI * 2,
      stem: 18 + local() * 58,
      lean: (local() - .5) * 18,
      palette,
      special,
      local
    })
    flowerCount += 1
    flowerCountEl.textContent = flowerCount.toLocaleString('pt-BR')
    if (flowers.length > 90) flowers.shift()
  }

  function drawGarden(time) {
    gctx.clearRect(0, 0, gw, gh)
    flowers = flowers.filter(f => time - f.born < f.life)
    flowers.forEach(f => {
      const age = time - f.born
      const grow = clamp(age / 900, 0, 1)
      const fade = 1 - clamp((age - f.life * .74) / (f.life * .26), 0, 1)
      const sway = Math.sin(time * .001 + f.angle) * 2.2
      gctx.save()
      gctx.globalAlpha = fade * .82
      gctx.translate(f.x, f.y)

      gctx.beginPath()
      gctx.strokeStyle = `rgba(${f.palette[0]},${0.42 * fade})`
      gctx.lineWidth = .75
      gctx.moveTo(0, 3)
      gctx.quadraticCurveTo(f.lean * .5 + sway, f.stem * .45, f.lean + sway, f.stem * grow)
      gctx.stroke()

      const headX = 0
      const headY = 0
      gctx.translate(headX, headY)
      gctx.rotate(f.angle * .1)
      for (let p = 0; p < f.petals; p += 1) {
        const a = p / f.petals * Math.PI * 2
        const petalGrow = clamp((grow - p * .015) * 1.2, 0, 1)
        gctx.save()
        gctx.rotate(a)
        gctx.scale(petalGrow, petalGrow)
        gctx.beginPath()
        const length = f.size * (f.special ? 1.12 : 1)
        const width = f.size * .28
        gctx.moveTo(0, 0)
        gctx.bezierCurveTo(width, -length * .28, width * .8, -length * .85, 0, -length)
        gctx.bezierCurveTo(-width * .8, -length * .85, -width, -length * .28, 0, 0)
        gctx.fillStyle = `rgba(${f.palette[1]},${f.special ? .24 : .16})`
        gctx.strokeStyle = `rgba(${f.palette[1]},${f.special ? .55 : .32})`
        gctx.lineWidth = .6
        gctx.fill(); gctx.stroke()
        gctx.restore()
      }

      gctx.beginPath()
      gctx.arc(0, 0, f.size * .14 * grow, 0, Math.PI * 2)
      gctx.fillStyle = `rgba(${f.palette[2]},${.65 * grow})`
      gctx.fill()

      if (f.special) {
        const ring = f.size * (1.2 + Math.sin(time * .002) * .08)
        gctx.beginPath()
        gctx.arc(0, 0, ring, 0, Math.PI * 2)
        gctx.strokeStyle = `rgba(${f.palette[2]},${.13 * fade})`
        gctx.stroke()
      }
      gctx.restore()
    })

    if (pointer.active) {
      const glow = gctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 38)
      glow.addColorStop(0, 'rgba(221,234,213,.12)')
      glow.addColorStop(1, 'rgba(221,234,213,0)')
      gctx.fillStyle = glow
      gctx.fillRect(pointer.x - 38, pointer.y - 38, 76, 76)
    }

    requestAnimationFrame(drawGarden)
  }

  function pointerMove(e) {
    pointer.x = e.clientX
    pointer.y = e.clientY
    pointer.active = true
    pointer.movedAt = performance.now()
    const distance = Math.hypot(pointer.x - lastSpawn.x, pointer.y - lastSpawn.y)
    if (distance > 95 && flowerCount < 180) {
      spawnFlower(pointer.x, pointer.y)
      lastSpawn = { x: pointer.x, y: pointer.y }
    }
  }

  window.addEventListener('pointermove', pointerMove, { passive: true })
  window.addEventListener('pointerdown', e => {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; pointer.movedAt = performance.now()
    spawnFlower(e.clientX, e.clientY, true)
  }, { passive: true })

  setInterval(() => {
    if (!pointer.active || !document.body.classList.contains('entered')) return
    if (performance.now() - pointer.movedAt > 1800) {
      spawnFlower(pointer.x + (rand() - .5) * 20, pointer.y + (rand() - .5) * 20, true)
      pointer.movedAt = performance.now()
    }
  }, 1900)

  resizeGarden()
  requestAnimationFrame(drawGarden)

  // Semente pessoal
  const seedForm = $('#seedForm')
  const seedInput = $('#seedInput')
  const plantedMessage = $('#plantedMessage')
  const seedFlowerStage = $('#seedFlowerStage')
  const savedWish = safeStorage.get(wishKey)

  if (savedWish) {
    plantedMessage.textContent = `o jardim ainda guarda ${savedWish}`
    seedInput.value = savedWish
    growSeedFlower(savedWish, true)
  }

  function growSeedFlower(value, instant = false) {
    seedFlowerStage.innerHTML = ''
    const seed = hashString(value + ' Mariana')
    const r = mulberry32(seed)
    const petals = 5 + Math.floor(r() * 6)
    const plant = document.createElement('div')
    plant.className = 'seed-generated'
    if (instant) plant.style.animationDuration = '.01ms'
    const head = document.createElement('span')
    head.className = 'head'
    for (let i = 0; i < petals; i += 1) {
      const petal = document.createElement('i')
      petal.style.transform = `rotate(${i * (360 / petals)}deg)`
      petal.style.background = i % 2 ? 'rgba(205,220,198,.6)' : 'rgba(222,204,213,.58)'
      head.appendChild(petal)
    }
    head.appendChild(document.createElement('b'))
    plant.appendChild(head)
    seedFlowerStage.appendChild(plant)
  }

  seedForm.addEventListener('submit', e => {
    e.preventDefault()
    const value = seedInput.value.trim()
    if (!value) {
      plantedMessage.textContent = 'toda semente precisa de uma pequena intenção'
      return
    }
    safeStorage.set(wishKey, value)
    plantedMessage.textContent = 'algumas coisas não precisam durar para sempre para criarem raízes dentro da gente'
    growSeedFlower(value)
    spawnFlower(window.innerWidth / 2, window.innerHeight / 2, true)
  })

  // Herbário desenhado com a mesma semente de Mariana
  function drawSpecimen(canvas, species, index) {
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height
    const r = mulberry32(hashString(`${species} Mariana Machado ${index}`))
    ctx.clearRect(0, 0, w, h)
    ctx.save()
    ctx.translate(w / 2, h * .92)

    const stemHeight = h * (.62 + r() * .14)
    const lean = (r() - .5) * 95

    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.bezierCurveTo(lean * .1, -stemHeight * .3, lean * .75, -stemHeight * .65, lean, -stemHeight)
    ctx.strokeStyle = 'rgba(149,186,145,.55)'
    ctx.lineWidth = 1.25
    ctx.stroke()

    const leaves = 5 + Math.floor(r() * 4)
    for (let i = 1; i <= leaves; i += 1) {
      const t = i / (leaves + 1)
      const y = -stemHeight * t
      const x = lean * t * (.55 + .45 * t)
      const side = i % 2 ? -1 : 1
      const length = 32 + r() * 34
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(side * (.45 + r() * .5))
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.bezierCurveTo(side * length * .25, -length * .16, side * length * .8, -length * .18, side * length, 0)
      ctx.bezierCurveTo(side * length * .78, length * .15, side * length * .25, length * .13, 0, 0)
      ctx.fillStyle = `rgba(122,163,122,${.07 + r() * .08})`
      ctx.strokeStyle = 'rgba(158,191,152,.32)'
      ctx.lineWidth = .8
      ctx.fill(); ctx.stroke()
      ctx.restore()
    }

    const fx = lean
    const fy = -stemHeight
    const petals = 6 + Math.floor(r() * 6)
    const radius = 44 + r() * 32
    const tones = [
      ['220,204,212', '231,220,220'],
      ['197,216,191', '220,231,213'],
      ['166,194,197', '207,224,218'],
      ['220,203,176', '232,220,193']
    ][index % 4]

    ctx.translate(fx, fy)
    for (let p = 0; p < petals; p += 1) {
      const angle = p / petals * Math.PI * 2 + r() * .08
      ctx.save()
      ctx.rotate(angle)
      const pr = radius * (.8 + r() * .3)
      const pw = 15 + r() * 12
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.bezierCurveTo(pw, -pr * .2, pw * .8, -pr * .78, 0, -pr)
      ctx.bezierCurveTo(-pw * .8, -pr * .78, -pw, -pr * .2, 0, 0)
      ctx.fillStyle = `rgba(${tones[p % 2]},.13)`
      ctx.strokeStyle = `rgba(${tones[p % 2]},.42)`
      ctx.lineWidth = .85
      ctx.fill(); ctx.stroke()
      ctx.restore()
    }
    ctx.beginPath()
    ctx.arc(0, 0, 13 + r() * 8, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(217,194,126,.56)'
    ctx.shadowColor = 'rgba(217,194,126,.18)'
    ctx.shadowBlur = 24
    ctx.fill()
    ctx.restore()
  }

  $$('.specimen').forEach((card, index) => drawSpecimen($('.specimen-canvas', card), card.dataset.species, index))

  // Constelação MARIANA
  const constellationCanvas = $('#constellationCanvas')
  const cctx = constellationCanvas.getContext('2d')
  let cw = 0
  let ch = 0
  let cdpr = 1
  let skyStars = []
  let letterStars = []
  let cPointer = { x: -1000, y: -1000 }

  const glyphs = {
    M: [[[0,1],[0,0],[.5,.58],[1,0],[1,1]]],
    A: [[[0,1],[.5,0],[1,1]], [[.22,.58],[.78,.58]]],
    R: [[[0,1],[0,0],[.72,0],[1,.24],[.72,.48],[0,.48]], [[.56,.48],[1,1]]],
    I: [[[.5,0],[.5,1]], [[.2,0],[.8,0]], [[.2,1],[.8,1]]],
    N: [[[0,1],[0,0],[1,1],[1,0]]]
  }

  function sampleSegment(a, b, count = 3) {
    return Array.from({ length: count }, (_, i) => {
      const t = i / (count - 1)
      return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]
    })
  }

  function createConstellation() {
    cdpr = Math.min(window.devicePixelRatio || 1, 2)
    cw = constellationCanvas.clientWidth
    ch = constellationCanvas.clientHeight
    constellationCanvas.width = cw * cdpr
    constellationCanvas.height = ch * cdpr
    cctx.setTransform(cdpr, 0, 0, cdpr, 0, 0)
    const r = mulberry32(marianaSeed + 871)
    skyStars = Array.from({ length: Math.floor(cw * ch / 7600) }, () => ({
      x: r() * cw, y: r() * ch, s: .4 + r() * 1.3, a: .08 + r() * .32, phase: r() * Math.PI * 2
    }))

    letterStars = []
    const word = 'MARIANA'
    const totalUnits = word.length * 1.18
    const unit = Math.min(cw * .8 / totalUnits, 86)
    const startX = (cw - unit * totalUnits) / 2
    const top = ch * .63
    const glyphHeight = Math.min(ch * .17, unit * 1.45)

    word.split('').forEach((char, charIndex) => {
      const strokes = glyphs[char]
      strokes.forEach(stroke => {
        const points = []
        for (let i = 0; i < stroke.length - 1; i += 1) {
          const sampled = sampleSegment(stroke[i], stroke[i + 1], 4)
          if (i > 0) sampled.shift()
          sampled.forEach(([x, y]) => points.push({
            x: startX + charIndex * unit * 1.18 + x * unit,
            y: top + y * glyphHeight
          }))
        }
        letterStars.push({ points })
      })
    })
  }

  function drawConstellation(time) {
    cctx.clearRect(0, 0, cw, ch)
    skyStars.forEach(s => {
      const pulse = .75 + Math.sin(time * .0012 + s.phase) * .25
      cctx.beginPath(); cctx.arc(s.x, s.y, s.s, 0, Math.PI * 2)
      cctx.fillStyle = `rgba(219,228,214,${s.a * pulse})`; cctx.fill()
    })

    letterStars.forEach(stroke => {
      for (let i = 0; i < stroke.points.length; i += 1) {
        const p = stroke.points[i]
        const d = Math.hypot(cPointer.x - p.x, cPointer.y - p.y)
        const reveal = clamp(1 - d / 260, .16, 1)
        if (i < stroke.points.length - 1) {
          const q = stroke.points[i + 1]
          cctx.beginPath(); cctx.moveTo(p.x, p.y); cctx.lineTo(q.x, q.y)
          cctx.strokeStyle = `rgba(172,201,171,${.08 + reveal * .30})`; cctx.lineWidth = .7; cctx.stroke()
        }
        cctx.beginPath(); cctx.arc(p.x, p.y, 1.4 + reveal * 1.4, 0, Math.PI * 2)
        cctx.fillStyle = `rgba(239,229,185,${.24 + reveal * .66})`; cctx.fill()
        if (reveal > .75) {
          const glow = cctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 18)
          glow.addColorStop(0, `rgba(221,206,142,${.12 * reveal})`)
          glow.addColorStop(1, 'rgba(221,206,142,0)')
          cctx.fillStyle = glow; cctx.fillRect(p.x - 18, p.y - 18, 36, 36)
        }
      }
    })
    requestAnimationFrame(drawConstellation)
  }

  constellationCanvas.addEventListener('pointermove', e => {
    const rect = constellationCanvas.getBoundingClientRect()
    cPointer.x = e.clientX - rect.left
    cPointer.y = e.clientY - rect.top
  })
  constellationCanvas.addEventListener('pointerleave', () => { cPointer.x = -1000; cPointer.y = -1000 })
  constellationCanvas.addEventListener('pointerdown', e => {
    const rect = constellationCanvas.getBoundingClientRect()
    cPointer.x = e.clientX - rect.left
    cPointer.y = e.clientY - rect.top
  })
  createConstellation()
  requestAnimationFrame(drawConstellation)

  // Código que floresce
  const terminalCode = $('#terminalCode')
  const runCodeButton = $('#runCodeButton')
  const codeBloom = $('#codeBloom')
  const codeLines = [
    'const mariana = new Jardim()',
    '',
    'mariana.receber(luz)',
    'mariana.receber(chuva)',
    'mariana.receber(cuidado)',
    'mariana.receber(tempo)',
    '',
    'while (mariana.existe) {',
    '    mundo.ficarMaisBonito()',
    '}',
    '',
    'mariana.florescer()'
  ]
  let typed = false

  async function typeCode() {
    if (typed) return
    typed = true
    terminalCode.textContent = ''
    for (const line of codeLines) {
      for (const char of `${line}\n`) {
        terminalCode.textContent += char
        if (!reducedMotion) await new Promise(resolve => setTimeout(resolve, 17 + rand() * 25))
      }
    }
  }

  const terminalObserver = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) {
      typeCode()
      terminalObserver.disconnect()
    }
  }, { threshold: .4 })
  terminalObserver.observe($('#terminal'))

  function burstCodeFlowers() {
    codeBloom.innerHTML = ''
    const cx = window.innerWidth * .66
    const cy = window.innerHeight * .5
    for (let i = 0; i < 80; i += 1) {
      const petal = document.createElement('i')
      const angle = rand() * Math.PI * 2
      const distance = 90 + rand() * Math.min(window.innerWidth, 600)
      petal.style.left = `${cx}px`
      petal.style.top = `${cy}px`
      petal.style.setProperty('--x', `${Math.cos(angle) * distance}px`)
      petal.style.setProperty('--y', `${Math.sin(angle) * distance}px`)
      petal.style.setProperty('--r', `${(rand() - .5) * 900}deg`)
      petal.style.animationDelay = `${rand() * .32}s`
      if (i % 3 === 0) petal.style.background = 'rgba(224,204,213,.64)'
      if (i % 5 === 0) petal.style.background = 'rgba(217,194,126,.58)'
      codeBloom.appendChild(petal)
    }
    for (let i = 0; i < 14; i += 1) spawnFlower(rand() * window.innerWidth, rand() * window.innerHeight, i % 4 === 0)
  }

  runCodeButton.addEventListener('click', () => {
    runCodeButton.textContent = 'floresceu'
    runCodeButton.disabled = true
    burstCodeFlowers()
    setTimeout(() => { runCodeButton.disabled = false; runCodeButton.textContent = 'executar outra vez' }, 3200)
  })

  // Flor rara
  const nameButton = $('#nameButton')
  const rareFlower = $('#rareFlower')
  const rareStatus = $('#rareStatus')
  let rareOpened = false

  function openRareFlower() {
    if (rareOpened) return
    rareOpened = true
    rareStatus.textContent = 'o jardim reconheceu você'
    rareFlower.classList.add('open')
    nameButton.style.opacity = '.25'
    nameButton.style.pointerEvents = 'none'
    setTimeout(() => { rareStatus.textContent = 'sempre foi você' }, 2300)
    for (let i = 0; i < 10; i += 1) {
      setTimeout(() => spawnFlower(window.innerWidth / 2 + (rand() - .5) * 320, window.innerHeight / 2 + (rand() - .5) * 240, true), i * 130)
    }
  }

  nameButton.addEventListener('click', () => {
    rareStatus.textContent = 'escutando Mariana'
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) {
      setTimeout(openRareFlower, 1000)
      return
    }
    try {
      const recognition = new Recognition()
      recognition.lang = 'pt-BR'
      recognition.interimResults = false
      recognition.maxAlternatives = 1
      let resolved = false
      recognition.onresult = event => {
        resolved = true
        const heard = event.results[0][0].transcript.toLowerCase()
        if (heard.includes('mariana')) openRareFlower()
        else {
          rareStatus.textContent = 'a flor ouviu você e decidiu confiar mesmo assim'
          setTimeout(openRareFlower, 800)
        }
      }
      recognition.onerror = () => { if (!resolved) setTimeout(openRareFlower, 450) }
      recognition.onend = () => { if (!resolved) setTimeout(openRareFlower, 450) }
      recognition.start()
    } catch {
      setTimeout(openRareFlower, 700)
    }
  })

  // Raízes
  const rootsCanvas = $('#rootsCanvas')
  const rctx = rootsCanvas.getContext('2d')
  let rw = 0
  let rh = 0
  let rdpr = 1
  let rootSegments = []
  let rootsStart = null

  function resizeRoots() {
    rdpr = Math.min(window.devicePixelRatio || 1, 2)
    rw = rootsCanvas.clientWidth
    rh = rootsCanvas.clientHeight
    rootsCanvas.width = rw * rdpr
    rootsCanvas.height = rh * rdpr
    rctx.setTransform(rdpr, 0, 0, rdpr, 0, 0)
    buildRoots()
  }

  function buildRoots() {
    const r = mulberry32(marianaSeed + 1207)
    rootSegments = []
    function branch(x, y, angle, length, depth, parentProgress = 0) {
      if (depth <= 0 || length < 10) return
      const x2 = x + Math.cos(angle) * length
      const y2 = y + Math.sin(angle) * length
      const bend = (r() - .5) * length * .45
      const mx = (x + x2) / 2 + Math.cos(angle + Math.PI / 2) * bend
      const my = (y + y2) / 2 + Math.sin(angle + Math.PI / 2) * bend
      const progress = parentProgress + (6 - depth) * .055 + r() * .04
      rootSegments.push({ x, y, x2, y2, mx, my, depth, progress })
      const children = depth > 3 ? 2 + (r() > .65 ? 1 : 0) : 2
      for (let i = 0; i < children; i += 1) {
        branch(x2, y2, angle + (r() - .5) * 1.12, length * (.62 + r() * .15), depth - 1, progress)
      }
    }
    const starts = Math.max(8, Math.floor(rw / 130))
    for (let i = 0; i < starts; i += 1) {
      const angle = Math.PI * (1.08 + i / Math.max(1, starts - 1) * .84)
      branch(rw / 2, rh * .48, angle, 75 + r() * 110, 6, i * .012)
    }
  }

  function drawRoots(time) {
    rctx.clearRect(0, 0, rw, rh)
    const elapsed = rootsStart ? (time - rootsStart) / 4300 : 0
    rootSegments.forEach(seg => {
      const reveal = clamp((elapsed - seg.progress) * 3.2, 0, 1)
      if (reveal <= 0) return
      const ex = lerp(seg.x, seg.x2, reveal)
      const ey = lerp(seg.y, seg.y2, reveal)
      rctx.beginPath()
      rctx.moveTo(seg.x, seg.y)
      rctx.quadraticCurveTo(seg.mx, seg.my, ex, ey)
      rctx.strokeStyle = `rgba(129,169,130,${.055 + seg.depth * .016})`
      rctx.lineWidth = Math.max(.35, seg.depth * .18)
      rctx.stroke()
    })
    requestAnimationFrame(drawRoots)
  }

  const rootsObserver = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting) && !rootsStart) rootsStart = performance.now()
  }, { threshold: .25 })
  rootsObserver.observe($('#sceneRoots'))
  resizeRoots()
  requestAnimationFrame(drawRoots)

  // Final cinematográfico
  const finalScene = $('#sceneFinal')
  const finalLines = $$('#finalLines p')
  const returnButton = $('#returnButton')
  let finalPlayed = false
  const finalObserver = new IntersectionObserver(entries => {
    const entry = entries[0]
    if (!entry) return
    if (!entry.isIntersecting) {
      document.body.classList.remove('final-mode')
      return
    }
    document.body.classList.add('final-mode')
    if (finalPlayed) return
    finalPlayed = true
    finalScene.classList.add('in-view')
    const showFor = reducedMotion ? 350 : 2600
    finalLines.forEach((line, index) => {
      setTimeout(() => {
        finalLines.forEach(l => l.classList.remove('show'))
        line.classList.add('show')
      }, 1700 + index * showFor)
    })
    setTimeout(() => returnButton.classList.add('show'), 1900 + finalLines.length * showFor)
  }, { threshold: .42 })
  finalObserver.observe(finalScene)

  returnButton.addEventListener('click', () => {
    document.body.classList.remove('final-mode')
    $('#sceneHero').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' })
  })

  // Pequeno segredo para quem insiste em tocar a última flor
  let secretTouches = 0
  $('#finalFlower').addEventListener('click', () => {
    secretTouches += 1
    if (secretTouches !== 3) return
    const secret = document.createElement('div')
    secret.textContent = 'Mariana encontrou a raiz secreta e agora este jardim oficialmente pertence a ela'
    Object.assign(secret.style, {
      position: 'fixed', left: '50%', bottom: '34px', transform: 'translateX(-50%)', zIndex: '90',
      width: 'min(520px, calc(100% - 32px))', padding: '16px 20px', textAlign: 'center',
      borderRadius: '999px', border: '1px solid rgba(226,238,220,.14)', background: 'rgba(7,16,11,.82)',
      backdropFilter: 'blur(18px)', color: 'rgba(235,239,226,.72)', fontFamily: 'var(--serif)',
      fontStyle: 'italic', fontSize: '1rem', opacity: '0', transition: 'opacity .8s ease'
    })
    document.body.appendChild(secret)
    requestAnimationFrame(() => secret.style.opacity = '1')
    setTimeout(() => { secret.style.opacity = '0'; setTimeout(() => secret.remove(), 900) }, 5200)
    for (let i = 0; i < 18; i += 1) spawnFlower(rand() * window.innerWidth, rand() * window.innerHeight, true)
  })

  // Movimento sutil de parallax
  window.addEventListener('pointermove', e => {
    const x = (e.clientX / window.innerWidth - .5)
    const y = (e.clientY / window.innerHeight - .5)
    const bloom = $('.hero-bloom')
    if (bloom && !reducedMotion) bloom.style.translate = `${x * 12}px ${y * 8}px`
  }, { passive: true })

  let resizeTimer
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      resizeNight()
      resizeGarden()
      createConstellation()
      resizeRoots()
    }, 140)
  })
})()
