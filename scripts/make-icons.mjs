// Generates the app icons (red tile, white play mark) without image dependencies.
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
  // Play triangle, centered with a slight optical nudge right
  const ax = size * 0.38, ay = size * 0.28, bx = size * 0.38, by = size * 0.72, cx = size * 0.74, cy = size * 0.5
  const inside = (x, y) => {
    const d = (x1, y1, x2, y2) => (x - x2) * (y1 - y2) - (x1 - x2) * (y - y2)
    const d1 = d(ax, ay, bx, by), d2 = d(bx, by, cx, cy), d3 = d(cx, cy, ax, ay)
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
  }
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    for (let x = 0; x < size; x++) {
      // 4x supersampling for smooth edges
      let hits = 0
      for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) hits += inside(x + 0.25 + sx * 0.5, y + 0.25 + sy * 0.5)
      const t = hits / 4
      const o = y * (size * 3 + 1) + 1 + x * 3
      raw[o] = Math.round(237 + (255 - 237) * t)
      raw[o + 1] = Math.round(28 + (255 - 28) * t)
      raw[o + 2] = Math.round(36 + (255 - 36) * t)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
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
