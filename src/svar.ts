import { formatTal, fyllMall, type MallKontext } from './mall'
import { jamforDagar, jamforJaNej, jamforVistelse } from './jamfor'
import type { Config, Fraga, Jamfor, Regel, SparMall, Status, SvarInnehall, SparNamn, Svaren } from './types'

export interface KravRad {
  regel: string
  jamfor: Jamfor
  text: string
  status: Status
  etikett: string
}

export interface Svar {
  spar: SparNamn
  /** Vilken mall i svar.json som användes, t.ex. sasongKort, sasongLang, pension eller pensionIngen. */
  mall: string
  rubriker: { vag: string; krav: string; skatt: string; fallgrop: string }
  vag: { namn: string; mening: string }
  /** Text om familj i Thailand, eller null. Nämner bara att en separat väg finns. */
  notis: string | null
  krav: KravRad[]
  skatt: string
  fallgrop: string
  erbjudande: { text: string; knapp: string; lank: string | null }
  kontrollText: string
  friskrivning: string
}

interface Underlag {
  regler: Regel[]
  fragor: Fraga[]
  config: Config
  innehall: SvarInnehall
  /** Datum (ÅÅÅÅ-MM-DD) för datumstyrda regler. Standard är idag. */
  idag?: string
}

interface Indata extends Underlag {
  spar: SparNamn
  svar: Svaren
}

const alternativText = (fragor: Fraga[], fraga: string, valt?: string) =>
  fragor.find((f) => f.id === fraga)?.alternativ.find((a) => a.id === valt)?.text

function formatDatum(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat('sv-SE', { dateStyle: 'long' }).format(d)
}

/** Värdena som mallar och frågor kan hämta: regler, besökarens svar samt kursen och dess datum. */
export function byggKontext({ svar = {}, regler, fragor, config, innehall, idag }: Underlag & { svar?: Svaren }): MallKontext {
  const { saknas } = innehall.gemensamt
  const { thbPerSek, datum } = config.vaxelkurs
  const varden: Record<string, string> = {}
  varden.vaxelkurs = thbPerSek ? `${formatTal(thbPerSek)} ${innehall.enheter.thbPerSek}` : saknas
  varden.vaxelkursDatum = datum ?? saknas
  const ctx: MallKontext = {
    regler: new Map(regler.map((r) => [r.id, r])),
    enheter: innehall.enheter,
    saknas,
    varden,
    anvanda: new Set(),
    idag,
    kurs: thbPerSek,
    avrundningKr: config.avrundningKr,
  }
  // Svarsalternativen kan själva ha platshållare, t.ex. åldersgränsen ur en regel.
  for (const f of fragor) {
    const text = alternativText(fragor, f.id, svar[f.id])
    varden[`svar.${f.id}`] = text ? fyllMall(text, ctx) : saknas
  }
  ctx.anvanda.clear()
  return ctx
}

/** Frågan som besökaren ser, med framräknade belopp ifyllda. */
export function renderaFraga(fraga: Fraga, underlag: Underlag): Fraga {
  const ctx = byggKontext(underlag)
  const fyll = (text: string) => fyllMall(text, ctx)
  return {
    ...fraga,
    text: fyll(fraga.text),
    hjalptext: fraga.hjalptext && fyll(fraga.hjalptext),
    alternativ: fraga.alternativ.map((a) => ({ ...a, text: fyll(a.text) })),
  }
}

/** Vilken mall i svar.json som gäller för besökarens svar. */
function valjMall(spar: SparNamn, svar: Svaren): keyof SvarInnehall['spar'] {
  if (spar === 'sasong') return svar.vistelse === 'langre' ? 'sasongLang' : 'sasongKort'
  return svar.inkomst === 'nej' && svar.bank === 'nej' ? 'pensionIngen' : 'pension'
}

