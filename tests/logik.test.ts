import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { beraknaVag, rensaSvar } from '../src/flode'
import { jamforBank, jamforInkomst } from '../src/jamfor'
import { fyllMall, type MallKontext } from '../src/mall'
import { problemMedRegler } from '../scripts/regler.mjs'
import { gallandeVarde } from '../scripts/gallande.mjs'
import regler from '../data/regler.json'
import fragorJson from '../data/fragor.json'
import svarJson from '../data/svar.json'

describe('förgrening', () => {
  it('färre än gränsen ger säsongsspåret: fråga 2 och 6, sedan svar', () => {
    expect(beraknaVag({ dagar: 'farre' }).fragor).toEqual(['dagar', 'alder'])
    expect(beraknaVag({ dagar: 'farre', alder: 'minst', familj: 'nej' })).toMatchObject({ slut: 'sasong', total: 3 })
  })
  it('vet inte och gränsen eller fler går vidare till fråga 2', () => {
    for (const dagar of ['minst', 'vetInte']) expect(beraknaVag({ dagar }).fragor).toEqual(['dagar', 'alder'])
  })
  it('under 50 och lön eller eget företag ger spår under arbete', () => {
    expect(beraknaVag({ dagar: 'minst', alder: 'under' }).slut).toBe('underArbete')
    for (const pengar of ['lon', 'eget'])
      expect(beraknaVag({ dagar: 'minst', alder: 'minst', pengar }).slut).toBe('underArbete')
  })
  it('övriga får pensionärsspåret med fråga 4, 5 och 6', () => {
    for (const pengar of ['pension', 'kapital', 'kombination']) {
      const svar = { dagar: 'minst', alder: 'minst', pengar, inkomst: 'lag', bank: 'ja', familj: 'nej' }
      expect(beraknaVag(svar)).toMatchObject({ slut: 'pension', total: 6, fragor: ['dagar', 'alder', 'pengar', 'inkomst', 'bank', 'familj'] })
    }
  })
  it('ändrat svar tar bort svar som inte längre hör till spåret', () => {
    const svar = rensaSvar({ dagar: 'minst', alder: 'minst', pengar: 'lon', inkomst: 'lag' })
    expect(svar.inkomst).toBeUndefined()
  })
})

describe('jämförelse av inkomst', () => {
  const kurs = 2
  const alt = (minSek: number, maxSek: number | null) => ({ id: 'x', text: 'x', minSek, maxSek })
  it('kravet inom intervallet är nära gränsen', () => expect(jamforInkomst(alt(10, 20), 30, kurs)).toBe('nara'))
  it('intervall helt över kravet', () => expect(jamforInkomst(alt(20, 30), 30, kurs)).toBe('ok'))
  it('intervall helt under kravet', () => expect(jamforInkomst(alt(1, 2), 30, kurs)).toBe('under'))
  it('öppet intervall uppåt räknas med', () => expect(jamforInkomst(alt(10, null), 30, kurs)).toBe('nara'))
  it('saknad växelkurs eller krav kan inte jämföras', () => {
    expect(jamforInkomst(alt(10, 20), 30, null)).toBe('okant')
    expect(jamforInkomst(alt(10, 20), null, kurs)).toBe('okant')
  })
  it('bank: kanske är nära gränsen', () => expect(jamforBank('kanske')).toBe('nara'))
})

describe('mallar', () => {
  const ctx = (): MallKontext => ({
    regler: new Map([
      ['a', { id: 'a', varde: 1500, enhet: 'THB', kalla: null, senastKontrollerad: null, verifierad: false }],
      ['b', { id: 'b', varde: null, enhet: 'dagar', kalla: null, senastKontrollerad: null, verifierad: false }],
    ]),
    enheter: { THB: 'baht', dagar: 'dagar' },
    saknas: '[saknas]',
    varden: { 'svar.x': 'Ja' },
    anvanda: new Set(),
  })
  it('fyller i värde med enhet, bara värde och svar', () => {
    const c = ctx()
    expect(fyllMall('{a} / {a.varde} / {svar.x}', c)).toBe('1 500 baht / 1 500 / Ja')
    expect([...c.anvanda]).toEqual(['a'])
  })
  it('tomt värde ger saknas, okänd platshållare syns', () => {
    expect(fyllMall('{b}', ctx())).toBe('[saknas]')
    expect(fyllMall('{finns-inte}', ctx())).toContain('okänd platshållare')
  })
})

