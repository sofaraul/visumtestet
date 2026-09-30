export interface Period {
  fran?: string | null
  till?: string | null
  varde: number | string | null
}

export interface Kalla {
  kalla: string
  citat: string | null
  metod: string
  sidhash: string | null
  kontrolleraVarde?: (number | string)[]
}

export interface Regel {
  id: string
  /** Ett värde, eller en lista med perioder för datumstyrda regler. */
  varde: number | string | null | Period[]
  enhet: string
  villkor?: string
  kalla: string | null
  senastKontrollerad: string | null
  verifierad: boolean
  // Källkontroll, se README. Används inte av sajten, bara av scripts/.
  citat?: string | null
  metod?: string
  bekraftad?: { av: string; datum: string } | null
  sidhash?: string | null
  extraKallor?: Kalla[]
  kontrolleraVarde?: (number | string)[]
  felIRad?: number
}

export interface Alternativ {
  id: string
  text: string
  minSek?: number
  maxSek?: number | null
}

export interface Fraga {
  id: string
  text: string
  /** "" = ägaren har inte lagt in texten än, null = frågan ska inte ha någon. */
  hjalptext: string | null
  alternativ: Alternativ[]
}

export interface Config {
  shopifyLank: string | null
  epost: { mottagare: string | null; tjanst: string }
  vaxelkurs: { thbPerSek: number | null; datum: string | null; kalla?: string }
}

export type Status = 'ok' | 'nara' | 'under' | 'info' | 'okant'
export type Jamfor = 'info' | 'inkomst' | 'bank' | 'alder' | 'dagar'
export type SparNamn = 'sasong' | 'pension'
export type Slut = SparNamn | 'underArbete'

export interface KravMall {
  regel: string
  jamfor: Jamfor
  text: string
}

export interface SparMall {
  vag: { namn: string; mening: string }
  krav: KravMall[]
  skatt: Record<string, string>
  fallgrop: string
  erbjudande: { text: string; knapp: string }
}

export interface SvarInnehall {
  granssnitt: Record<string, string>
  gemensamt: {
    rubrikVag: string
    rubrikKrav: string
    rubrikSkatt: string
    rubrikFallgrop: string
    saknas: string
    kontrollerad: string
    ejKontrollerad: string
    friskrivning: string
    status: Record<Status, string>
  }
  epost: Record<string, string>
  enheter: Record<string, string>
  spar: {
    sasong: SparMall
    pension: SparMall
    underArbete: { rubrik: string; text: string }
  }
}

export type Svaren = Record<string, string | undefined>
