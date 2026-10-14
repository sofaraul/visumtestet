import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { kallaFran, kopLank, stada } from '../src/kalla'
import { hantera, svenskDag, type Beroenden } from '../netlify/functions/matning'
import config from '../config.json'
import svar from '../data/svar.json'

const VARD = 'test.thailandskollen.se'
const MAX = config.matning.maxTeckenKalla
const k = (sok: string, referrer = '') => kallaFran(`https://${VARD}/${sok}`, referrer, VARD, MAX)

describe('källan (uppdrag 4, punkt 1)', () => {
  it('svarssida blir svarssida- plus sidans adressnamn', () => {
    expect(k('?utm_source=svarssida&utm_medium=referral&utm_campaign=sink-pension-thailand')).toBe('svarssida-sink-pension-thailand')
  })
  it('annan utm_source blir utm_source, med gemener', () => {
    expect(k('?utm_source=thaisnack&utm_medium=forum&utm_campaign=pensionar')).toBe('thaisnack')
    expect(k('?utm_source=Facebook')).toBe('facebook')
    expect(k('?utm_source=kontroll')).toBe('kontroll')
  })
  it('utan utm_source: referrer från en annan webbplats blir ref- plus värdnamnet utan www', () => {
    expect(k('', 'https://www.google.com/search?q=x')).toBe('ref-google.com')
    expect(k('', 'https://thailandskollen.se/pages/om')).toBe('ref-thailandskollen.se')
    expect(k('', `https://${VARD}/integritet/`)).toBe('direkt')
  })
  it('ingenting blir direkt', () => {
    expect(k('')).toBe('direkt')
  })
  it('otillåtna tecken, tom källa och för långa källor blir okand', () => {
    expect(k('?utm_source=thai%20snack')).toBe('okand')
    expect(k('?utm_source=<script>')).toBe('okand')
    expect(k('?utm_source=')).toBe('okand')
    expect(k(`?utm_source=${'a'.repeat(MAX + 1)}`)).toBe('okand')
    expect(k(`?utm_source=${'a'.repeat(MAX)}`)).toBe('a'.repeat(MAX))
    expect(k('?utm_source=svarssida')).toBe('svarssida-')
    expect(stada('ref-google.com', MAX)).toBe('ref-google.com')
  })
})

describe('köpknappen (uppdrag 3 och 4, punkt 4)', () => {
  it('har utm_source=visumtest, utm_medium=referral, spåret i utm_campaign och källan i utm_content', () => {
    const p = new URL(kopLank(config.shopifyLank!, 'pension', 'thaisnack')).searchParams
    expect([p.get('utm_source'), p.get('utm_medium'), p.get('utm_campaign'), p.get('utm_content')]).toEqual(['visumtest', 'referral', 'pensionar', 'thaisnack'])
    expect(new URL(kopLank(config.shopifyLank!, 'sasong', 'direkt')).searchParams.get('utm_campaign')).toBe('sasong')
    expect(kopLank(config.shopifyLank!, 'pension', 'x').startsWith('https://thailandskollen.se/products/guiden?')).toBe(true)
  })
  it('knappen i svaret använder kopLank och räknar klicket', () => {
    const ui = readFileSync('src/ui.ts', 'utf-8')
    expect(ui).toContain("href: kopLank(s.erbjudande.lank, s.spar, kalla), onclick: () => rakna('kopklick', s.spar)")
  })
})

describe('räkningen i webbläsaren', () => {
  const kod = readFileSync('src/matning.ts', 'utf-8').replace(/\/\/.*$/gm, '')
  it('räknar bara på produktionens värd, inte i automatiserade webbläsare', () => {
    expect(config.matning.vard).toBe(VARD)
    expect(kod).toMatch(/location\.hostname === m\.vard && !navigator\.webdriver/)
  })
  it('använder inga cookies eller webbläsarlagring och skickar bara källa, steg och spår', () => {
    expect(kod).not.toMatch(/cookie|localStorage|sessionStorage|indexedDB/i)
    expect(kod).toContain('JSON.stringify({ kalla, steg, spar:')
    expect(kod).toContain('navigator.sendBeacon')
  })
  it('alla fyra steg räknas på rätt ställe', () => {
    expect(readFileSync('src/main.ts', 'utf-8')).toMatch(/rakna\('besok'\)/)
    expect(readFileSync('src/main.ts', 'utf-8')).toMatch(/rakna\('fullfoljt', vag\.slut!, true\)/)
    expect(readFileSync('src/main.ts', 'utf-8')).toMatch(/rakna\('fullfoljt', 'underArbete', true\)/)
    expect(readFileSync('src/epost.ts', 'utf-8')).toMatch(/if \(!svar\.ok\) throw new Error\(String\(svar\.status\)\)\n\s+rakna\('anmalan', spar\)/)
  })
})

function minne(): Beroenden & { nycklar: string[] } {
  const nycklar: string[] = []
  return {
    nycklar,
    lagring: {
      spara: async (n) => void nycklar.push(n),
      lista: async (prefix) => nycklar.filter((n) => n.startsWith(prefix)),
    },
    nu: () => new Date('2026-10-14T22:30:00Z'), // 00.30 den 15 oktober i svensk tid
    maxTeckenKalla: MAX,
    maxDagar: config.matning.maxDagar,
  }
}
const post = (kropp: unknown) => new Request('https://test.thailandskollen.se/api/matning', { method: 'POST', body: typeof kropp === 'string' ? kropp : JSON.stringify(kropp) })
const get = (sok: string) => new Request(`https://test.thailandskollen.se/api/matning${sok}`)

