// Characters, cars and living details for the store canvas: partners in
// green aprons who walk with a stride and hold cups, customers with their own
// looks and moods, cars with lights, steam from the Mastrenas, a blender that
// shakes, an oven that glows, and light that follows the time of day.
// Coordinates are the legacy canvas's logical space (960 × 560).

const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']
const HAIR = ['#1f1300', '#2c1b10', '#4a2c17', '#0b0b0b', '#6b4423', '#3b2f2f']
const HIJAB = ['#7c2d12', '#1e3a8a', '#831843', '#14532d', '#78350f', '#334155', '#be185d']
const TROUSERS = ['#1e293b', '#111827', '#27272a', '#1c1917', '#312e81']
export const FONT = '"Cairo Variable", Cairo, sans-serif'

const motion = new WeakMap()

function hash(v) {
  const s = String(v ?? '')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return Math.abs(h)
}

function rr(c, x, y, w, h, r) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}

/** How far an entity moved since the last frame drives its stride. */
function stride(entity, x, y, now) {
  if (!entity || typeof entity !== 'object') return { phase: now / 400, speed: 0 }
  let m = motion.get(entity)
  if (!m) {
    m = { x, y, phase: (hash(entity.id) % 100) / 10, speed: 0 }
    motion.set(entity, m)
  }
  const d = Math.hypot(x - m.x, y - m.y)
  m.speed = m.speed * 0.8 + d * 0.2
  m.phase += d * 0.32
  m.x = x
  m.y = y
  return m
}

function moodOf(icon) {
  if (icon === '😡') return 'angry'
  if (icon === '😐') return 'meh'
  if (icon === '😊') return 'happy'
  return 'calm'
}

function looks(entity, kind) {
  const h = hash(entity?.id ?? entity?.customerName ?? entity?.name ?? Math.random())
  const hair = HAIR[h % HAIR.length]
  // Some customers wear a hijab, partners keep their hair under a cap or tied back.
  const style = kind === 'barista' ? (h % 3 === 0 ? 'hijab' : 'cap') : ['short', 'long', 'hijab', 'short', 'curly', 'hijab', 'bald'][h % 7]
  return {
    skin: SKIN[(h >> 3) % SKIN.length],
    hair,
    style,
    scarf: HIJAB[(h >> 5) % HIJAB.length],
    trousers: TROUSERS[(h >> 7) % TROUSERS.length],
  }
}

function drawFace(c, x, y, mood, tired) {
  c.fillStyle = '#1f2937'
  if (tired) {
    c.fillRect(x - 4.5, y - 1, 3, 1.2)
    c.fillRect(x + 1.5, y - 1, 3, 1.2)
  } else {
    c.beginPath()
    c.arc(x - 3, y - 0.5, 1.2, 0, Math.PI * 2)
    c.arc(x + 3, y - 0.5, 1.2, 0, Math.PI * 2)
    c.fill()
  }
  c.strokeStyle = mood === 'angry' ? '#991b1b' : '#7c2d12'
  c.lineWidth = 1.2
  c.beginPath()
  if (mood === 'angry') {
    c.moveTo(x - 3, y + 4.5)
    c.quadraticCurveTo(x, y + 2, x + 3, y + 4.5)
    // brows
    c.moveTo(x - 5, y - 3.5)
    c.lineTo(x - 1.5, y - 2.2)
    c.moveTo(x + 5, y - 3.5)
    c.lineTo(x + 1.5, y - 2.2)
  } else if (mood === 'meh') {
    c.moveTo(x - 2.5, y + 3.5)
    c.lineTo(x + 2.5, y + 3.5)
  } else {
    c.moveTo(x - 3, y + 2.5)
    c.quadraticCurveTo(x, y + 5, x + 3, y + 2.5)
  }
  c.stroke()
  if (mood === 'happy' || mood === 'calm') {
    c.fillStyle = 'rgba(244, 114, 182, 0.35)'
    c.beginPath()
    c.arc(x - 5, y + 2, 1.6, 0, Math.PI * 2)
    c.arc(x + 5, y + 2, 1.6, 0, Math.PI * 2)
    c.fill()
  }
}

