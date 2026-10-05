import { afterEach, describe, expect, it, vi } from 'vitest'
import { hantera, type Beroenden } from '../netlify/functions/epost'
import { GILTIGA_SPAR, SPAR_VARDE } from '../src/spar'
import { epostAktiv, saknadKonfiguration } from '../scripts/regler.mjs'
import { saknasEllerPlatshallare } from '../scripts/platshallare.mjs'
import config from '../config.json'
import type { Config } from '../src/types'

const ADRESS = 'testperson@exempel.se'

function begaran(kropp: unknown, metod = 'POST') {
  return new Request('https://test.thailandskollen.se/api/epost', {
    method: metod,
    body: metod === 'POST' ? (typeof kropp === 'string' ? kropp : JSON.stringify(kropp)) : undefined,
  })
}

function brevoSvar(status: number, kropp: unknown = {}) {
  return vi.fn(async () => new Response(JSON.stringify(kropp), { status, headers: { 'Content-Type': 'application/json' } }))
}

const beroenden = (hamta: Beroenden['hamta'], over: Partial<Beroenden> = {}): Beroenden => ({ apiNyckel: 'hemlig-testnyckel', listaId: 11, mallId: 12, hamta, ...over })
const giltig = { email: ADRESS, samtycke: 'ja', spar: 'pensionar' }

afterEach(() => vi.restoreAllMocks())

describe('Netlify-funktionen för e-post (Brevo, dubbel bekräftelse)', () => {
  it('skickar adressen och spåret till Brevos double opt-in och inget annat', async () => {
    const hamta = brevoSvar(201)
    const svar = await hantera(begaran(giltig), beroenden(hamta as never))
    expect(svar.status).toBe(200)
    expect(hamta).toHaveBeenCalledTimes(1)
    const [url, init] = hamta.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.brevo.com/v3/contacts/doubleOptinConfirmation')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['api-key']).toBe('hemlig-testnyckel')
    expect(JSON.parse(init.body as string)).toEqual({
      email: ADRESS,
      attributes: { SPAR: 'pensionar' },
      includeListIds: [11],
      templateId: 12,
      redirectionUrl: 'https://test.thailandskollen.se/bekraftad/',
    })
  })

  it('tar bara emot spåren som sajten själv skickar', async () => {
    for (const spar of Object.values(SPAR_VARDE)) {
      const hamta = brevoSvar(201)
      expect((await hantera(begaran({ ...giltig, spar }), beroenden(hamta as never))).status).toBe(200)
    }
    expect(GILTIGA_SPAR).toEqual(['pensionar', 'sasong', 'under-arbete'])
    for (const spar of ['', 'admin', 'pension', undefined, 7]) {
      const hamta = brevoSvar(201)
      expect((await hantera(begaran({ ...giltig, spar }), beroenden(hamta as never))).status).toBe(400)
      expect(hamta).not.toHaveBeenCalled()
    }
  })

  it('kräver samtycke och en giltig adress, och skickar då ingenting till Brevo', async () => {
    const fel: unknown[] = [
      { ...giltig, samtycke: undefined },
      { ...giltig, samtycke: 'nej' },
      { ...giltig, samtycke: true },
      { ...giltig, email: '' },
      { ...giltig, email: 'inte-en-adress' },
      { ...giltig, email: 'a@b' },
      { ...giltig, email: 'a b@exempel.se' },
      { ...giltig, email: `${'a'.repeat(250)}@exempel.se` },
      { ...giltig, email: ['a@exempel.se'] },
      'inte json',
      '{}',
    ]
    for (const kropp of fel) {
      const hamta = brevoSvar(201)
      const svar = await hantera(begaran(kropp), beroenden(hamta as never))
      expect(svar.status, JSON.stringify(kropp)).toBe(400)
      expect(hamta).not.toHaveBeenCalled()
    }
  })

  it('vidarebefordrar inga andra fält, till exempel svar på frågorna', async () => {
    const hamta = brevoSvar(201)
    await hantera(begaran({ ...giltig, svar: { dagar: 'minst' }, dagar: 'minst', attributes: { ANNAT: 'x' }, includeListIds: [99] }), beroenden(hamta as never))
    const skickat = JSON.parse(((hamta.mock.calls[0] as unknown as [string, RequestInit])[1].body) as string)
    expect(Object.keys(skickat).sort()).toEqual(['attributes', 'email', 'includeListIds', 'redirectionUrl', 'templateId'])
    expect(skickat.attributes).toEqual({ SPAR: 'pensionar' })
    expect(skickat.includeListIds).toEqual([11])
  })

  it('utan API-nyckel, lista eller mall svarar den att den inte är konfigurerad och anropar inte Brevo', async () => {
    for (const over of [{ apiNyckel: undefined }, { apiNyckel: '' }, { listaId: null }, { mallId: null }]) {
      const hamta = brevoSvar(201)
      const svar = await hantera(begaran(giltig), beroenden(hamta as never, over))
      expect(svar.status).toBe(503)
      expect(hamta).not.toHaveBeenCalled()
    }
  })

  it('tar bara emot POST', async () => {
    const hamta = brevoSvar(201)
    for (const metod of ['GET', 'PUT', 'DELETE']) {
      expect((await hantera(begaran(null, metod), beroenden(hamta as never))).status).toBe(405)
    }
    expect(hamta).not.toHaveBeenCalled()
  })

  it('avvisar för stora begäran', async () => {
    const hamta = brevoSvar(201)
    const svar = await hantera(begaran({ ...giltig, fyllnad: 'x'.repeat(5000) }), beroenden(hamta as never))
    expect(svar.status).toBe(400)
    expect(hamta).not.toHaveBeenCalled()
  })

  it('en kontakt som redan finns ger samma svar som en ny, så att ingen kan läsa ut vilka adresser som är registrerade', async () => {
    const hamta = brevoSvar(400, { code: 'duplicate_parameter', message: 'Contact already exist' })
    const svar = await hantera(begaran(giltig), beroenden(hamta as never))
    expect(svar.status).toBe(200)
    expect(await svar.json()).toEqual({ ok: true })
  })

  it('andra fel från Brevo och nätverksfel blir 502, utan att adressen loggas', async () => {
    const logg = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fel = await hantera(begaran(giltig), beroenden(brevoSvar(401, { code: 'unauthorized', message: 'Key not found' }) as never))
    expect(fel.status).toBe(502)
    const nat = await hantera(begaran(giltig), beroenden((async () => { throw new Error(`nätfel för ${ADRESS}`) }) as never))
    expect(nat.status).toBe(502)
    expect(JSON.stringify(logg.mock.calls)).not.toContain(ADRESS)
    expect(JSON.stringify(await fel.clone().json())).not.toContain(ADRESS)
  })

  it('svaret kan inte cachas', async () => {
    const svar = await hantera(begaran(giltig), beroenden(brevoSvar(201) as never))
    expect(svar.headers.get('Cache-Control')).toBe('no-store')
  })
})

