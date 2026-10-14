import type { Slut } from './types'
import { SPAR_VARDE } from './spar'

// Källan = varifrån besökaren kom, utan personuppgifter (uppdrag 4, 14 oktober 2026).
// Delas av webbläsaren och Netlify-funktionen /api/matning, så att funktionen bara tar emot
// källor som följer samma regler.
// - utm_source=svarssida  → "svarssida-" + utm_campaign
// - annan utm_source      → utm_source
// - ingen utm_source, men en referrer från en annan webbplats → "ref-" + värdnamnet utan www
// - ingenting             → "direkt"
// Bara a–z, 0–9, punkt och bindestreck, gemener, högst `max` tecken. Annat blir "okand".
export const DIREKT = 'direkt'
export const OKAND = 'okand'
const TILLATET = /^[a-z\d.-]+$/

export function stada(kalla: string, max: number): string {
  const s = kalla.trim().toLowerCase()
  return s && s.length <= max && TILLATET.test(s) ? s : OKAND
}

export function kallaFran(adress: string, referrer: string, egenVard: string, max: number): string {
  let url: URL
  try {
    url = new URL(adress)
  } catch {
    return OKAND
  }
  const kalla = url.searchParams.get('utm_source')
  if (kalla !== null) {
    if (kalla.trim().toLowerCase() === 'svarssida') return stada(`svarssida-${url.searchParams.get('utm_campaign') ?? ''}`, max)
    return stada(kalla, max)
  }
  if (referrer) {
    try {
      const vard = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '')
      if (vard && vard !== egenVard) return stada(`ref-${vard}`, max)
    } catch {
      return OKAND
    }
  }
  return DIREKT
}

// Köpknappens adress: spåret i utm_campaign (uppdrag 3) och källan i utm_content (uppdrag 4).
export function kopLank(bas: string, spar: Slut, kalla: string): string {
  const url = new URL(bas)
  url.searchParams.set('utm_source', 'visumtest')
  url.searchParams.set('utm_medium', 'referral')
  url.searchParams.set('utm_campaign', SPAR_VARDE[spar])
  url.searchParams.set('utm_content', kalla)
  return url.toString()
}

// Stegen som räknas. fullfoljt, anmalan och kopklick har spår, besok har det inte.
export const STEG = ['besok', 'fullfoljt', 'anmalan', 'kopklick'] as const
export type Steg = (typeof STEG)[number]
export const STEG_MED_SPAR: Steg[] = ['fullfoljt', 'anmalan', 'kopklick']