function drawHair(c, x, y, lk, kind) {
  const r = 9
  if (lk.style === 'hijab') {
    c.fillStyle = lk.scarf
    c.beginPath()
    c.arc(x, y, r + 2.2, Math.PI * 0.9, Math.PI * 2.1)
    c.lineTo(x + r + 2, y + 10)
    c.quadraticCurveTo(x, y + 15, x - r - 2, y + 10)
    c.closePath()
    c.fill()
    return 'front'
  }
  c.fillStyle = lk.hair
  if (lk.style === 'cap' && kind === 'barista') {
    c.fillStyle = '#111827'
    c.beginPath()
    c.arc(x, y - 1, r + 0.8, Math.PI, Math.PI * 2)
    c.fill()
    c.fillRect(x - 2, y - 2.4, r + 6, 2.4) // the peak
    c.fillStyle = '#00704A'
    c.beginPath()
    c.arc(x, y - 5.5, 2, 0, Math.PI * 2)
    c.fill()
    return 'cap'
  }
  if (lk.style === 'bald') return 'none'
  c.beginPath()
  c.arc(x, y - 1.5, r + 0.6, Math.PI * 1.02, Math.PI * 1.98)
  c.fill()
  if (lk.style === 'long') {
    c.fillRect(x - r - 0.5, y - 2, 3.4, 13)
    c.fillRect(x + r - 2.9, y - 2, 3.4, 13)
  } else if (lk.style === 'curly') {
    for (let i = -2; i <= 2; i++) {
      c.beginPath()
      c.arc(x + i * 4, y - r + 1, 3, 0, Math.PI * 2)
      c.fill()
    }
  }
  return 'hair'
}

/**
 * A person in 3/4 view. kind: 'barista' | 'customer' | 'inspector' | 'complaint'
 */