describe('Netlify-funktionen /api/matning', () => {
  it('sparar bara datum i svensk tid, steg, spår och källa', async () => {
    const d = minne()
    expect((await hantera(post({ kalla: 'thaisnack', steg: 'fullfoljt', spar: 'pensionar' }), d)).status).toBe(202)
    expect(d.nycklar).toHaveLength(1)
    expect(d.nycklar[0]).toMatch(/^2026-10-15\/fullfoljt\/pensionar\/thaisnack\/[0-9a-f-]{36}$/)
    expect(svenskDag(new Date('2026-10-14T21:59:00Z'))).toBe('2026-10-14')
  })
  it('besok har inget spår, de andra stegen måste ha ett giltigt spår', async () => {
    const d = minne()
    expect((await hantera(post({ kalla: 'direkt', steg: 'besok', spar: '' }), d)).status).toBe(202)
    expect((await hantera(post({ kalla: 'direkt', steg: 'besok', spar: 'pensionar' }), d)).status).toBe(400)
    for (const steg of ['fullfoljt', 'anmalan', 'kopklick']) {
      expect((await hantera(post({ kalla: 'direkt', steg, spar: '' }), d)).status).toBe(400)
      expect((await hantera(post({ kalla: 'direkt', steg, spar: 'under-arbete' }), d)).status).toBe(202)
    }
  })
  it('avvisar okända steg, källor som inte följer reglerna och skräp', async () => {
    const d = minne()
    for (const kropp of [{ kalla: 'direkt', steg: 'kop' }, { kalla: 'Thaisnack', steg: 'besok' }, { kalla: '../x', steg: 'besok' }, { kalla: 'a/b', steg: 'besok' }, 'inte json', 'x'.repeat(600)]) {
      expect((await hantera(post(kropp), d)).status).toBe(400)
    }
    expect(d.nycklar).toEqual([])
  })
  it('GET svarar med summor per källa och totalt, aldrig enskilda händelser', async () => {
    const d = minne()
    for (const [kalla, steg, spar] of [
      ['thaisnack', 'besok', ''],
      ['thaisnack', 'besok', ''],
      ['thaisnack', 'fullfoljt', 'pensionar'],
      ['thaisnack', 'kopklick', 'pensionar'],
      ['svarssida-sink-pension-thailand', 'besok', ''],
      ['svarssida-sink-pension-thailand', 'anmalan', 'sasong'],
    ]) await hantera(post({ kalla, steg, spar }), d)
    const svaret = await (await hantera(get('?fran=2026-10-15&till=2026-10-15'), d)).json()
    expect(svaret.perKalla.thaisnack.besok).toBe(2)
    expect(svaret.perKalla.thaisnack.fullfoljt.pensionar).toBe(1)
    expect(svaret.perKalla.thaisnack.kopklick.pensionar).toBe(1)
    expect(svaret.perKalla['svarssida-sink-pension-thailand'].anmalan.sasong).toBe(1)
    expect(svaret.totalt.besok).toBe(3)
    expect(JSON.stringify(svaret)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/)
    const tomt = await (await hantera(get('?fran=2026-10-01&till=2026-10-14'), d)).json()
    expect(tomt.totalt.besok).toBe(0)
  })
  it('kräver datum och högst maxDagar dagar', async () => {
    const d = minne()
    expect((await hantera(get(''), d)).status).toBe(400)
    expect((await hantera(get('?fran=2026-10-15&till=2026-10-01'), d)).status).toBe(400)
    expect((await hantera(get('?fran=2026-01-01&till=2026-12-31'), d)).status).toBe(400)
    expect((await hantera(get('?fran=2026-07-15&till=2026-10-15'), d)).status).toBe(200)
  })
  it('svaret kan inte cachas', async () => {
    const r = await hantera(get('?fran=2026-10-15&till=2026-10-15'), minne())
    expect(r.headers.get('Cache-Control')).toBe('no-store')
  })
})

describe('integritetstexten och robots.txt', () => {
  const sidor = JSON.stringify(svar.sidor.integritet)
  it('säger att källan sparas, att besök räknas per länk och att det görs utan cookies', () => {
    expect(sidor).toContain('Vi sparar också vilken sida eller vilket forum du kom från, så att vi ser vilka länkar som fungerar.')
    expect(sidor).toContain('Vi räknar hur många som besöker testet, fullföljer det, anmäler sig och klickar på köpknappen, per länk.')
    expect(sidor).toContain('Vi använder inga spårningscookies.')
    expect(sidor).toContain('Har du kryssat i att du vill ha tips och erbjudanden får du också några mejl om flytten och om guiden.')
  })
  it('rutan för erbjudanden har uppdragets text', () => {
    expect(svar.epost.erbjudanden).toBe('Ja, skicka mig också några tips inför flytten och erbjudanden om guiden.')
  })
  it('robots.txt tillåter /api/matning, så att måndagsrapporten kan hämta summorna', () => {
    const robots = readFileSync('public/robots.txt', 'utf-8')
    expect(robots).toMatch(/User-agent: \*/)
    expect(robots).not.toMatch(/Disallow: \/\s*$/m)
  })
})
