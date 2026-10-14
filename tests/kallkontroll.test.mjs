import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ANDRAD, FEL, MANUELL, OK, SAKNAS, byggForslagsrapport, byggRapport, foreslaKallor, kontrolleraRegler } from '../scripts/kontroll.mjs'
import { htmlTillText, hittaKandidater, innehallerCitat, innehallerVarde, pdfTillText, sidhash } from '../scripts/kalltext.mjs'
import { skapaArenden } from '../scripts/arenden.mjs'

const CITAT = 'Applicants must show a monthly income of not less than 65,000 baht'
const sida = (extra = '', mening = `${CITAT} per month.`) =>
  `<html><head><title>x</title><script>var a = "65,000 i skript";</script></head><body><h1>Visa</h1><p>${mening}</p><p>${extra}</p></body></html>`

let html = sida()
let server, bas
beforeAll(async () => {
  const pdf = readFileSync('tests/fixtures/non-o.pdf')
  server = createServer((req, res) => {
    if (req.url === '/sida') res.writeHead(200, { 'content-type': 'text/html' }).end(html)
    else if (req.url === '/non-o.pdf') res.writeHead(200, { 'content-type': 'application/pdf' }).end(pdf)
    else if (req.url === '/serverfel') res.writeHead(503).end('nej')
    else if (req.url === '/tom') res.writeHead(200, { 'content-type': 'text/html' }).end('<html><body><script>x()</script></body></html>')
    else res.writeHead(404).end('saknas')
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  bas = `http://127.0.0.1:${server.address().port}`
})
afterAll(() => server.close())

const hashAv = () => sidhash(htmlTillText(html))
const regel = (over = {}) => ({
  id: 'r1', varde: 65000, enhet: 'THB/manad', kalla: `${bas}/sida`, senastKontrollerad: '2026-01-01', verifierad: true,
  citat: CITAT, metod: 'html', bekraftad: { av: 'Raul', datum: '2026-01-01' }, sidhash: hashAv(), ...over,
})
const kor = (regler, idag = '2026-09-30') => kontrolleraRegler(regler, { idag })

describe('textutdrag', () => {
  it('html: skript och huvud räknas inte, blanksteg spelar ingen roll', () => {
    const text = htmlTillText(sida())
    expect(text).toContain(CITAT)
    expect(text).not.toContain('i skript')
    expect(innehallerCitat(text, 'Applicants   must show\na monthly income')).toBe(true)
  })
  it('pdf: text hämtas ur en riktig PDF', async () => {
    const text = await pdfTillText(readFileSync('tests/fixtures/non-o.pdf'))
    expect(innehallerCitat(text, CITAT)).toBe(true)
    expect(innehallerVarde(text, 65000)).toBe(true)
  })
  it('citatet måste stå ordagrant', () => {
    expect(innehallerCitat('income of 65,000 baht', 'income of 70,000 baht')).toBe(false)
  })
  it('kandidater är meningar som innehåller värdet', () => {
    expect(hittaKandidater('Hej. Kravet är 65 000 baht. Slut.', [65000])).toEqual(['Kravet är 65 000 baht.'])
  })
})

describe('status', () => {
  it('OK: citatet finns, värdet står i det och fingeravtrycket stämmer → datum uppdateras', async () => {
    const { regler, rader, arenden } = await kor([regel()])
    expect(rader[0].status).toBe(OK)
    expect(regler[0].senastKontrollerad).toBe('2026-09-30')
    expect(regler[0].verifierad).toBe(true)
    expect(arenden).toEqual([])
  })
  it('OK via PDF', async () => {
    const text = await pdfTillText(readFileSync('tests/fixtures/non-o.pdf'))
    const { rader } = await kor([regel({ kalla: `${bas}/non-o.pdf`, metod: 'pdf', sidhash: sidhash(text) })])
    expect(rader[0].status).toBe(OK)
  })
  it('ÄNDRAD: sidan har ändrats men citatet finns kvar → ärende, inget ändras i regeln', async () => {
    const r = regel()
    html = sida('Ny text om något annat.')
    const { regler, rader, arenden } = await kor([r])
    html = sida()
    expect(rader[0].status).toBe(ANDRAD)
    expect(regler[0]).toEqual(r)
    expect(arenden[0].titel).toBe('Källkontroll ÄNDRAD: r1')
    expect(arenden[0].text).toContain('Nytt fingeravtryck')
  })
  it('SAKNAS: värdet ändrat på sidan → verifierad false och ärende med gammalt citat och vad som finns nu', async () => {
    const r = regel()
    html = sida('', 'Applicants must show a monthly income of not less than 70,000 baht per month.')
    const { regler, rader, arenden } = await kor([r])
    html = sida()
    expect(rader[0].status).toBe(SAKNAS)
    expect(regler[0].verifierad).toBe(false)
    expect(arenden[0].text).toContain(`> ${CITAT}`)
    expect(arenden[0].text).toContain('Vad som finns på sidan nu')
    expect(arenden[0].text).toContain(bas)
  })
  it('SAKNAS: värdet i regeln står inte i citatet', async () => {
    const { rader, regler } = await kor([regel({ varde: 80000 })])
    expect(rader[0].status).toBe(SAKNAS)
    expect(regler[0].verifierad).toBe(false)
  })
  it('FEL: sidan går inte att hämta → ärende, räknare, verifierad false först efter tre i rad', async () => {
    let r = regel({ kalla: `${bas}/finns-inte` })
    for (const [n, forvantat] of [[1, true], [2, true], [3, false]]) {
      const { regler, rader, arenden } = await kor([r])
      expect(rader[0].status).toBe(FEL)
      expect(arenden[0].titel).toBe('Källkontroll FEL: r1')
      expect(regler[0].felIRad).toBe(n)
      expect(regler[0].verifierad).toBe(forvantat)
      r = regler[0]
    }
  })
  it('FEL: serverfel och tom sida', async () => {
    expect((await kor([regel({ kalla: `${bas}/serverfel` })])).rader[0].status).toBe(FEL)
    const tom = await kor([regel({ kalla: `${bas}/tom` })])
    expect(tom.rader[0].kallor[0].orsak).toContain('ingen läsbar text')
  })
  it('lyckad hämtning nollställer felräknaren', async () => {
    const { regler } = await kor([regel({ felIRad: 2 })])
    expect(regler[0].felIRad).toBe(0)
  })
  it('kontrollen bekräftar aldrig själv: verifierad false förblir false även när allt stämmer', async () => {
    const { regler, rader } = await kor([regel({ verifierad: false, senastKontrollerad: null })])
    expect(rader[0].status).toBe(OK)
    expect(regler[0].verifierad).toBe(false)
    expect(regler[0].senastKontrollerad).toBeNull()
  })
  it('MANUELL: saknas citat, fingeravtryck, bekräftelse eller automatisk metod kontrolleras ingenting', async () => {
    for (const over of [{ citat: null }, { sidhash: null }, { bekraftad: null }, { metod: 'manuell' }]) {
      const r = regel(over)
      const { regler, rader } = await kor([r])
      expect(rader[0].status).toBe(MANUELL)
      expect(regler[0]).toEqual(r)
    }
  })
  it('flera källor: alla måste stämma', async () => {
    const tva = regel({ extraKallor: [{ kalla: `${bas}/sida`, citat: 'Text som inte finns', metod: 'html', sidhash: hashAv() }] })
    const { rader, regler } = await kor([tva])
    expect(rader[0].status).toBe(SAKNAS)
    expect(rader[0].kallor.map((k) => k.status)).toEqual([OK, SAKNAS])
    expect(regler[0].verifierad).toBe(false)
  })
  it('datumstyrd regel: alla perioders värden måste stå i citatet om inget annat anges', async () => {
    const sink = regel({ varde: [{ till: '2026-12-31', varde: 65000 }, { fran: '2027-01-01', varde: 20 }] })
    expect((await kor([sink])).rader[0].status).toBe(SAKNAS)
    expect((await kor([{ ...sink, kontrolleraVarde: [65000] }])).rader[0].status).toBe(OK)
  })
})

describe('rapport och ärenden', () => {
  it('rapporten är på svenska och nämner status, ändringar och ärenden', async () => {
    const res = await kor([regel({ id: 'a', kalla: `${bas}/finns-inte` }), regel({ id: 'b', citat: null })])
    const rapport = byggRapport({ idag: '2026-09-30', rader: res.rader, arenden: res.arenden, skapaInte: true })
    expect(rapport).toContain('# Källkontroll 2026-09-30')
    expect(rapport).toContain('**FEL**')
    expect(rapport).toContain('**MANUELL**')
    expect(rapport).toContain('felIRad → 1')
    expect(rapport).toContain('Källkontroll FEL: a')
  })
  it('förslagsläget ändrar inget och föreslår meningar med värdet och fingeravtryck', async () => {
    const r = regel({ citat: null, metod: 'manuell', sidhash: null })
    const resultat = await foreslaKallor([r, regel({ id: 'trasig', kalla: `${bas}/finns-inte` })])
    expect(resultat[0].kandidater[0]).toContain('65,000 baht')
    expect(resultat[0].sidhash).toHaveLength(64)
    expect(resultat[1].fel).toContain('404')
    expect(byggForslagsrapport({ idag: '2026-09-30', resultat })).toContain('Kunde inte hämtas')
  })
  it('ärenden får etiketten källkontroll och befintliga öppna ärenden dubbleras inte', async () => {
    const anrop = []
    const fetchFn = async (url, init) => {
      anrop.push(`${init.method} ${url.replace('https://api.github.com/repos/o/r', '')}`)
      const json = (status, data) => ({ status, json: async () => data })
      if (init.method === 'POST' && url.endsWith('/labels')) return json(422, {})
      if (init.method === 'GET') return json(200, [{ title: 'Källkontroll FEL: a', html_url: 'https://github.com/o/r/issues/1' }])
      return json(201, { html_url: 'https://github.com/o/r/issues/2' })
    }
    const res = await skapaArenden(
      [{ titel: 'Källkontroll FEL: a', text: 'x' }, { titel: 'Källkontroll SAKNAS: b', text: 'y' }],
      { token: 't', repo: 'o/r', fetchFn },
    )
    expect(res['Källkontroll FEL: a']).toContain('fanns redan')
    expect(res['Källkontroll SAKNAS: b']).toBe('https://github.com/o/r/issues/2')
    expect(anrop.filter((a) => a.startsWith('POST /issues'))).toHaveLength(1)
  })
})
