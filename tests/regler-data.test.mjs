// Kontrollerar att de godkända citaten i data/regler.json är ordagrant de som ägaren godkänt,
// och att varje citat innehåller värdet det ska styrka.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { allaVarden } from '../scripts/gallande.mjs'
import { innehallerVarde } from '../scripts/kalltext.mjs'
import { kallorFor } from '../scripts/kontroll.mjs'

const regler = JSON.parse(readFileSync('data/regler.json', 'utf-8'))
const regel = (id) => regler.find((r) => r.id === id)
const BEKRAFTAD = { av: 'Raul', datum: '2026-09-30' }

describe('godkända citat: automatiska källor', () => {
  it('ltr-minalder följer källans formulering "över 50 år"', () => {
    const r = regel('ltr-minalder')
    expect(r.varde).toBe('över 50 år')
    expect(r.metod).toBe('pdf')
    expect(r.citat).toBe('Age: Must be over 50 years old')
    expect(r.kontrolleraVarde).toEqual([50])
  })
  it('ltr-inkomstkrav har det kortade citatet', () => {
    expect(regel('ltr-inkomstkrav').citat).toBe('Documents provided for this item must show an income of no less than 80,000 USD or 40,000 USD per year.')
  })
  it('ltr-inkomstkrav-alternativ och visumfri-vistelse-dagar är godkända som de föreslogs', () => {
    expect(regel('ltr-inkomstkrav-alternativ').citat).toBe(
      'In the case that submitted documents for proof of income provides a total income of lower than 80,000 USD, but not lower than 40,000 USD per year, the applicant must additionally submit following documents: Evidence of investment in Thailand in the name of the applicant of at least USD 250,000.',
    )
    expect(regel('visumfri-vistelse-dagar').citat).toBe(
      'Effective 15 September 2026, nationals of 60 countries, including Sweden and Latvia, are eligible to enter Thailand without a visa under the Visa Exemption Scheme for a period of up to 30 days for tourism purposes and short-term business.',
    )
  })
  it('sink-avdrag: Skatteverkets citat bär båda värdena, SFS-citatet bara 20 procent', () => {
    const r = regel('sink-avdrag')
    expect(r.citat).toContain('22,5 procent')
    expect(r.citat).toContain('20 procent från och med 1 januari 2027')
    expect(r.kontrolleraVarde).toBeUndefined()
    const sfs = r.extraKallor[0]
    expect(sfs.citat).toBe('Särskild inkomstskatt tas ut med 20 procent av skattepliktig inkomst.')
    expect(sfs.kontrolleraVarde).toEqual([20])
  })
  it('garantipension: regelns text behålls och kontrolleras mot "som regel inte rätt" respektive "högst ett år"', () => {
    const a = regel('garantipension-bosattning-utomlands')
    expect(a.varde).toBe('betalas som regel inte ut efter flytt från Sverige')
    expect(a.kontrolleraVarde).toEqual(['som regel inte rätt'])
    expect(a.citat).toBe('Om du flyttar från Sverige har du som regel inte rätt att få garantipension utbetald.')
    const b = regel('garantipension-max-vistelse')
    expect(b.kontrolleraVarde).toEqual(['högst ett år'])
    expect(b.citat).toBe('Planerar du att vara utomlands i högst ett år, kan du få behålla garantipensionen under din tillfälliga vistelse.')
  })
  it('automatiska källor har citat, fingeravtryck och bekräftelse', () => {
    const auto = regler.flatMap((r) => kallorFor(r).filter((k) => k.metod === 'html' || k.metod === 'pdf').map((k) => ({ r, k })))
    expect(auto.map((x) => x.r.id)).toEqual(expect.arrayContaining(['ltr-minalder', 'sink-avdrag', 'visumfri-vistelse-dagar']))
    for (const { r, k } of auto) {
      expect(k.citat, r.id).toBeTruthy()
      expect(k.sidhash, r.id).toMatch(/^[0-9a-f]{64}$/)
      expect(r.bekraftad, r.id).toEqual(BEKRAFTAD)
    }
  })
})

describe('godkända citat: manuella, lästa av Raul 2026-09-30', () => {
  const MANUELLA = {
    'non-o-forlangning-max': 'Each permission shall be granted for no more than 1 year.',
    'non-o-inkomstkrav': 'An alien must have evidence of monthly income of no less than 65,000 baht',
    'non-o-bankkrav': 'At least 2 months prior to the filing date and 3 months after being granted permission, an alien must have a deposit in a commercial bank located in Thailand of no less than 800,000 baht.',
    'non-o-bank-minsta-saldo': 'After being granted permission for 3 months, an alien can withdraw the said deposit and must have the remaining balance in the bank account of no less than 400,000 baht',
    'non-o-kombination': 'An alien must have an annual income and a deposit in a commercial bank located in Thailand with total sum of no less than 800.000 baht as of the filing date.',
    'o-a-forsakringskrav': 'with the coverage of no less than 100,000 USD or 3,000,000 baht for the entire duration of stay in the Kingdom.',
    'skatt-hemvist-dagar': 'If you stay in Thailand for the total of at least 180 days in the tax year, you are considered a "resident of Thailand" for tax purposes.',
    'non-o-minalder': 'An alien must be 50 years of age or over.',
  }
  for (const [id, citat] of Object.entries(MANUELLA)) {
    it(`${id}: citatet är ordagrant och metoden manuell`, () => {
      expect(regel(id).citat).toBe(citat)
      expect(regel(id).metod).toBe('manuell')
      expect(regel(id).sidhash).toBeNull()
      expect(regel(id).bekraftad).toEqual(BEKRAFTAD)
    })
  }
  it('non-o-kombination behåller källans skrivsätt 800.000 med punkt', () => {
    expect(regel('non-o-kombination').citat).toContain('800.000 baht')
  })
})

describe('varje citat innehåller värdet det ska styrka', () => {
  for (const r of regler) {
    for (const k of kallorFor(r)) {
      if (!k.citat) continue
      it(`${r.id} källa ${k.nr}`, () => {
        const varden = k.kontrolleraVarde ?? allaVarden(r)
        for (const v of varden) expect(innehallerVarde(k.citat, v), `värdet ${v} i "${k.citat}"`).toBe(true)
      })
    }
  }
})
