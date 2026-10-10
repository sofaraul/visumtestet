import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import svar from '../data/svar.json'
import config from '../config.json'

const sidor = svar.sidor
const text = (s: { stycken: { rubrik?: string; text: string }[] }) => s.stycken.map((x) => `${x.rubrik ?? ''}\n${x.text}`).join('\n')

describe('integritetssidan /integritet', () => {
  const t = text(sidor.integritet)

  it('har alla punkter från uppdraget: ansvarig, vad och varför, var, hur länge, rättigheter, cookies', () => {
    expect(sidor.integritet.stycken.map((s) => s.rubrik)).toEqual(['Vem som ansvarar', 'Vad vi sparar och varför', 'Var uppgifterna finns', 'Hur länge', 'Dina rättigheter', 'Cookies'])
    expect(t).toContain('Personuppgiftsansvarig är {ansvarig}.')
    expect(t).toMatch(/e-postadress och vilket spår/)
    expect(t).toMatch(/bara om du har samtyckt/)
    expect(t).toMatch(/Dina svar på frågorna i testet sparas inte/)
    expect(t).toMatch(/Brevo, med servrar inom EU/)
    expect(t).toMatch(/Tills du avregistrerar dig/)
    expect(t).toMatch(/avregistreringslänk/)
    expect(t).toMatch(/få ut, rätta eller radera/)
    expect(t).toMatch(/Inga|inga spårningscookies/)
  })

  it('nämner inte längre FormSubmit eller löftet att mejla svaret', () => {
    const allt = JSON.stringify(svar)
    expect(allt).not.toMatch(/FormSubmit/i)
    expect(allt).not.toMatch(/svar mejlat|svaret mejlat/i)
    expect(allt).not.toMatch(/mejla (ditt|ett) svar/i)
  })

  it('platshållarna i texten finns i konfigurationen', () => {
    for (const [, nyckel] of t.matchAll(/\{([A-Za-z]+)\}/g)) expect(Object.keys(config.integritet), nyckel).toContain(nyckel)
    expect(config.integritet.kontaktEpost).toBe('hello@thailandskollen.se')
  })

  it('ansvarig är en enskild firma i Rauls namn, utan platshållare', () => {
    expect(config.integritet.ansvarig).toMatch(/^Raul .+, enskild firma$/)
    expect(config.integritet.ansvarig).not.toMatch(/\[|PLATSHALLARE/)
  })
})

describe('texten vid e-postfältet', () => {
  const e = svar.epost
  it('frågar efter besked om regler som berör besökaren, inte efter att mejla svaret', () => {
    expect(e.rubrik).toBe('Vill du få besked när reglerna som berör dig ändras?')
  })
  it('samtycket säger vad som sparas och länken går till integritetssidan', () => {
    expect(e.samtycke).toMatch(/e-postadress/)
    expect(e.samtycke).toMatch(/spår/)
    expect(e.integritetLank).toBeTruthy()
    const kod = readFileSync('src/epost.ts', 'utf-8')
    expect(kod).toContain("href: '/integritet/'")
  })
  it('tacktexten säger att adressen ännu inte är bekräftad', () => {
    expect(e.tack).toMatch(/bekräfta/)
    expect(e.tack).toContain('{epost}')
  })
  it('samtyckesrutan är inte förkryssad och sajten skickar bara adress, samtycke och spår', () => {
    const kod = readFileSync('src/epost.ts', 'utf-8')
    expect(kod).not.toMatch(/checked:|checked = true|setAttribute\('checked'/)
    expect(kod).toMatch(/JSON\.stringify\(\{ email: adress, samtycke: 'ja', spar: SPAR_VARDE\[spar\] \}\)/)
  })
})

describe('e-postfältet döljs när nyckeln eller id:n saknas', () => {
  it('formuläret ritas bara om __EPOST_AKTIV__ är sant, och inga svar eller mottagare finns kvar i koden', () => {
    const kod = readFileSync('src/epost.ts', 'utf-8')
    expect(kod).toMatch(/if \(!__EPOST_AKTIV__\) return null\n/)
    expect(kod).not.toMatch(/mottagare|formsubmit/i)
    expect(readFileSync('vite.config.ts', 'utf-8')).toMatch(/__EPOST_AKTIV__: JSON\.stringify\(epostAktiv\(laConfig\(\)\)\)/)
  })
})

describe('bekräftelsesidan /bekraftad', () => {
  it('finns, eftersom Brevo skickar besökaren dit efter bekräftelsen', () => {
    expect(sidor.bekraftad.rubrik).toMatch(/bekräftad/)
    expect(readFileSync('netlify/functions/epost.ts', 'utf-8')).toContain("'/bekraftad/'")
  })
})

describe('integritetslänken', () => {
  it('finns i sidfoten på varje sida', () => {
    for (const fil of ['index.html', 'integritet/index.html', 'bekraftad/index.html']) expect(readFileSync(fil, 'utf-8'), fil).toContain('id="fot"')
    expect(sidor.integritet.fotlank).toBeTruthy()
    expect(readFileSync('src/main.ts', 'utf-8')).toContain("ritaFot(document.getElementById('fot')!)")
    expect(readFileSync('src/sida.ts', 'utf-8')).toContain("ritaFot(document.getElementById('fot')!)")
  })
})