export function drawPerson(c, { x, y, shirt, apron, icon, label, badgeColor, ratio, selected, entity, kind = 'customer' }) {
  const now = performance.now()
  const m = stride(entity, x, y, now)
  const walking = m.speed > 0.25
  const swing = walking ? Math.sin(m.phase) * Math.min(1, m.speed / 1.6) : 0
  const bob = walking ? Math.abs(Math.sin(m.phase)) * 1.6 : Math.sin(now / 700 + hash(entity?.id) % 7) * 0.5
  const lk = looks(entity, kind)
  const mood = moodOf(icon)
  const resting = icon === '🛋️'
  const tired = kind === 'barista' && typeof ratio === 'number' && ratio < 0.3 && !resting
  const by = y - bob

  // Floor shadow, and a soft gold ring for the selected ticket.
  c.fillStyle = 'rgba(0,0,0,0.38)'
  c.beginPath()
  c.ellipse(x, y + 18, 14, 5.5, 0, 0, Math.PI * 2)
  c.fill()
  if (selected) {
    c.strokeStyle = 'rgba(203, 162, 88, 0.95)'
    c.lineWidth = 2
    c.beginPath()
    c.ellipse(x, y + 18, 19, 7.5, 0, 0, Math.PI * 2)
    c.stroke()
  }

  // Legs with a stride.
  c.strokeStyle = lk.trousers
  c.lineCap = 'round'
  c.lineWidth = 4.2
  c.beginPath()
  c.moveTo(x - 4, by + 6)
  c.lineTo(x - 4 + swing * 3.5, by + 17)
  c.moveTo(x + 4, by + 6)
  c.lineTo(x + 4 - swing * 3.5, by + 17)
  c.stroke()
  c.fillStyle = '#0b0b0b'
  c.beginPath()
  c.ellipse(x - 4 + swing * 3.5, by + 18, 3, 1.6, 0, 0, Math.PI * 2)
  c.ellipse(x + 4 - swing * 3.5, by + 18, 3, 1.6, 0, 0, Math.PI * 2)
  c.fill()

  // Torso.
  const shirtCol = kind === 'barista' && !resting ? '#111827' : shirt
  c.fillStyle = shirtCol
  rr(c, x - 11, by - 9, 22, 18, 7)
  c.fill()
  c.strokeStyle = selected ? '#CBA258' : 'rgba(255,255,255,0.18)'
  c.lineWidth = selected ? 2 : 1
  c.stroke()

  // The green apron with its siren dot and straps.
  if (apron) {
    c.fillStyle = apron
    rr(c, x - 8.5, by - 6, 17, 16, 3)
    c.fill()
    c.strokeStyle = 'rgba(255,255,255,0.55)'
    c.lineWidth = 0.9
    c.beginPath()
    c.moveTo(x - 6, by - 6)
    c.lineTo(x - 4, by - 10)
    c.moveTo(x + 6, by - 6)
    c.lineTo(x + 4, by - 10)
    c.stroke()
    c.fillStyle = '#ffffff'
    c.beginPath()
    c.arc(x, by + 0.5, 2.6, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = apron
    c.beginPath()
    c.arc(x, by + 0.5, 1.4, 0, Math.PI * 2)
    c.fill()
    // name tag
    c.fillStyle = '#f8fafc'
    c.fillRect(x + 3, by - 4, 4, 2)
  }
  if (kind === 'inspector') {
    c.fillStyle = '#CBA258'
    c.beginPath()
    c.moveTo(x, by - 8)
    c.lineTo(x - 2, by + 2)
    c.lineTo(x, by + 5)
    c.lineTo(x + 2, by + 2)
    c.closePath()
    c.fill()
  }

  // Arms: swinging when walking, forward with a cup when working at the bar.
  const working = kind === 'barista' && !walking && !resting
  c.strokeStyle = shirtCol
  c.lineWidth = 3.6
  c.beginPath()
  c.moveTo(x - 10, by - 5)
  c.lineTo(x - 12 - swing * 2.5, by + (working ? 1 : 6))
  c.moveTo(x + 10, by - 5)
  c.lineTo(x + 12 + swing * 2.5, by + (working ? 1 : 6))
  c.stroke()
  c.fillStyle = lk.skin
  c.beginPath()
  c.arc(x - 12 - swing * 2.5, by + (working ? 1.5 : 6.5), 1.9, 0, Math.PI * 2)
  c.arc(x + 12 + swing * 2.5, by + (working ? 1.5 : 6.5), 1.9, 0, Math.PI * 2)
  c.fill()
  if (working || kind === 'inspector' || (kind === 'customer' && mood === 'happy' && entity?.id % 3 === 0)) {
    // A cup (or the inspector's clipboard) in the right hand.
    if (kind === 'inspector') {
      c.fillStyle = '#e2e8f0'
      c.fillRect(x + 11, by - 2, 7, 9)
      c.fillStyle = '#64748b'
      c.fillRect(x + 12.5, by, 4, 0.8)
      c.fillRect(x + 12.5, by + 2, 4, 0.8)
    } else {
      c.fillStyle = '#f8fafc'
      c.beginPath()
      c.moveTo(x + 10.5, by - 3)
      c.lineTo(x + 16.5, by - 3)
      c.lineTo(x + 15.5, by + 4)
      c.lineTo(x + 11.5, by + 4)
      c.closePath()
      c.fill()
      c.fillStyle = '#00704A'
      c.beginPath()
      c.arc(x + 13.5, by + 0.5, 1.3, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#1f2937'
      c.fillRect(x + 10, by - 4.4, 7, 1.6)
    }
  }

  // Head.
  const hy = by - 16
  const hairBack = lk.style === 'hijab'
  if (hairBack) drawHair(c, x, hy, lk, kind)
  c.fillStyle = lk.skin
  c.beginPath()
  c.arc(x, hy, 9, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = 'rgba(0,0,0,0.25)'
  c.lineWidth = 1
  c.stroke()
  if (!hairBack) drawHair(c, x, hy, lk, kind)
  if (resting) {
    c.fillStyle = '#e9d5ff'
    c.font = `800 8px ${FONT}`
    c.textAlign = 'center'
    c.fillText('z', x + 11, hy - 8 - (Math.sin(now / 500) + 1) * 2)
    c.fillText('Z', x + 15, hy - 14 - (Math.sin(now / 500 + 1) + 1) * 2)
    drawFace(c, x, hy + 1, 'calm', true)
  } else {
    drawFace(c, x, hy + 1, kind === 'complaint' ? 'angry' : mood, tired)
  }
  if (mood === 'angry' || kind === 'complaint') {
    // A little steam of anger.
    const t = (now / 300) % 6
    c.strokeStyle = 'rgba(248, 113, 113, 0.85)'
    c.lineWidth = 1.4
    c.beginPath()
    c.moveTo(x - 11, hy - 6 - t)
    c.lineTo(x - 14, hy - 9 - t)
    c.moveTo(x + 11, hy - 6 - t)
    c.lineTo(x + 14, hy - 9 - t)
    c.stroke()
  }

  // Label pill with a pointer.
  if (label) {
    c.font = `700 9.5px ${FONT}`
    c.textAlign = 'center'
    const w = Math.max(70, Math.min(230, c.measureText(label).width + 16))
    const ly = y - 48
    c.fillStyle = 'rgba(11, 25, 21, 0.92)'
    rr(c, x - w / 2, ly, w, 17, 7)
    c.fill()
    c.strokeStyle = badgeColor || '#CBA258'
    c.lineWidth = 1.2
    c.stroke()
    c.beginPath()
    c.moveTo(x - 4, ly + 17)
    c.lineTo(x, ly + 21)
    c.lineTo(x + 4, ly + 17)
    c.closePath()
    c.fillStyle = 'rgba(11, 25, 21, 0.92)'
    c.fill()
    c.fillStyle = '#ffffff'
    c.fillText(label, x, ly + 12)
  }

  // Energy (partners) or patience (customers).
  if (typeof ratio === 'number') {
    const r = Math.max(0, Math.min(1, ratio))
    c.fillStyle = 'rgba(15, 23, 42, 0.9)'
    rr(c, x - 22, y + 22, 44, 4.5, 2.2)
    c.fill()
    c.fillStyle = r > 0.55 ? '#34d399' : r > 0.3 ? '#fbbf24' : '#f87171'
    if (r > 0.02) {
      rr(c, x - 22, y + 22, 44 * r, 4.5, 2.2)
      c.fill()
    }
  }
  c.lineCap = 'butt'
}

function shade(hex, amt) {
  const n = parseInt(String(hex).replace('#', ''), 16)
  if (Number.isNaN(n)) return hex
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt))
  const b = Math.max(0, Math.min(255, (n & 255) + amt))
  return `rgb(${r},${g},${b})`
}

/** A car in the drive-thru lane, facing the pickup window on the left. */
export function drawCar(c, ord, selected, night = false) {
  const now = performance.now()
  const m = stride(ord, ord.x, ord.y, now)
  const moving = m.speed > 0.3
  const x = ord.x
  const y = ord.y + (moving ? Math.sin(now / 60) * 0.6 : 0)
  const col = ord.carColor || '#3b82f6'

  // Headlight beams (stronger at night).
  const beam = c.createLinearGradient(x - 48, y, x - 110, y)
  beam.addColorStop(0, night ? 'rgba(254, 240, 138, 0.55)' : 'rgba(254, 240, 138, 0.22)')
  beam.addColorStop(1, 'rgba(254, 240, 138, 0)')
  c.fillStyle = beam
  c.beginPath()
  c.moveTo(x - 46, y - 2)
  c.lineTo(x - 110, y - 16)
  c.lineTo(x - 110, y + 20)
  c.lineTo(x - 46, y + 10)
  c.closePath()
  c.fill()

  // Shadow.
  c.fillStyle = 'rgba(0,0,0,0.45)'
  rr(c, x - 50, y - 4, 100, 30, 12)
  c.fill()

  // Wheels with rims (they turn while the car moves).
  for (const wx of [x - 29, x + 29]) {
    c.fillStyle = '#0a0a0a'
    c.beginPath()
    c.arc(wx, y + 17, 7.5, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#9ca3af'
    c.beginPath()
    c.arc(wx, y + 17, 3.4, 0, Math.PI * 2)
    c.fill()
    const a = m.phase * 0.6
    c.strokeStyle = '#4b5563'
    c.lineWidth = 1
    c.beginPath()
    c.moveTo(wx + Math.cos(a) * 3.2, y + 17 + Math.sin(a) * 3.2)
    c.lineTo(wx - Math.cos(a) * 3.2, y + 17 - Math.sin(a) * 3.2)
    c.stroke()
  }

  // Body with a highlight.
  const body = c.createLinearGradient(0, y - 8, 0, y + 16)
  body.addColorStop(0, shade(col, 40))
  body.addColorStop(1, shade(col, -40))
  c.fillStyle = body
  rr(c, x - 48, y - 6, 96, 22, 8)
  c.fill()
  c.strokeStyle = selected ? '#ffffff' : 'rgba(0,0,0,0.6)'
  c.lineWidth = selected ? 2.5 : 1.2
  c.stroke()

  // Cabin and windows with the driver.
  c.fillStyle = shade(col, 15)
  rr(c, x - 30, y - 20, 56, 17, 7)
  c.fill()
  const glass = c.createLinearGradient(x - 26, y - 17, x + 22, y - 6)
  glass.addColorStop(0, '#93c5fd')
  glass.addColorStop(1, '#1e3a8a')
  c.fillStyle = glass
  rr(c, x - 26, y - 17, 23, 11, 3)
  c.fill()
  rr(c, x + 1, y - 17, 21, 11, 3)
  c.fill()
  c.fillStyle = SKIN[hash(ord.id) % SKIN.length]
  c.beginPath()
  c.arc(x - 15, y - 10, 3.6, 0, Math.PI * 2)
  c.fill()

  // Lights.
  c.fillStyle = '#fef9c3'
  rr(c, x - 49, y - 2, 4, 6, 1.5)
  c.fill()
  c.fillStyle = '#ef4444'
  rr(c, x + 45, y - 2, 4, 6, 1.5)
  c.fill()

  // Order tag and patience.
  const ratio = Math.max(0, ord.timeLeft / ord.maxTime)
  const mood = ratio > 0.6 ? '😊' : ratio > 0.32 ? '😐' : '😡'
  const text = `${mood} ${ord.itemIcon} ${ord.size} (${Math.ceil(ord.timeLeft)}ث)`
  c.font = `700 9.5px ${FONT}`
  c.textAlign = 'center'
  const w = Math.max(84, c.measureText(text).width + 14)
  c.fillStyle = 'rgba(15, 23, 42, 0.92)'
  rr(c, x - w / 2, y - 38, w, 16, 6)
  c.fill()
  c.strokeStyle = selected ? '#CBA258' : '#38bdf8'
  c.lineWidth = 1.2
  c.stroke()
  c.fillStyle = '#ffffff'
  c.fillText(text, x, y - 26.5)
  c.fillStyle = 'rgba(15, 23, 42, 0.9)'
  rr(c, x - 36, y + 26, 72, 4.5, 2.2)
  c.fill()
  c.fillStyle = ratio > 0.55 ? '#34d399' : ratio > 0.3 ? '#fbbf24' : '#f87171'
  if (ratio > 0.02) {
    rr(c, x - 36, y + 26, 72 * ratio, 4.5, 2.2)
    c.fill()
  }
}

// ----------------------------------------------------------- ambience & fx

/** 0..1 how dark it is outside. */
export function nightLevel(minutes) {
  if (minutes < 420) return 0.55 - ((minutes - 360) / 60) * 0.45 // dawn
  if (minutes < 1020) return 0.1 * Math.max(0, (480 - minutes) / 60)
  if (minutes < 1140) return ((minutes - 1020) / 120) * 0.45 // dusk
  return 0.45 + Math.min(0.2, ((minutes - 1140) / 180) * 0.2)
}

/** A tint over the room and the lane that follows the clock, drawn under the people. */
export function drawAmbient(c, state, W, H) {
  const minutes = state.dayMinutes || 480
  const dark = nightLevel(minutes)
  // Golden hours.
  let warm = 0
  if (minutes < 540) warm = 0.09 * (1 - Math.max(0, (minutes - 420) / 120))
  else if (minutes >= 960 && minutes < 1140) warm = 0.1 * Math.sin(((minutes - 960) / 180) * Math.PI)
  if (warm > 0.005) {
    c.fillStyle = `rgba(255, 160, 70, ${warm})`
    c.fillRect(0, 0, W, H)
  }
  if (dark > 0.02) {
    // The lane outside darkens more than the lit store.
    c.fillStyle = `rgba(4, 10, 30, ${Math.min(0.6, dark * 1.15)})`
    c.fillRect(0, 0, W, 104)
    c.fillStyle = `rgba(4, 10, 30, ${dark * 0.55})`
    c.fillRect(0, 104, W, H - 104)
    // Pendant lights over the counter and the lobby.
    c.save()
    c.globalCompositeOperation = 'lighter'
    const lamps = [
      [300, 250], [480, 250], [660, 250], [840, 250],
      [230, 420], [420, 420], [610, 420], [800, 420],
    ]
    for (const [lx, ly] of lamps) {
      const g = c.createRadialGradient(lx, ly, 2, lx, ly, 95)
      g.addColorStop(0, `rgba(255, 196, 120, ${0.16 * dark * 2})`)
      g.addColorStop(1, 'rgba(255, 196, 120, 0)')
      c.fillStyle = g
      c.beginPath()
      c.arc(lx, ly, 95, 0, Math.PI * 2)
      c.fill()
    }
    // Street lamps along the drive-thru.
    for (const lx of [120, 480, 860]) {
      const g = c.createRadialGradient(lx, 30, 2, lx, 30, 70)
      g.addColorStop(0, `rgba(253, 230, 138, ${0.3 * dark})`)
      g.addColorStop(1, 'rgba(253, 230, 138, 0)')
      c.fillStyle = g
      c.beginPath()
      c.arc(lx, 30, 70, 0, Math.PI * 2)
      c.fill()
    }
    c.restore()
  }
}

const puffs = []
let lastFx = 0

/** Steam from the Mastrenas, a shaking blender and a glowing oven while orders are in. */
export function drawMachineFx(c, state) {
  const now = performance.now()
  const dt = Math.min(64, now - (lastFx || now))
  lastFx = now
  const orders = state.orders || []
  const pending = (o, step) => (o.stepsRequired || []).includes(step) && !(o.stepStates || {})[step]
  const hot = orders.some((o) => pending(o, 'shot') || pending(o, 'milk'))
  const cold = orders.some((o) => pending(o, 'cold'))
  const food = orders.some((o) => pending(o, 'oven'))
  const busy = orders.length > 0

  // Steam over the two Mastrenas (around x 470–600 on the back bar).
  if (busy && Math.random() < (hot ? 0.35 : 0.12) * (dt / 16)) {
    puffs.push({ x: 480 + Math.random() * 120, y: 128, r: 2 + Math.random() * 2, life: 1, vx: (Math.random() - 0.5) * 0.15, vy: -0.35 - Math.random() * 0.25 })
  }
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i]
    p.x += p.vx * (dt / 16)
    p.y += p.vy * (dt / 16)
    p.r += 0.05 * (dt / 16)
    p.life -= 0.012 * (dt / 16)
    if (p.life <= 0) {
      puffs.splice(i, 1)
      continue
    }
    c.fillStyle = `rgba(241, 245, 249, ${0.32 * p.life})`
    c.beginPath()
    c.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    c.fill()
  }
  if (puffs.length > 80) puffs.splice(0, puffs.length - 80)

  // The blender on the cold bar (x ≈ 650) shakes.
  if (cold) {
    const jig = Math.sin(now / 25) * 1.2
    c.strokeStyle = 'rgba(165, 243, 252, 0.8)'
    c.lineWidth = 1.2
    c.beginPath()
    c.moveTo(652 + jig, 118)
    c.lineTo(648 + jig, 113)
    c.moveTo(664 - jig, 118)
    c.lineTo(668 - jig, 113)
    c.stroke()
  }

  // The TurboChef (x ≈ 800–930) glows while it heats.
  if (food) {
    const a = 0.18 + Math.sin(now / 240) * 0.08
    const g = c.createRadialGradient(860, 160, 4, 860, 160, 70)
    g.addColorStop(0, `rgba(251, 146, 60, ${a})`)
    g.addColorStop(1, 'rgba(251, 146, 60, 0)')
    c.fillStyle = g
    c.beginPath()
    c.arc(860, 160, 70, 0, Math.PI * 2)
    c.fill()
  }
}
