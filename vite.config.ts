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
            'Kör `npm run kallor` för att se källorna. För en förhandsvisning utan kontroll: `npm run build:forhandsvisning`.',
        )
      }
      const saknas: string[] = saknadKonfiguration(laConfig())
      if (saknas.length) this.warn(`config.json saknar: ${saknas.join(', ')}`)
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: mode === 'production' ? [verifieraRegler()] : [],
}))
