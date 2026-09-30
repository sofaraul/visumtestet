// Hämtar en källsida och gör om den till jämförbar text. Ingen regellogik här.
import { createHash } from 'node:crypto'
import * as cheerio from 'cheerio'

const ANVANDARAGENT = 'Mozilla/5.0 (compatible; visumtestet-kallkontroll; +https://github.com/sofaraul/visumtestet)'
const MIN_TEXT = 40

/** Blanksteg i en följd blir ett blanksteg. Tecknen i övrigt lämnas orörda. */
export const normalisera = (text) => text.normalize('NFC').replace(/[  ​]/g, ' ').replace(/\s+/g, ' ').trim()

/** Text utan blanksteg. Jämförelser görs på den här formen, så radbrytningar och PDF-mellanrum spelar ingen roll. */
export const utanBlanksteg = (text) => normalisera(text).replace(/\s/g, '')

/** Fingeravtryck av hela sidans text, oberoende av blanksteg. */
export const sidhash = (text) => createHash('sha256').update(normalisera(text)).digest('hex')

export function htmlTillText(html) {
  const $ = cheerio.load(html)
  $('script, style, noscript, template, head, svg').remove()
  $('br, p, li, tr, h1, h2, h3, h4, h5, h6, div, section, article').append('\n')
  return normalisera($('body').length ? $('body').text() : $.root().text())
}

export async function pdfTillText(data) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const uppgift = pdfjs.getDocument({ data: new Uint8Array(data), useSystemFonts: true, verbosity: 0 })
  const dok = await uppgift.promise
  const sidor = []
  for (let n = 1; n <= dok.numPages; n++) {
    const innehall = await (await dok.getPage(n)).getTextContent()
    sidor.push(innehall.items.map((i) => ('str' in i ? i.str + (i.hasEOL ? '\n' : ' ') : '')).join(''))
  }
  await uppgift.destroy()
  return normalisera(sidor.join('\n'))
}

/** Gissar metod från adressen, används bara av förslagsläget. */
export const gissaMetod = (url) => (/\.pdf($|\?)/i.test(url) ? 'pdf' : 'html')

/**
 * Hämtar en källa och returnerar dess text. Kastar ett Error med orsaken på svenska.
 * Ett nytt försök görs vid nätverksfel och serverfel.
 */
export async function hamtaText(url, metod, { fetchFn = fetch, tidsgransMs = 30000, forsok = 2 } = {}) {
  let sistaFel
  for (let i = 0; i < forsok; i++) {
    try {
      const svar = await fetchFn(new URL(url).href, {
        headers: { 'user-agent': ANVANDARAGENT, accept: metod === 'pdf' ? 'application/pdf,*/*' : 'text/html,*/*' },
        redirect: 'follow',
        signal: AbortSignal.timeout(tidsgransMs),
      })
      if (svar.status >= 500) throw Object.assign(new Error(`servern svarade ${svar.status}`), { nyttForsok: true })
      if (!svar.ok) throw new Error(`servern svarade ${svar.status}`)
      const typ = svar.headers.get('content-type') ?? ''
      const text = metod === 'pdf' ? await pdfTillText(await svar.arrayBuffer()) : htmlTillText(await svar.text())
      if (metod === 'pdf' && /text\/html/i.test(typ)) throw new Error('förväntade en PDF men fick en webbsida')
      if (text.length < MIN_TEXT) throw new Error('sidan gav ingen läsbar text (tom sida eller bara skript)')
      return text
    } catch (fel) {
      sistaFel = fel
      const tillfallig = fel.nyttForsok || fel.name === 'TimeoutError' || fel.name === 'TypeError'
      if (!tillfallig) break
    }
  }
  const orsak = sistaFel?.cause?.message ? `${sistaFel.message} (${sistaFel.cause.message})` : (sistaFel?.message ?? 'okänt fel')
  throw new Error(orsak)
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Mönster för ett tal i olika skrivsätt (65000, 65 000, 65,000, 22,5 och 22.5). */
export function talMonster(tal) {
  const [heltal, decimal] = String(tal).split('.')
  const grupper = heltal.replace(/\B(?=(\d{3})+(?!\d))/g, '\u0000').split('\u0000').map(escape).join('[ .,]?')
  const decimaler = decimal ? `[.,]${decimal}` : ''
  // Inte mitt i ett större tal: 50 ska inte matcha 50 000 och 20 ska inte matcha 20,5.
  return new RegExp(`(?<!\\d)${grupper}${decimaler}(?!\\d)(?![ .,]\\d{3}(?!\\d))(?![.,]\\d)`)
}

/** Står värdet i texten? Tal matchas med talgränser, text jämförs utan blanksteg och versaler. */
export function innehallerVarde(text, varde) {
  if (typeof varde === 'string') return utanBlanksteg(text).toLowerCase().includes(utanBlanksteg(varde).toLowerCase())
  return talMonster(varde).test(normalisera(text))
}

/** Står citatet ordagrant i texten? Blanksteg spelar ingen roll, allt annat måste stämma. */
export const innehallerCitat = (text, citat) => utanBlanksteg(text).includes(utanBlanksteg(citat))

/** Meningar på sidan som innehåller något av värdena. Används i ärenden och förslag. */
export function hittaKandidater(text, varden, max = 5) {
  const meningar = text.split(/(?<=[.!?])\s+|\n+/).map(normalisera).filter(Boolean)
  return meningar
    .filter((m) => varden.some((v) => innehallerVarde(m, v)))
    .slice(0, max)
    .map((m) => (m.length > 300 ? `${m.slice(0, 300)} …` : m))
}
