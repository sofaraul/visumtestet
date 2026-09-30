import type { Alternativ, Status } from './types'

/**
 * Jämför ett inkomstintervall (kr i månaden) med ett krav i baht.
 * Ligger kravet inom intervallet är det "nära gränsen".
 */
export function jamforInkomst(alt: Alternativ | undefined, kravThb: number | null, thbPerSek: number | null): Status {
  if (!alt || alt.minSek === undefined || kravThb === null || !thbPerSek) return 'okant'
  const min = alt.minSek * thbPerSek
  const max = alt.maxSek == null ? Infinity : alt.maxSek * thbPerSek
  if (kravThb >= min && kravThb <= max) return 'nara'
  return min > kravThb ? 'ok' : 'under'
}

/**
 * Frågan gäller "ett större belopp" utan att ange hur stort. Ett Ja eller Kanske kan alltså
 * aldrig avgöra om kravet nås. Bara ett Nej går att avgöra: då kan kontokravet inte nås.
 */
export const jamforBank = (svar: string | undefined): Status =>
  svar === 'nej' ? 'under' : svar === 'ja' || svar === 'kanske' ? 'nara' : 'okant'

export const jamforVistelse = (svar: string | undefined): Status => (svar === 'hogst' ? 'ok' : svar === 'langre' ? 'under' : 'okant')

export const jamforDagar = (svar: string | undefined): Status => (svar === 'farre' ? 'ok' : 'okant')
