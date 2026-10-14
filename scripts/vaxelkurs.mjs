// npm run vaxelkurs: hämtar dagens kurs baht per krona och skriver den till config.json.
// Källa: ECB:s officiella referenskurser. De anges som valuta per 1 euro, så
// baht per krona = (THB per euro) / (SEK per euro).
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ECB_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'
const KALLA = 'ECB:s referenskurser (EUR/THB och EUR/SEK)'
const DECIMALER = 4

export function tolkaEcb(xml) {
  const datum = xml.match(/<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1]
  const kurs = (valuta) => Number(xml.match(new RegExp(`<Cube\\s+currency=['"]${valuta}['"]\\s+rate=['"]([\\d.]+)['"]`))?.[1])
  const thb = kurs('THB')
  const sek = kurs('SEK')
  if (!datum) throw new Error('hittade inget datum i ECB:s fil')
  if (!(thb > 0) || !(sek > 0)) throw new Error(`hittade inte giltiga kurser för THB och SEK (THB=${thb}, SEK=${sek})`)
  return { thbPerSek: Number((thb / sek).toFixed(DECIMALER)), datum }
}

export async function hamtaVaxelkurs(fetchFn = fetch) {
  const svar = await fetchFn(ECB_URL, { signal: AbortSignal.timeout(30000) })
  if (!svar.ok) throw new Error(`ECB svarade ${svar.status}`)
  return tolkaEcb(await svar.text())
}

/** Skriver kursen till config.json och lämnar övriga inställningar orörda. */
export function uppdateraConfig(config, { thbPerSek, datum }) {
  return { ...config, vaxelkurs: { thbPerSek, datum, kalla: KALLA } }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sokvag = join(dirname(fileURLToPath(import.meta.url)), '..', 'config.json')
  try {
    const kurs = await hamtaVaxelkurs()
    const gammal = readFileSync(sokvag, 'utf-8')
    const ny = `${JSON.stringify(uppdateraConfig(JSON.parse(gammal), kurs), null, 2)}\n`
    if (ny !== gammal) writeFileSync(sokvag, ny)
    console.log(`Växelkurs: ${kurs.thbPerSek} baht per krona, ${kurs.datum} (${KALLA})${ny === gammal ? ', oförändrad' : ''}`)
  } catch (fel) {
    console.error(`Växelkursen kunde inte hämtas: ${fel.message}. config.json är orörd.`)
    process.exit(1)
  }
}
