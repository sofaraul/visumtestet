import { formatTal, fyllMall, type MallKontext } from './mall'
import { jamforAlder, jamforBank, jamforDagar, jamforInkomst } from './jamfor'
import type { Config, Fraga, Regel, Status, SvarInnehall, SparNamn, Svaren } from './types'

export interface KravRad {
  text: string
  status: Status
  etikett: string
}

export interface Svar {
  spar: SparNamn
  vag: { namn: string; mening: string }
  krav: KravRad[]
  skatt: string
  fallgrop: string
  erbjudande: { text: string; knapp: string; lank: string | null }
  kontrollText: string
}

interface Indata {
  spar: SparNamn
  svar: Svaren
  regler: Regel[]
  fragor: Fraga[]
  config: Config
  innehall: SvarInnehall
}

const alternativText = (fragor: Fraga[], fraga: string, valt?: string) =>
  fragor.find((f) => f.id === fraga)?.alternativ.find((a) => a.id === valt)?.text

function formatDatum(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat('sv-SE', { dateStyle: 'long' }).format(d)
}

export function byggSvar({ spar, svar, regler, fragor, config, innehall }: Indata): Svar {
  const mall = innehall.spar[spar]
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

  const ctx: MallKontext = { regler: reglerMap, enheter: innehall.enheter, saknas: gemensamt.saknas, varden, anvanda: new Set() }
  const fyll = (text: string) => fyllMall(text, ctx)

  const krav = mall.krav.map((k): KravRad => {
    const regel = reglerMap.get(k.regel)
    const kravVarde = typeof regel?.varde === 'number' ? regel.varde : null
    const status: Status =
      k.jamfor === 'inkomst' ? jamforInkomst(inkomstAlt, kravVarde, thbPerSek)
      : k.jamfor === 'bank' ? jamforBank(svar.bank)
      : k.jamfor === 'alder' ? jamforAlder(svar.alder)
      : k.jamfor === 'dagar' ? jamforDagar(svar.dagar)
      : 'info'
    ctx.anvanda.add(k.regel)
    return { text: fyll(k.text), status, etikett: gemensamt.status[status] }
  })

  const skattMall = mall.skatt[svar.dagar ?? 'vetInte'] ?? mall.skatt.vetInte

  const resultat: Svar = {
    spar,
    vag: { namn: fyll(mall.vag.namn), mening: fyll(mall.vag.mening) },
    krav,
    skatt: fyll(skattMall),
    fallgrop: fyll(mall.fallgrop),
    erbjudande: { text: fyll(mall.erbjudande.text), knapp: mall.erbjudande.knapp, lank: config.shopifyLank },
    kontrollText: '',
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