describe('e-postfältet och konfigurationen', () => {
  const fullstandig: Config = { ...(config as Config), epost: { tjanst: '/api/epost', listaId: 2, bekraftelsemallId: 3 } }

  it('visas bara när API-nyckeln, listan och mallen finns', () => {
    expect(epostAktiv(fullstandig, { BREVO_API_KEY: 'k' })).toBe(true)
    expect(epostAktiv(fullstandig, {})).toBe(false)
    expect(epostAktiv(fullstandig, { BREVO_API_KEY: '' })).toBe(false)
    expect(epostAktiv({ ...fullstandig, epost: { ...fullstandig.epost, listaId: null } }, { BREVO_API_KEY: 'k' })).toBe(false)
    expect(epostAktiv({ ...fullstandig, epost: { ...fullstandig.epost, bekraftelsemallId: null } }, { BREVO_API_KEY: 'k' })).toBe(false)
  })

  it('flaggar det som saknas, men stoppar inte produktionsbygget för det', () => {
    const saknas = saknadKonfiguration(config as Config, {}).join('\n')
    for (const d of ['shopifyLank', 'epost.listaId', 'epost.bekraftelsemallId', 'BREVO_API_KEY', 'integritet.ansvarig']) expect(saknas).toContain(d)
    expect(saknadKonfiguration({ ...fullstandig, shopifyLank: 'https://thailandskollen.se/products/guiden', integritet: { ansvarig: 'Raul Exempel', kontaktEpost: 'a@b.se' } }, { BREVO_API_KEY: 'k' })).toEqual([])
  })

  it('platshållare känns igen, riktiga värden inte', () => {
    for (const v of [null, '', 'https://thailandskollen.se/products/PLATSHALLARE', 'Raul [efternamn]']) expect(saknasEllerPlatshallare(v)).toBe(true)
    for (const v of ['https://thailandskollen.se/products/guiden', 'Raul Exempel']) expect(saknasEllerPlatshallare(v)).toBe(false)
  })

  it('API-nyckeln står aldrig i repots filer, bara namnet på miljövariabeln', async () => {
    const { execSync } = await import('node:child_process')
    const traffar = execSync('git ls-files', { encoding: 'utf-8' }).split('\n').filter(Boolean)
    const { readFileSync } = await import('node:fs')
    for (const fil of traffar.filter((f) => !f.endsWith('package-lock.json') && !f.startsWith('node_modules'))) {
      expect(readFileSync(fil, 'utf-8'), fil).not.toMatch(/xkeysib-[A-Za-z0-9]/)
    }
    expect(JSON.stringify(config)).not.toMatch(/api[-_ ]?key/i)
  })
})
