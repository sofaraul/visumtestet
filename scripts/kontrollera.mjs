// npm run kontrollera            kontrollerar alla källor, uppdaterar data/regler.json, skriver rapport, skapar ärenden
// npm run kontrollera -- --foresla   hämtar källorna och föreslår citat, ändrar ingenting i regler
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { idagIso } from './gallande.mjs'
import { laRegler } from './regler.mjs'
import { byggForslagsrapport, byggRapport, foreslaKallor, kontrolleraRegler } from './kontroll.mjs'
import { skapaArenden } from './arenden.mjs'

const rot = join(dirname(fileURLToPath(import.meta.url)), '..')
const idag = idagIso()
const rapportDir = join(rot, 'rapporter')
mkdirSync(rapportDir, { recursive: true })

const skrivRapport = (namn, text) => {
  writeFileSync(join(rapportDir, namn), text)
  console.log(text)
  console.log(`Rapport sparad: rapporter/${namn}`)
}

if (process.argv.includes('--foresla')) {
  const resultat = await foreslaKallor(laRegler())
  skrivRapport(`forslag-${idag}.md`, byggForslagsrapport({ idag, resultat }))
  process.exit(0)
}

const gamla = laRegler()
const { regler, rader, arenden } = await kontrolleraRegler(gamla, { idag })

if (JSON.stringify(regler) !== JSON.stringify(gamla)) {
  writeFileSync(join(rot, 'data', 'regler.json'), `${JSON.stringify(regler, null, 2)}\n`)
}

const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo } = process.env
let skapade = null
let skapaInte = !token || !repo
if (arenden.length && !skapaInte) {
  try {
    skapade = await skapaArenden(arenden, { token, repo })
  } catch (fel) {
    console.error(`Ärenden kunde inte skapas: ${fel.message}`)
    skapaInte = true
  }
}

skrivRapport(`${idag}.md`, byggRapport({ idag, rader, arenden, skapade, skapaInte }))
