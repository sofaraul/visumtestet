// Delad kontroll av data/regler.json och config.json. Används av
// `npm run kallor` och av byggsteget i vite.config.ts.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { gallandeVarde, idagIso } from './gallande.mjs'

const rot = join(dirname(fileURLToPath(import.meta.url)), '..')
const las = (sokvag) => JSON.parse(readFileSync(join(rot, sokvag), 'utf-8'))

export const laRegler = () => las('data/regler.json')
export const laConfig = () => las('config.json')
export const laFragor = () => las('data/fragor.json')

/** Regler som inte får följa med ett produktionsbygge, med orsak. */
export function problemMedRegler(regler, idag = idagIso()) {
  const problem = []
  for (const r of regler) {
    const orsaker = []
    if (r.verifierad !== true) orsaker.push('verifierad är inte true')
    else {
      const varde = gallandeVarde(r, idag)
      if (varde === null || varde === undefined || varde === '') orsaker.push(`värde saknas ${idag}`)
      if (!r.kalla) orsaker.push('källa saknas')
      if (!r.senastKontrollerad) orsaker.push('senastKontrollerad saknas')
      if (!r.bekraftad) orsaker.push('bekraftad saknas (en människa ska ha bekräftat regeln)')
    }
    if (orsaker.length) problem.push({ id: r.id, orsaker })
  }
  return problem
}

/**
 * Uppgifter i konfigurationen som saknas. Kursen och avrundningen är nödvändiga: frågorna om
 * inkomst och bankkonto räknar fram belopp i kronor ur dem.
 */
export function saknadKonfiguration(config) {
  const saknas = []
  if (!config.shopifyLank) saknas.push('shopifyLank')
  if (!config.epost?.mottagare) saknas.push('epost.mottagare (e-postfältet visas inte)')
  if (!config.vaxelkurs?.thbPerSek) saknas.push('vaxelkurs.thbPerSek')
  if (!config.vaxelkurs?.datum) saknas.push('vaxelkurs.datum')
  if (!config.avrundningKr) saknas.push('avrundningKr')
  return saknas
}

/** De uppgifter i konfigurationen som produktionsbygget inte kan vara utan. */
export const nodvandigKonfiguration = (config) =>
  saknadKonfiguration(config).filter((s) => s.startsWith('vaxelkurs') || s === 'avrundningKr')

/** Frågor vars hjälptext är tom sträng (null betyder att ingen text ska visas). */
export function saknadeHjalptexter(fragor) {
  return fragor.fragor.filter((f) => f.hjalptext === '').map((f) => f.id)
}
