import { describe, expect, it } from 'vitest'
import { hamtaVaxelkurs, tolkaEcb, uppdateraConfig } from '../scripts/vaxelkurs.mjs'

// Samma struktur som ECB:s eurofxref-daily.xml.
const xml = (extra = '') => `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <gesmes:subject>Reference rates</gesmes:subject>
  <Cube>
    <Cube time='2026-09-30'>
      <Cube currency='USD' rate='1.1000'/>
      <Cube currency='SEK' rate='11.0000'/>
      <Cube currency='THB' rate='38.5000'/>${extra}
    </Cube>
  </Cube>
</gesmes:Envelope>`

describe('växelkurs', () => {
  it('räknar baht per krona ur EUR/THB och EUR/SEK', () => {
    expect(tolkaEcb(xml())).toEqual({ thbPerSek: 3.5, datum: '2026-09-30' })
  })
  it('kastar fel om en valuta eller datum saknas', () => {
    expect(() => tolkaEcb(xml().replace(/<Cube currency='THB'[^>]*>/, ''))).toThrow(/THB/)
    expect(() => tolkaEcb('<Cube/>')).toThrow(/datum/)
  })
  it('hämtar via fetch och felar på HTTP-fel', async () => {
    expect(await hamtaVaxelkurs(async () => ({ ok: true, text: async () => xml() }))).toMatchObject({ datum: '2026-09-30' })
    await expect(hamtaVaxelkurs(async () => ({ ok: false, status: 503 }))).rejects.toThrow(/503/)
  })
  it('uppdaterar bara växelkursen i config', () => {
    const ny = uppdateraConfig({ shopifyLank: 'x', epost: { mottagare: 'a' }, vaxelkurs: { thbPerSek: null, datum: null } }, { thbPerSek: 3.5, datum: '2026-09-30' })
    expect(ny.shopifyLank).toBe('x')
    expect(ny.epost).toEqual({ mottagare: 'a' })
    expect(ny.vaxelkurs).toMatchObject({ thbPerSek: 3.5, datum: '2026-09-30' })
  })
})
