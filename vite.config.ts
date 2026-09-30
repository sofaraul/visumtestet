import { defineConfig, type Plugin } from 'vite'
import { laRegler, laConfig, problemMedRegler, saknadKonfiguration } from './scripts/regler.mjs'

/** Stoppar produktionsbygget om någon regel är overifierad. */
function verifieraRegler(): Plugin {
  return {
    name: 'verifiera-regler',
    buildStart() {
      const problem: { id: string; orsaker: string[] }[] = problemMedRegler(laRegler())
      if (problem.length) {
        const rader = problem.map((p) => `  - ${p.id}: ${p.orsaker.join(', ')}`).join('\n')
        throw new Error(
          `Produktionsbygget stoppat: ${problem.length} regler i data/regler.json är inte verifierade.\n${rader}\n` +
            'Kör `npm run kallor` för att se källorna. Förhandsvisningar (Vercel preview, Netlify deploy preview och branch deploy, `npm run build:forhandsvisning`) stoppas inte.',
        )
      }
      const saknas: string[] = saknadKonfiguration(laConfig())
      if (saknas.length) this.warn(`config.json saknar: ${saknas.join(', ')}`)
    },
  }
}

/**
 * Förhandsvisning = allt utom produktion: lokal utveckling, `--mode development`
 * och Vercels/Netlifys icke-produktionsbyggen. Där visas den röda banderollen och
 * bygget stoppas inte. Bara produktionsbygget kräver verifierade regler.
 */
const harForhandsvisningsMiljo = () =>
  process.env.VERCEL_ENV === 'preview' || ['deploy-preview', 'branch-deploy'].includes(process.env.CONTEXT ?? '')

export default defineConfig(({ mode }) => {
  const forhandsvisning = mode !== 'production' || harForhandsvisningsMiljo()
  return {
    define: { __FORHANDSVISNING__: JSON.stringify(forhandsvisning) },
    plugins: forhandsvisning ? [] : [verifieraRegler()],
  }
})
