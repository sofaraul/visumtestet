// Gemensamt underlag för logiktestet och rapporten rapporter/logik-matris.md:
// alla vägar genom frågorna, fasta testvärden och en oberoende uträkning av förväntat utfall.
import { beraknaVag } from '../src/flode'
import { byggSvar, byggUnderArbete, renderaFraga, svarTillText, type Svar } from '../src/svar'
import { formatTal } from '../src/mall'
import { gallandeVarde } from '../scripts/gallande.mjs'
import reglerJson from '../data/regler.json'
import fragorJson from '../data/fragor.json'
import svarJson from '../data/svar.json'
import configJson from '../config.json'
import type { Config, Fraga, Regel, Slut, SvarInnehall, Svaren } from '../src/types'

export const regler = reglerJson as Regel[]
export const fragor = fragorJson.fragor as Fraga[]
export const innehall = svarJson as unknown as SvarInnehall
export const riktigConfig = configJson as Config

/** Fast växelkurs för testerna: 1 kr = 3 baht, hämtad 2026-09-01, belopp avrundade uppåt till hela hundratal kronor. */
export const TESTKONFIG: Config = {
  shopifyLank: 'https://example.com/guide',
  epost: { tjanst: '', listaId: null, bekraftelsemallId: null }, integritet: { ansvarig: 'A', kontaktEpost: 'a@b.se' },
  vaxelkurs: { thbPerSek: 3, datum: '2026-09-01' },
  avrundningKr: 100,
}

/** Samma konfiguration med en annan kurs, för att se att beloppen räknas fram och inte är inskrivna. */
export const medKurs = (thbPerSek: number | null): Config => ({ ...TESTKONFIG, vaxelkurs: { ...TESTKONFIG.vaxelkurs, thbPerSek } })

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
  konfig: Config
  modell: Svar | null
  text: string
}

export function byggPost(vag: Vag, datum: string, konfig: Config = TESTKONFIG): Post {
  if (vag.slut === 'underArbete') {
    const u = byggUnderArbete(innehall)
    return { vag, datum, konfig, modell: null, text: [u.rubrik, u.text, innehall.epost.rubrikUnderArbete, u.friskrivning].join('\n') }
  }
  const modell = byggSvar({ spar: vag.slut, svar: vag.svar, regler, fragor, config: konfig, innehall, idag: datum })
  return { vag, datum, konfig, modell, text: svarTillText(modell) }
}

/** Frågorna som besökaren ser, med framräknade belopp. */
export const renderadeFragor = (konfig: Config = TESTKONFIG, datum: string = FORE) =>
  fragor.map((f) => renderaFraga(f, { regler, fragor, config: konfig, innehall, idag: datum }))

// --- Siffror -------------------------------------------------------------------------------

const TAL = /\d{1,3}(?:[ \u00a0]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g
const normaliseraTal = (t: string) => String(Number(t.replace(/[ \u00a0]/g, '').replace(',', '.')))

export const talITexten = (text: string) => [...text.matchAll(TAL)].map((m) => normaliseraTal(m[0]))

/** Belopp i baht som svaret räknar om till kronor. */
export const bahtRegler = () => regler.filter((r) => r.enhet === 'THB' || r.enhet === 'THB/manad')

/**
 * Oberoende uträkning av "ungefär X kr": bahtbeloppet delat med kursen, avrundat uppåt till närmaste
 * `avrundning` kronor. Skrivet för sig så att testet inte delar kod med det som testas.
 */
export const forvantadKr = (baht: number, kurs: number, avrundning: number) => Math.ceil(baht / kurs / avrundning) * avrundning

/**
 * Tal som får förekomma: värdena i regler.json och config.json, samt belopp i kronor som räknas fram
 * ur reglernas baht och kursen. Källadresser räknas inte.
 */
export function tillatnaTal(konfig: Config = TESTKONFIG): Set<string> {
  const delar: string[] = []
  for (const r of regler) {
    delar.push(JSON.stringify(r.varde), r.villkor ?? '', r.senastKontrollerad ?? '')
  }
  for (const c of [konfig, riktigConfig]) delar.push(String(c.vaxelkurs.thbPerSek ?? ''), c.vaxelkurs.datum ?? '')
  const tal = new Set(delar.flatMap(talITexten))
  const kurs = konfig.vaxelkurs.thbPerSek
  if (kurs && konfig.avrundningKr) {
    for (const r of bahtRegler()) {
      const v = gallandeVarde(r, FORE)
      if (typeof v === 'number') tal.add(String(forvantadKr(v, kurs, konfig.avrundningKr)))
    }
  }
  return tal
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

/** Förväntat utfall av en Ja/Nej/Vet inte-fråga om ett belopp. */
export const forvantadJaNej = (svar: string | undefined) => (svar === 'ja' ? 'ok' : svar === 'nej' ? 'under' : 'okant')

/** Meningar i en text, för att kunna peka ut vilken mening som bryter mot ett krav. */
export const meningar = (text: string) => text.split(/(?<=[.!?])\s+|\n+/).map((m) => m.trim()).filter(Boolean)
