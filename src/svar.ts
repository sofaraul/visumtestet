import { gallandeVarde } from '../scripts/gallande.mjs'
import { formatTal, fyllMall, type MallKontext } from './mall'
import { jamforBank, jamforDagar, jamforInkomst, jamforVistelse } from './jamfor'
import type { Config, Fraga, Jamfor, Regel, Status, SvarInnehall, SparNamn, Svaren } from './types'

export interface KravRad {
  regel: string
  jamfor: Jamfor
  text: string
  status: Status
  etikett: string
}

export interface Svar {
  spar: SparNamn
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

interface Indata {
  spar: SparNamn
  svar: Svaren
  regler: Regel[]
  fragor: Fraga[]
  config: Config
  innehall: SvarInnehall
  /** Datum (ÅÅÅÅ-MM-DD) för datumstyrda regler. Standard är idag. */
  idag?: string
}

const alternativText = (fragor: Fraga[], fraga: string, valt?: string) =>
  fragor.find((f) => f.id === fraga)?.alternativ.find((a) => a.id === valt)?.text

function formatDatum(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat('sv-SE', { dateStyle: 'long' }).format(d)
}

export function byggSvar({ spar, svar, regler, fragor, config, innehall, idag }: Indata): Svar {
  const mall = innehall.spar[spar === 'sasong' ? (svar.vistelse === 'langre' ? 'sasongLang' : 'sasongKort') : spar]
  const { gemensamt } = innehall
  const reglerMap = new Map(regler.map((r) => [r.id, r]))
  const { thbPerSek, datum } = config.vaxelkurs

  const inkomstAlt = fragor.find((f) => f.id === 'inkomst')?.alternativ.find((a) => a.id === svar.inkomst)
  const varden: Record<string, string> = {}
  for (const f of fragor) varden[`svar.${f.id}`] = alternativText(fragor, f.id, svar[f.id]) ?? gemensamt.saknas
  varden.inkomstSek = inkomstAlt?.text ?? gemensamt.saknas
  varden.inkomstThb =
    inkomstAlt && thbPerSek ? intervallThb(inkomstAlt.minSek, inkomstAlt.maxSek, thbPerSek) : gemensamt.saknas
  varden.vaxelkurs = thbPerSek ? `${formatTal(thbPerSek)} ${innehall.enheter.thbPerSek}` : gemensamt.saknas
  varden.vaxelkursDatum = datum ? formatDatum(datum) : gemensamt.saknas

  const ctx: MallKontext = { regler: reglerMap, enheter: innehall.enheter, saknas: gemensamt.saknas, varden, anvanda: new Set(), idag }
  const fyll = (text: string) => fyllMall(text, ctx)

  const krav = mall.krav.map((k): KravRad => {
    const regel = reglerMap.get(k.regel)
    const gallande = regel ? gallandeVarde(regel, idag) : null
    const kravVarde = typeof gallande === 'number' ? gallande : null
    const status: Status =
      k.jamfor === 'inkomst' ? jamforInkomst(inkomstAlt, kravVarde, thbPerSek)
      : k.jamfor === 'bank' ? jamforBank(svar.bank)
      : k.jamfor === 'vistelse' ? jamforVistelse(svar.vistelse)
      : k.jamfor === 'dagar' ? jamforDagar(svar.dagar)
      : k.jamfor === 'okant' ? 'okant'
      : 'info'
    ctx.anvanda.add(k.regel)
    return { regel: k.regel, jamfor: k.jamfor, text: fyll(k.text), status, etikett: k.status[status] ?? '' }
  })

  const skattMall = mall.skatt[svar.dagar ?? 'vetInte'] ?? gemensamt.saknas

  const resultat: Svar = {
    spar,
    rubriker: { vag: gemensamt.rubrikVag, krav: gemensamt.rubrikKrav, skatt: gemensamt.rubrikSkatt, fallgrop: gemensamt.rubrikFallgrop },
    vag: { namn: fyll(mall.vag.namn), mening: fyll(mall.vag.mening) },
    notis: svar.familj && gemensamt.familj[svar.familj] ? fyll(gemensamt.familj[svar.familj]) : null,
    krav,
    skatt: fyll(skattMall),
    fallgrop: fyll(mall.fallgrop),
    erbjudande: { text: fyll(mall.erbjudande.text), knapp: mall.erbjudande.knapp, lank: config.shopifyLank },
    kontrollText: '',
    friskrivning: gemensamt.friskrivning,
  }
  resultat.kontrollText = kontrollText([...ctx.anvanda].map((id) => reglerMap.get(id)), innehall)
  return resultat
}

function intervallThb(minSek: number | undefined, maxSek: number | null | undefined, kurs: number): string {
  const fran = minSek ? formatTal(Math.round(minSek * kurs)) : null
  const till = maxSek ? formatTal(Math.round(maxSek * kurs)) : null
  if (fran && till) return `${fran}–${till} baht`
  if (till) return `under ${till} baht`
  if (fran) return `över ${fran} baht`
  return ''
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
