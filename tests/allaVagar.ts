// Gemensamt underlag för logiktestet och rapporten rapporter/logik-matris.md:
// alla vägar genom frågorna, fasta testvärden och en oberoende uträkning av förväntat utfall.
import { beraknaVag } from '../src/flode'
import { byggSvar, byggUnderArbete, svarTillText, type Svar } from '../src/svar'
import { formatTal } from '../src/mall'
import { gallandeVarde } from '../scripts/gallande.mjs'
import reglerJson from '../data/regler.json'
import fragorJson from '../data/fragor.json'
import svarJson from '../data/svar.json'
import configJson from '../config.json'
import type { Config, Fraga, Regel, Slut, Status, SvarInnehall, Svaren } from '../src/types'

export const regler = reglerJson as Regel[]
export const fragor = fragorJson.fragor as Fraga[]
export const innehall = svarJson as unknown as SvarInnehall
export const riktigConfig = configJson as Config

/** Fast växelkurs för testerna: 1 kr = 3 baht. Då ligger "Under 20 000 kr" helt under Non-O-kravet. */
export const TESTKONFIG: Config = {
  shopifyLank: 'https://example.com/guide',
  epost: { mottagare: null, tjanst: '' },
  vaxelkurs: { thbPerSek: 3, datum: '2026-09-01' },
}

/** Sista dagen före och första dagen efter att SINK-avdraget ändras. */
export const FORE = '2026-12-31'
export const EFTER = '2027-01-01'
export const DATUM = [FORE, EFTER]

export interface Vag {
  svar: Svaren
  slut: Slut
}

/** Varje möjlig väg genom frågorna, i den ordning flödet ställer dem. */
export function allaVagar(): Vag[] {
  const vagar: Vag[] = []
  const gaIgenom = (svar: Svaren) => {
    const vag = beraknaVag(svar)
    if (vag.slut) return void vagar.push({ svar, slut: vag.slut })
    const nasta = vag.fragor[vag.fragor.length - 1]
    const fraga = fragor.find((f) => f.id === nasta)
    if (!fraga) throw new Error(`Flödet frågar efter ${nasta}, som saknas i data/fragor.json`)
    for (const alt of fraga.alternativ) gaIgenom({ ...svar, [nasta]: alt.id })
  }
  gaIgenom({})
  return vagar
}

export const vagNamn = (svar: Svaren) =>
  ['dagar', 'vistelse', 'alder', 'pengar', 'inkomst', 'bank', 'familj'].map((id) => svar[id] ?? '–').join(' / ')

export interface Post {
  vag: Vag
  datum: string
  modell: Svar | null
  text: string
}

export function byggPost(vag: Vag, datum: string): Post {
  if (vag.slut === 'underArbete') {
    const u = byggUnderArbete(innehall)
    return { vag, datum, modell: null, text: [u.rubrik, u.text, innehall.epost.rubrikUnderArbete, u.friskrivning].join('\n') }
  }
  const modell = byggSvar({ spar: vag.slut, svar: vag.svar, regler, fragor, config: TESTKONFIG, innehall, idag: datum })
  return { vag, datum, modell, text: svarTillText(modell) }
}

// --- Siffror -------------------------------------------------------------------------------

const TAL = /\d{1,3}(?:[  ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g
const normaliseraTal = (t: string) => String(Number(t.replace(/[  ]/g, '').replace(',', '.')))

export const talITexten = (text: string) => [...text.matchAll(TAL)].map((m) => normaliseraTal(m[0]))

/** Tal som får förekomma: värdena i regler.json och config.json (testets och den riktiga). Källadresser räknas inte. */
export function tillatnaTal(): Set<string> {
  const delar: string[] = []
  for (const r of regler) {
    delar.push(JSON.stringify(r.varde), r.villkor ?? '', r.senastKontrollerad ?? '')
  }
  for (const c of [TESTKONFIG, riktigConfig]) delar.push(String(c.vaxelkurs.thbPerSek ?? ''), c.vaxelkurs.datum ?? '')
  return new Set(delar.flatMap(talITexten))
}

// --- Regler som text, på samma sätt som svaret visar dem -------------------------------------

export const regel = (id: string) => {
  const r = regler.find((x) => x.id === id)
  if (!r) throw new Error(`regeln ${id} finns inte i data/regler.json`)
  return r
}

/** Regelns värde med enhet, som besökaren ser det, t.ex. "65 000 baht i månaden". */
export function visa(id: string, datum: string): string {
  const r = regel(id)
  const v = gallandeVarde(r, datum)
  const enhet = innehall.enheter[r.enhet] ?? r.enhet
  const varde = typeof v === 'number' ? formatTal(v) : String(v)
  return enhet ? `${varde} ${enhet}` : varde
}

export const vardeUtanEnhet = (id: string, datum: string) => {
  const v = gallandeVarde(regel(id), datum)
  return typeof v === 'number' ? formatTal(v) : String(v)
}

/** Oberoende uträkning av hur inkomstintervallet förhåller sig till Non-O-kravet i baht. */
export function forvantadInkomststatus(svar: Svaren, datum: string): Status {
  const alt = fragor.find((f) => f.id === 'inkomst')?.alternativ.find((a) => a.id === svar.inkomst)
  const krav = gallandeVarde(regel('non-o-inkomstkrav'), datum)
  const kurs = TESTKONFIG.vaxelkurs.thbPerSek
  if (!alt || alt.minSek === undefined || typeof krav !== 'number' || !kurs) return 'okant'
  const fran = alt.minSek * kurs
  const till = alt.maxSek == null ? Infinity : alt.maxSek * kurs
  if (krav < fran) return 'ok'
  if (krav > till) return 'under'
  return 'nara'
}

/** Meningar i en text, för att kunna peka ut vilken mening som bryter mot ett krav. */
export const meningar = (text: string) => text.split(/(?<=[.!?])\s+|\n+/).map((m) => m.trim()).filter(Boolean)
