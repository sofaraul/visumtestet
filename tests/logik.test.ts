import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { beraknaVag, rensaSvar } from '../src/flode'
import { jamforJaNej } from '../src/jamfor'
import { beraknaKr } from '../src/belopp'
import { fyllMall, type MallKontext } from '../src/mall'
import type { Config } from '../src/types'
import { nodvandigKonfiguration, problemMedRegler } from '../scripts/regler.mjs'
import { gallandeVarde } from '../scripts/gallande.mjs'
import regler from '../data/regler.json'
import fragorJson from '../data/fragor.json'
import svarJson from '../data/svar.json'

describe('förgrening', () => {
  it('färre än gränsen ger säsongsspåret: vistelsens längd och fråga 6, utan åldersfråga, sedan svar', () => {
    expect(beraknaVag({ dagar: 'farre' }).fragor).toEqual(['dagar', 'vistelse'])
    expect(beraknaVag({ dagar: 'farre', vistelse: 'hogst' }).fragor).toEqual(['dagar', 'vistelse', 'familj'])
    expect(beraknaVag({ dagar: 'farre', vistelse: 'langre', familj: 'nej' })).toMatchObject({ slut: 'sasong', total: 3 })
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

describe('jämförelse av belopp', () => {
  it('Ja, Nej och Vet inte ger ok, under och okänt', () => {
    expect(jamforJaNej('ja')).toBe('ok')
    expect(jamforJaNej('nej')).toBe('under')
    expect(jamforJaNej('vetInte')).toBe('okant')
    expect(jamforJaNej(undefined)).toBe('okant')
  })
})

describe('framräknade belopp', () => {
  it('delar baht med kursen och avrundar uppåt till närmaste steg', () => {
    expect(beraknaKr(65000, 3, 100)).toBe(21700) // 21 666,67 kr
    expect(beraknaKr(800000, 3, 100)).toBe(266700) // 266 666,67 kr
  })
  it('ett exakt belopp hamnar inte ett steg högre på grund av flyttal', () => {
    expect(beraknaKr(65000, 2, 100)).toBe(32500)
    expect(beraknaKr(300000, 3, 100)).toBe(100000)
  })
  it('utan kurs eller belopp finns inget att visa, och utan avrundning avrundas till hela kronor', () => {
    expect(beraknaKr(65000, null, 100)).toBeNull()
    expect(beraknaKr(65000, 0, 100)).toBeNull()
    expect(beraknaKr(65000, 3, null)).toBe(21667)
  })
  it('produktionsbygget kräver kurs, datum och avrundning', () => {
    const ok: Config = { shopifyLank: null, epost: { mottagare: null, tjanst: '' }, vaxelkurs: { thbPerSek: 3, datum: '2026-09-01' }, avrundningKr: 100 }
    expect(nodvandigKonfiguration(ok)).toEqual([])
    expect(nodvandigKonfiguration({ ...ok, vaxelkurs: { thbPerSek: null, datum: null } })).toEqual(['vaxelkurs.thbPerSek', 'vaxelkurs.datum'])
    expect(nodvandigKonfiguration({ ...ok, avrundningKr: null })).toEqual(['avrundningKr'])
  })
})

describe('platshållaren {regel-id.start}', () => {
  const ctx = (idag: string, r: Record<string, unknown>): MallKontext => ({
    regler: new Map([['r', { id: 'r', enhet: 'dagar', kalla: null, senastKontrollerad: null, verifierad: true, ...r } as never]]),
    enheter: { dagar: 'dagar', kr: 'kr' },
    saknas: '[saknas]',
    varden: {},
    anvanda: new Set(),
    idag,
  })
  it('ger startdatumet på svenska för perioden som gäller', () => {
    const r = { varde: [{ fran: '2026-09-15', varde: 30 }] }
    expect(fyllMall('{r.start}', ctx('2026-10-02', r))).toBe('15 september 2026')
    const flera = { varde: [{ till: '2026-12-31', varde: 22.5 }, { fran: '2027-01-01', varde: 20 }] }
    expect(fyllMall('{r.start}', ctx('2027-03-01', flera))).toBe('1 januari 2027')
  })
  it('ger [saknas] för vanliga regler, perioder utan startdatum och datum före starten', () => {
    expect(fyllMall('{r.start}', ctx('2026-10-02', { varde: 30 }))).toBe('[saknas]')
    expect(fyllMall('{r.start}', ctx('2026-10-02', { varde: [{ till: '2026-12-31', varde: 1 }] }))).toBe('[saknas]')
    expect(fyllMall('{r.start}', ctx('2026-09-14', { varde: [{ fran: '2026-09-15', varde: 30 }] }))).toBe('[saknas]')
  })
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
    const extra = new Set(['vaxelkurs', 'vaxelkursDatum', 'datum', 'n', 'total', 'epost'])
    const { _om, ...mallar } = svarJson
    void _om
    const text = JSON.stringify(mallar)
    for (const [, nyckel] of text.matchAll(/\{([A-Za-z0-9_.-]+)\}/g)) {
      expect(ids.has(nyckel.replace(/\.(varde|villkor|kr|start)$/, '')) || svarId.has(nyckel) || extra.has(nyckel), nyckel).toBe(true)
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
