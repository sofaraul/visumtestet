import type { Status } from './types'

/**
 * Ja/Nej-frågor om ett belopp som räknats fram ur kravet. Ja betyder att besökaren når beloppet,
 * Nej att besökaren inte gör det och Vet inte att det inte går att avgöra.
 */
export const jamforJaNej = (svar: string | undefined): Status =>
  svar === 'ja' ? 'ok' : svar === 'nej' ? 'under' : 'okant'

export const jamforVistelse = (svar: string | undefined): Status => (svar === 'hogst' ? 'ok' : svar === 'langre' ? 'under' : 'okant')

export const jamforDagar = (svar: string | undefined): Status => (svar === 'farre' ? 'ok' : 'okant')
