// npm run logikmatris: skriver rapporter/logik-matris.md med en rad per väg genom frågorna.
// Texten före markören <!-- matris --> är handskriven (ändringar och skäl) och bevaras.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { allaVagar, byggPost, EFTER, FORE, fragor, vagNamn } from '../tests/allaVagar'
import type { Post } from '../tests/allaVagar'
import type { Status } from '../src/types'

const FIL = 'rapporter/logik-matris.md'
const MARKOR = '<!-- matris -->'

// Bara för visning i tabellen.
const KORT: Record<string, Record<string, string>> = {
  dagar: { farre: '<180', minst: '≥180', vetInte: '?' },
  vistelse: { hogst: '≤30/besök', langre: '>30/besök' },
  alder: { under: '<50', minst: '≥50' },
  pengar: { pension: 'pension', lon: 'lön', eget: 'eget företag', kapital: 'kapital', kombination: 'kombination' },
  inkomst: { ja: 'ja', nej: 'nej', vetInte: 'vet inte' },
  bank: { ja: 'ja', nej: 'nej', vetInte: 'vet inte' },
  familj: { nej: 'nej', make: 'make/maka', barn: 'barn' },
}
const FALT: Record<string, string> = { dagar: 'dagar', vistelse: 'vistelse', alder: 'ålder', pengar: 'pengar', inkomst: 'inkomst ≥ krav', bank: 'bank ≥ krav', familj: 'familj' }
const KRAVNAMN: Record<string, string> = {
  'non-o-inkomstkrav': 'inkomst',
  'non-o-bankkrav': 'bank',
  'non-o-kombination': 'kombination',
  'visumfri-vistelse-dagar': 'visumfri',
  'garantipension-max-vistelse': 'garantipension',
  'skatt-hemvist-dagar': 'hemvist',
}
const STATUSORD: Record<Status, string> = { ok: 'ja', nara: 'osäkert', under: 'nej', info: 'info', okant: 'ej avgörbart' }

const cell = (t: string) => t.replace(/\|/g, '\\|').replace(/\n/g, ' ')
const forstaMening = (t: string, max = 90) => {
  const m = t.split(/(?<=\.)\s/)[0]
  return m.length > max ? `${m.slice(0, max - 1)} …` : m
}
const sink = (p: Post) => p.text.match(/\bSINK\b[^.]*?(\d+(?:,\d+)? procent)/)?.[1]

const vagar = allaVagar()
const rader = vagar.map((v, i) => {
  const fore = byggPost(v, FORE)
  const efter = byggPost(v, EFTER)
  const svar = Object.entries(v.svar).map(([id, val]) => `${FALT[id]} ${KORT[id]?.[val as string] ?? val}`).join(', ')
  const m = fore.modell
  if (!m) return `| ${i + 1} | ${cell(svar)} | under arbete | Ditt spår är under arbete | – | – | – |`

  const krav = m.krav.map((k) => `${KRAVNAMN[k.regel] ?? k.regel}: ${STATUSORD[k.status]}`).join('; ')
  const skattNyckel = v.svar.dagar === 'farre' ? 'berör inte pengar som förs in' : v.svar.dagar === 'minst' ? 'blir bosatt, pengar kan beskattas' : 'villkorat: om ≥ gränsen blir bosatt'
  const s = sink(fore)
  const skatt = s ? `${skattNyckel}; SINK ${s}${sink(efter) !== s ? ` (${sink(efter)} från ${EFTER})` : ''}` : skattNyckel
  const vagText = m.mall === 'sasongLang' ? `${m.vag.namn}. ${m.vag.mening}` : m.vag.namn
  const vag = `${vagText}${m.notis ? ' + familjenotis' : ''}`
  return `| ${i + 1} | ${cell(svar)} | ${m.spar === 'sasong' ? 'säsong' : 'pension'} | ${cell(vag)} | ${cell(krav)} | ${cell(skatt)} | ${cell(forstaMening(m.fallgrop))} |`
})

const antal = (slut: string) => vagar.filter((v) => v.slut === slut).length
const tabell = [
  '## Matris',
  '',
  `${vagar.length} vägar genom frågorna: ${antal('sasong')} säsongsspår, ${antal('pension')} pensionärsspår och ${antal('underArbete')} "under arbete". Varje väg är byggd för ${FORE} och ${EFTER} med fast växelkurs och kontrollerad av \`npm test\` (tests/logik-matris.test.ts). Tabellen visar ${FORE}. Mellan datumen skiljer sig bara SINK-värdet.`,
  '',
  'Förklaring: krav visas som `krav: utfall`. *ja* = går att avgöra och stämmer, *nej* = går att avgöra och stämmer inte, *ej avgörbart* = går inte att jämföra med svaren (t.ex. "Vet inte"), *info* = visas som information. "inkomst ≥ krav" och "bank ≥ krav" är svaren på frågan om beloppet som räknats fram ur kravet i baht och kursen.',
  '',
  '| # | Svar | Spår | Trolig väg | Krav | Skatt | Fallgrop |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...rader,
  '',
].join('\n')

const huvud = existsSync(FIL) && readFileSync(FIL, 'utf-8').includes(MARKOR)
  ? readFileSync(FIL, 'utf-8').split(MARKOR)[0]
  : '# Logikmatris\n\n(Ändringar och skäl saknas.)\n\n'
writeFileSync(FIL, `${huvud}${MARKOR}\n\n${tabell}`)
console.log(`Skrev ${FIL}: ${vagar.length} vägar (${fragor.length} frågor). Första vägen: ${vagNamn(vagar[0].svar)}`)
