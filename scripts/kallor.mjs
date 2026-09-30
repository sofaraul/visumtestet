// npm run kallor: lista alla regler med källa och status.
import { laRegler, laConfig, laFragor, problemMedRegler, saknadKonfiguration, saknadeHjalptexter } from './regler.mjs'

const regler = laRegler()
const problem = new Map(problemMedRegler(regler).map((p) => [p.id, p.orsaker]))

const fmt = (r) => (r.varde === null ? '(tomt)' : `${r.varde} ${r.enhet}`)

console.log('\nREGLER – bocka av en i taget genom att öppna källan, jämföra och sedan\nsätta "verifierad": true och "senastKontrollerad": "ÅÅÅÅ-MM-DD" i data/regler.json.\n')

regler.forEach((r, i) => {
  const ok = !problem.has(r.id)
  console.log(`${String(i + 1).padStart(2)}. [${ok ? 'x' : ' '}] ${r.id}`)
  console.log(`      värde:        ${fmt(r)}`)
  console.log(`      källa:        ${r.kalla ?? 'SAKNAS – ange en källa'}`)
  console.log(`      kontrollerad: ${r.senastKontrollerad ?? 'aldrig'}`)
  if (!ok) console.log(`      status:       OVERIFIERAD (${problem.get(r.id).join(', ')})`)
  else console.log('      status:       verifierad')
  console.log('')
})

const antal = regler.length - problem.size
console.log(`${antal} av ${regler.length} regler verifierade.`)

const konfig = saknadKonfiguration(laConfig())
if (konfig.length) console.log(`\nconfig.json saknar: ${konfig.join(', ')}`)
const texter = saknadeHjalptexter(laFragor())
if (texter.length) console.log(`\ndata/fragor.json saknar hjälptext för: ${texter.join(', ')}`)

console.log(problem.size ? '\nProduktionsbygget (npm run build) stoppas tills alla regler är verifierade.\n' : '\nAlla regler är verifierade.\n')
