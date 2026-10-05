import type { Watch } from '../types'
import type { Store } from './store'

const KEY = 'pititi.watches.v1'

function read(): Watch[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Watch[]) : []
  } catch {
    return []
  }
}

function write(list: Watch[]) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

export const localStore: Store = {
  mode: 'local',
  async load() {
    return read()
  },
  async save(w) {
    const list = read().filter((x) => x.id !== w.id)
    write([...list, w])
  },
  async remove(id) {
    write(read().filter((x) => x.id !== id))
  },
  subscribe(onChange) {
    const handler = (e: StorageEvent) => e.key === KEY && onChange()
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  },
}

/** Cache used by cloud mode so the app still opens offline. */
export const cache = { read, write }
