/** Original round faces. Not the OpenClaw jpg set, which is not in this repo. */

const HAIR = ['#2a2422', '#1c2430', '#5c3a32', '#3a3028', '#24282c', '#4a3a30']
const EYES = ['#243040', '#3a2c24', '#1e2c28', '#1a1c22', '#2a3340', '#3a2824']

export function portraitSrc(id: string, faceIndex?: number): string {
  const index = normalizeFace(faceIndex ?? hash(id))
  const hair = HAIR[index] ?? HAIR[0]
  const eye = EYES[index] ?? EYES[0]
  const part = index % 2 === 0 ? 24 : 40

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`,
    `<rect width="64" height="64" fill="#1c1d21"/>`,
    `<path d="M8 58c4-16 10-26 24-26s20 10 24 26" fill="${hair}"/>`,
    `<circle cx="32" cy="30" r="16" fill="#f0d2c0"/>`,
    `<path d="M16 28c2-14 8-20 16-20s14 6 16 20c-6-6-26-6-32 0z" fill="${hair}"/>`,
    `<path d="M${part - 6} 14h8l-2 10h-6z" fill="${hair}"/>`,
    `<circle cx="26" cy="32" r="1.6" fill="${eye}"/>`,
    `<circle cx="38" cy="32" r="1.6" fill="${eye}"/>`,
    `<path d="M29 40c2 1.4 4 1.4 6 0" fill="none" stroke="#a87868" stroke-width="1"/>`,
    `</svg>`
  ].join('')

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export const FACE_COUNT = HAIR.length

export function normalizeFace(index: number): number {
  const count = HAIR.length

  return ((index % count) + count) % count
}

function hash(id: string): number {
  let value = 2166136261

  for (let index = 0; index < id.length; index += 1) {
    value ^= id.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }

  return value >>> 0
}
