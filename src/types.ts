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
  /** Belopp i kronor som räknas fram ur baht avrundas uppåt till närmaste så här många kronor. */
  avrundningKr: number | null
  /** tjanst är adressen till Netlify-funktionen. Id:n kommer från Brevo och saknas tills kontot finns. */
  epost: { tjanst: string; listaId: number | null; bekraftelsemallId: number | null }
  integritet: { ansvarig: string; kontaktEpost: string }
  vaxelkurs: { thbPerSek: number | null; datum: string | null; kalla?: string }
}

export type Status = 'ok' | 'nara' | 'under' | 'info' | 'okant'
export type Jamfor = 'info' | 'okant' | 'inkomst' | 'bank' | 'dagar' | 'vistelse'
export type SparNamn = 'sasong' | 'pension'
export type Slut = SparNamn | 'underArbete'

export interface KravMall {
  regel: string
  jamfor: Jamfor
  text: string
  /** Etikett per utfall. Skriv bara de utfall som går att avgöra från svaren. */
  status: Partial<Record<Status, string>>
}

export interface SparMall {
  vag: { namn: string; mening: string }
  /** Egen rubrik för kraven. Standard är gemensamt.rubrikKrav. */
  rubrikKrav?: string
  krav: KravMall[]
  skatt: Record<string, string>
  /** Mening om SINK, som bara visas när svaret på frågan om var pengarna kommer ifrån finns i `sinkNar`. */
  sink?: string
  sinkNar?: string[]
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
    /** Notis när besökaren har familj i Thailand, per svarsalternativ. Bara att en separat väg finns. */
    familj: Record<string, string>
  }
  epost: Record<string, string>
  sidor: Record<'integritet' | 'bekraftad', Sida>
  enheter: Record<string, string>
  spar: {
    sasongKort: SparMall
    sasongLang: SparMall
    pension: SparMall
    pensionIngen: SparMall
    underArbete: { rubrik: string; text: string }
  }
}

export interface Sida {
  titel: string
  rubrik: string
  /** Stycken. {ansvarig} och {kontaktEpost} hämtas ur config.json. */
  stycken: { rubrik?: string; text: string }[]
  tillbaka: string
  /** Länktext i sidfoten på alla sidor. */
  fotlank?: string
}

export type Svaren = Record<string, string | undefined>
