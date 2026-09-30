// Delad kontroll av data/regler.json och config.json. Används av
// `npm run kallor` och av byggsteget i vite.config.ts.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const rot = join(dirname(fileURLToPath(import.meta.url)), '..')
const las = (sokvag) => JSON.parse(readFileSync(join(rot, sokvag), 'utf-8'))

export const laRegler = () => las('data/regler.json')
export const laConfig = () => las('config.json')
export const laFragor = () => las('data/fragor.json')

/** Regler som inte får följa med ett produktionsbygge, med orsak. */
export function problemMedRegler(regler) {
  const problem = []
  for (const r of regler) {
    const orsaker = []
    if (r.verifierad !== true) orsaker.push('verifierad är inte true')
    else {
      if (r.varde === null || r.varde === undefined || r.varde === '') orsaker.push('värde saknas')
      if (!r.kalla) orsaker.push('källa saknas')
      if (!r.senastKontrollerad) orsaker.push('senastKontrollerad saknas')
    }
    if (orsaker.length) problem.push({ id: r.id, orsaker })
  }
  return problem
}

/** Uppgifter i konfigurationen som saknas. */
export function saknadKonfiguration(config) {
  const saknas = []
  if (!config.shopifyLank) saknas.push('shopifyLank')
  if (!config.epost?.mottagare) saknas.push('epost.mottagare (e-postfältet visas inte)')
  if (!config.vaxelkurs?.thbPerSek) saknas.push('vaxelkurs.thbPerSek')
  if (!config.vaxelkurs?.datum) saknas.push('vaxelkurs.datum')
  return saknas
}

/** Frågor vars hjälptext är tom sträng (null betyder att ingen text ska visas). */
export function saknadeHjalptexter(fragor) {
  return fragor.fragor.filter((f) => f.hjalptext === '').map((f) => f.id)
}
