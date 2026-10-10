import type { Slut, Svaren } from './types'

// Spåren är bara ordningen på frågorna. Belopp och gränser finns i data/.
const SASONG = ['dagar', 'vistelse', 'familj']
const PENSION = ['dagar', 'alder', 'pengar', 'inkomst', 'bank', 'familj']

/** Svar (alternativ-id) som skickar besökaren till "spåret är under arbete". */
const UNDER_ARBETE: Record<string, string[]> = {
  alder: ['under'],
  pengar: ['lon', 'eget'],
}

export interface Vag {
  /** Frågorna från början till och med den första obesvarade. */
  fragor: string[]
  /** Antal frågor i det spår som gäller just nu. */
  total: number
  /** Sätts först när alla frågor i spåret är besvarade. */
  slut: Slut | null
}

export function beraknaVag(svar: Svaren): Vag {
  const fragor: string[] = []
  const sasong = svar.dagar === 'farre'
  const spar = sasong ? SASONG : PENSION

  for (const id of spar) {
    fragor.push(id)
    const valt = svar[id]
    if (!valt) return { fragor, total: spar.length, slut: null }
    if (UNDER_ARBETE[id]?.includes(valt)) return { fragor, total: spar.length, slut: 'underArbete' }
  }
  return { fragor, total: spar.length, slut: sasong ? 'sasong' : 'pension' }
}

/** Tar bort svar på frågor som inte längre ingår i spåret. */
export function rensaSvar(svar: Svaren): Svaren {
  const { fragor } = beraknaVag(svar)
  return Object.fromEntries(Object.entries(svar).filter(([id]) => fragor.includes(id)))
}