export function byggSvar({ spar, svar, ...underlag }: Indata): Svar {
  const { config, innehall } = underlag
  const nyckel = valjMall(spar, svar)
  const mall = innehall.spar[nyckel] as SparMall
  const { gemensamt } = innehall
  const ctx = byggKontext({ svar, ...underlag })
  const fyll = (text: string) => fyllMall(text, ctx)
  const reglerMap = ctx.regler

  const krav = mall.krav.map((k): KravRad => {
    const status: Status =
      k.jamfor === 'inkomst' ? jamforJaNej(svar.inkomst)
      : k.jamfor === 'bank' ? jamforJaNej(svar.bank)
      : k.jamfor === 'vistelse' ? jamforVistelse(svar.vistelse)
      : k.jamfor === 'dagar' ? jamforDagar(svar.dagar)
      : k.jamfor === 'okant' ? 'okant'
      : 'info'
    ctx.anvanda.add(k.regel)
    return { regel: k.regel, jamfor: k.jamfor, text: fyll(k.text), status, etikett: k.status[status] ?? '' }
  })

  // SINK gäller svensk pension, så meningen visas bara när pengarna kommer från pension.
  const skattMall = mall.skatt[svar.dagar ?? 'vetInte'] ?? gemensamt.saknas
  const visaSink = mall.sink && svar.pengar && mall.sinkNar?.includes(svar.pengar)
  const skatt = [fyll(skattMall), visaSink ? fyll(mall.sink!) : ''].filter(Boolean).join(' ')

  const resultat: Svar = {
    spar,
    mall: nyckel,
    rubriker: { vag: gemensamt.rubrikVag, krav: mall.rubrikKrav ?? gemensamt.rubrikKrav, skatt: gemensamt.rubrikSkatt, fallgrop: gemensamt.rubrikFallgrop },
    vag: { namn: fyll(mall.vag.namn), mening: fyll(mall.vag.mening) },
    notis: svar.familj && gemensamt.familj[svar.familj] ? fyll(gemensamt.familj[svar.familj]) : null,
    krav,
    skatt,
    fallgrop: fyll(mall.fallgrop),
    erbjudande: { text: fyll(mall.erbjudande.text), knapp: mall.erbjudande.knapp, lank: config.shopifyLank },
    kontrollText: '',
    friskrivning: gemensamt.friskrivning,
  }
  resultat.kontrollText = kontrollText([...ctx.anvanda].map((id) => reglerMap.get(id)), innehall)
  return resultat
}

/** Äldsta kontrolldatum bland reglerna i svaret. Saknas ett datum visas "ej kontrollerad". */
export function kontrollText(anvanda: (Regel | undefined)[], innehall: SvarInnehall): string {
  const datum = anvanda.map((r) => r?.senastKontrollerad ?? null)
  const { kontrollerad, ejKontrollerad } = innehall.gemensamt
  if (datum.length === 0 || datum.some((d) => !d)) return ejKontrollerad
  const aldsta = (datum as string[]).sort()[0]
  return kontrollerad.replace('{datum}', formatDatum(aldsta))
}

/** Allt besökaren ser i svaret som ren text, en rad per stycke. Används av tester och rapporter. */
export function svarTillText(s: Svar): string {
  return [
    s.rubriker.vag,
    s.vag.namn,
    s.vag.mening,
    s.notis,
    s.rubriker.krav,
    ...s.krav.map((k) => `${k.etikett}. ${k.text}`),
    s.rubriker.skatt,
    s.skatt,
    s.rubriker.fallgrop,
    s.fallgrop,
    s.erbjudande.text,
    s.kontrollText,
    s.friskrivning,
  ]
    .filter((rad): rad is string => Boolean(rad))
    .join('\n')
}

/** Skärmen "Ditt spår är under arbete". Inga visumpåståenden. */
export function byggUnderArbete(innehall: SvarInnehall) {
  const { rubrik, text } = innehall.spar.underArbete
  return { rubrik, text, friskrivning: innehall.gemensamt.friskrivning }
}
