import type { Slut } from './types'

/**
 * Värdet i Brevo-attributet SPAR per spår. Delas av webbläsaren och Netlify-funktionen,
 * så att funktionen bara tar emot värden som sajten själv skickar.
 */
export const SPAR_VARDE: Record<Slut, string> = {
  pension: 'pensionar',
  sasong: 'sasong',
  underArbete: 'under-arbete',
}

export const GILTIGA_SPAR: string[] = Object.values(SPAR_VARDE)