describe('datumstyrda regler', () => {
  const sink = regler.find((r) => r.id === 'sink-avdrag')!
  it('rätt värde visas automatiskt efter datum', () => {
    expect(gallandeVarde(sink, '2026-01-01')).toBe(22.5)
    expect(gallandeVarde(sink, '2026-12-31')).toBe(22.5)
    expect(gallandeVarde(sink, '2027-01-01')).toBe(20)
    expect(gallandeVarde(sink, '2030-06-01')).toBe(20)
  })
  it('regel utan periodstart ger inget värde före start', () => {
    const visumfri = regler.find((r) => r.id === 'visumfri-vistelse-dagar')!
    expect(gallandeVarde(visumfri, '2026-09-14')).toBeNull()
    expect(gallandeVarde(visumfri, '2026-09-15')).toBe(30)
  })
  it('vanlig regel ger sitt värde oavsett datum', () => {
    expect(gallandeVarde({ varde: 65000 }, '2001-01-01')).toBe(65000)
  })
  it('mallen visar värdet som gäller idag', () => {
    const c = (): MallKontext => ({ regler: new Map([[sink.id, sink]]), enheter: { procent: 'procent' }, saknas: '?', varden: {}, anvanda: new Set() })
    expect(fyllMall('{sink-avdrag.varde}', c())).toMatch(/^(22,5|20)$/)
  })
})

describe('data skild från logik', () => {
  it('varje regel har fälten från uppdraget', () => {
    for (const r of regler) for (const falt of ['id', 'varde', 'enhet', 'kalla', 'senastKontrollerad', 'verifierad']) expect(r, r.id).toHaveProperty(falt)
  })
  it('byggkontrollen stoppar overifierade regler och släpper fullständiga', () => {
    const ok = { id: 'r', varde: 1, enhet: 'x', kalla: 'https://x', senastKontrollerad: '2026-01-01', verifierad: true, bekraftad: { av: 'A', datum: '2026-01-01' } }
    expect(problemMedRegler([ok])).toEqual([])
    expect(problemMedRegler([{ ...ok, verifierad: false }]).length).toBe(1)
    expect(problemMedRegler([{ ...ok, senastKontrollerad: null }]).length).toBe(1)
    expect(problemMedRegler([{ ...ok, kalla: null }]).length).toBe(1)
    expect(problemMedRegler([{ ...ok, varde: null }]).length).toBe(1)
    expect(problemMedRegler([{ ...ok, bekraftad: null }]).length).toBe(1)
  })
  it('regler vars period inte har börjat gälla stoppar bygget', () => {
    const regel = { id: 'r', varde: [{ fran: '2026-09-15', varde: 30 }], enhet: 'dagar', kalla: 'https://x', senastKontrollerad: '2026-09-30', verifierad: true, bekraftad: { av: 'A', datum: '2026-09-30' } }
    expect(problemMedRegler([regel], '2026-09-14').length).toBe(1)
    expect(problemMedRegler([regel], '2026-09-15')).toEqual([])
  })
  it('alla platshållare i svar.json pekar på en regel eller ett känt värde', () => {
    const ids = new Set(regler.map((r) => r.id))
    const svarId = new Set(fragorJson.fragor.map((f) => `svar.${f.id}`))
    const extra = new Set(['inkomstSek', 'inkomstThb', 'vaxelkurs', 'vaxelkursDatum', 'datum', 'n', 'total', 'epost'])
    const { _om, ...mallar } = svarJson
    void _om
    const text = JSON.stringify(mallar)
    for (const [, nyckel] of text.matchAll(/\{([A-Za-z0-9_.-]+)\}/g)) {
      expect(ids.has(nyckel.replace(/\.varde$/, '')) || svarId.has(nyckel) || extra.has(nyckel), nyckel).toBe(true)
    }
  })
  it('koden innehåller inga belopp eller gränser', () => {
    // Tillåtna siffror i koden är index och positioner (0, 1, -1), inga belopp.
    for (const fil of readdirSync('src').filter((f) => f.endsWith('.ts'))) {
      const kod = readFileSync(`src/${fil}`, 'utf-8')
        .replace(/\/\/.*$/gm, '')
        .replace(/'[^']*'|"[^"]*"|`[^`]*`|\/\{.*?\/g/g, '')
      const tal = kod.match(/(?<![\w.$])\d+(?:\.\d+)?(?![\w])/g) ?? []
      expect(tal.filter((t) => !['0', '1'].includes(t)), fil).toEqual([])
    }
  })
})
