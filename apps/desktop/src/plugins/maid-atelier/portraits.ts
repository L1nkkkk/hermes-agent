import anon from './faces/anon.webp'
import mutsumi from './faces/mutsumi.webp'
import nyamu from './faces/nyamu.webp'
import raana from './faces/raana.webp'
import sakiko from './faces/sakiko.webp'
import soyo from './faces/soyo.webp'
import taki from './faces/taki.webp'
import tomori from './faces/tomori.webp'
import uika from './faces/uika.webp'
import umiri from './faces/umiri.webp'

/**
 * Local round face crops. Not OpenClaw `/maid-avatars` paths.
 * Order is the face-picker cycle. `hash(id)` picks a slot when none is saved.
 */
const FACES = [tomori, anon, taki, soyo, raana, mutsumi, sakiko, umiri, nyamu, uika] as const

export const FACE_NAMES = [
  'Tomori',
  'Anon',
  'Taki',
  'Soyo',
  'Rikki',
  'Mutsumi',
  'Sakiko',
  'Umiri',
  'Nyamu',
  'Uika'
] as const

export const FACE_COUNT = FACES.length

export function portraitSrc(id: string, faceIndex?: number): string {
  return FACES[normalizeFace(faceIndex ?? hash(id))]
}

export function normalizeFace(index: number): number {
  return ((index % FACE_COUNT) + FACE_COUNT) % FACE_COUNT
}

function hash(id: string): number {
  let value = 2166136261

  for (let index = 0; index < id.length; index += 1) {
    value ^= id.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }

  return value >>> 0
}
