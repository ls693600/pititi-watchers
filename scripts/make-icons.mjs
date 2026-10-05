// Generates the app icons (coral-to-amber tile, white TV mark) without image dependencies.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function icon(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  const S = size
  // TV body (rounded rect outline) + stand + play triangle, as signed-distance-ish tests
  const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
    const cx = Math.max(x0 + r, Math.min(x, x1 - r)), cy = Math.max(y0 + r, Math.min(y, y1 - r))
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
  }
  const tv = (x, y) => {
    const outer = inRoundRect(x, y, S * 0.2, S * 0.3, S * 0.8, S * 0.74, S * 0.08)
    const inner = inRoundRect(x, y, S * 0.255, S * 0.355, S * 0.745, S * 0.685, S * 0.04)
    const ant1 = Math.abs((y - S * 0.3) + (x - S * 0.5) * 1.1) < S * 0.028 && y > S * 0.17 && y < S * 0.3 && x < S * 0.5
    const ant2 = Math.abs((y - S * 0.3) - (x - S * 0.5) * 1.1) < S * 0.028 && y > S * 0.17 && y < S * 0.3 && x > S * 0.5
    const ax = S * 0.45, ay = S * 0.42, bx = S * 0.45, by = S * 0.62, cx = S * 0.6, cy = S * 0.52
    const d = (x1, y1, x2, y2) => (x - x2) * (y1 - y2) - (x1 - x2) * (y - y2)
    const d1 = d(ax, ay, bx, by), d2 = d(bx, by, cx, cy), d3 = d(cx, cy, ax, ay)
    const play = !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
    return (outer && !inner) || ant1 || ant2 || play
  }
  for (let y = 0; y < S; y++) {
    raw[y * (S * 3 + 1)] = 0
    for (let x = 0; x < S; x++) {
      let hits = 0
      for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) hits += tv(x + (sx + 0.5) / 3, y + (sy + 0.5) / 3)
      const t = hits / 9
      // diagonal gradient #ff4d6d -> #ff8a3d
      const g = (x + y) / (2 * S)
      const br = 255, bg = Math.round(77 + (138 - 77) * g), bb = Math.round(109 + (61 - 109) * g)
      const o = y * (S * 3 + 1) + 1 + x * 3
      raw[o] = Math.round(br + (255 - br) * t)
      raw[o + 1] = Math.round(bg + (255 - bg) * t)
      raw[o + 2] = Math.round(bb + (255 - bb) * t)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(S, 0)
  ihdr.writeUInt32BE(S, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), icon(size))
}
console.log('icons written')
