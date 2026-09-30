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

export const jamforBank = (svar: string | undefined): Status =>
  svar === 'ja' ? 'ok' : svar === 'kanske' ? 'nara' : svar === 'nej' ? 'under' : 'okant'

export const jamforAlder = (svar: string | undefined): Status =>
  svar === 'minst' ? 'ok' : svar === 'under' ? 'under' : 'okant'

export const jamforDagar = (svar: string | undefined): Status => (svar === 'farre' ? 'ok' : 'okant')
