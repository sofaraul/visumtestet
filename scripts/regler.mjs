// Delad kontroll av data/regler.json och config.json. Används av
// `npm run kallor` och av byggsteget i vite.config.ts.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { gallandeVarde, idagIso } from './gallande.mjs'
import { saknasEllerPlatshallare } from './platshallare.mjs'

const rot = join(dirname(fileURLToPath(import.meta.url)), '..')
const las = (sokvag) => JSON.parse(readFileSync(join(rot, sokvag), 'utf-8'))

export const laRegler = () => las('data/regler.json')
export const laConfig = () => las('config.json')
export const laFragor = () => las('data/fragor.json')

/** Regler som inte får följa med ett produktionsbygge, med orsak. */
export function problemMedRegler(regler, idag = idagIso()) {
  const problem = []
  for (const r of regler) {
    const orsaker = []
    if (r.verifierad !== true) orsaker.push('verifierad är inte true')
    else {
      const varde = gallandeVarde(r, idag)
      if (varde === null || varde === undefined || varde === '') orsaker.push(`värde saknas ${idag}`)
      if (!r.kalla) orsaker.push('källa saknas')
      if (!r.senastKontrollerad) orsaker.push('senastKontrollerad saknas')
      if (!r.bekraftad) orsaker.push('bekraftad saknas (en människa ska ha bekräftat regeln)')
    }
    if (orsaker.length) problem.push({ id: r.id, orsaker })
  }
  return problem
}

/**
 * E-postfältet visas bara när allt som behövs för att ta emot adresser finns: API-nyckeln
 * (miljövariabeln BREVO_API_KEY, hemlig, aldrig i repot) och id för Brevo-listan och
 * bekräftelsemallen i config.json. Avgörs vid bygget och bakas in som __EPOST_AKTIV__.
 */
export const epostAktiv = (config, env = process.env) =>
  Boolean(env.BREVO_API_KEY) && Boolean(config.epost?.listaId) && Boolean(config.epost?.bekraftelsemallId)

/**
 * Uppgifter i konfigurationen som saknas. Kursen och avrundningen är nödvändiga: frågorna om
 * inkomst och bankkonto räknar fram belopp i kronor ur dem. Övrigt är varningar.
 */
export function saknadKonfiguration(config, env = process.env) {
  const saknas = []
  if (saknasEllerPlatshallare(config.shopifyLank)) saknas.push('shopifyLank (platshållare eller tom: byt till produktens riktiga adress)')
  if (!config.epost?.listaId) saknas.push('epost.listaId (e-postfältet visas inte)')
  if (!config.epost?.bekraftelsemallId) saknas.push('epost.bekraftelsemallId (e-postfältet visas inte)')
  if (!env.BREVO_API_KEY) saknas.push('BREVO_API_KEY i miljön (e-postfältet visas inte)')
  if (saknasEllerPlatshallare(config.integritet?.ansvarig)) saknas.push('integritet.ansvarig (efternamnet saknas på integritetssidan)')
  if (!config.integritet?.kontaktEpost) saknas.push('integritet.kontaktEpost')
  if (!config.vaxelkurs?.thbPerSek) saknas.push('vaxelkurs.thbPerSek')
  if (!config.vaxelkurs?.datum) saknas.push('vaxelkurs.datum')
  if (!config.avrundningKr) saknas.push('avrundningKr')
  return saknas
}

/** De uppgifter i konfigurationen som produktionsbygget inte kan vara utan. */
export const nodvandigKonfiguration = (config, env = process.env) =>
  saknadKonfiguration(config, env).filter((s) => s.startsWith('vaxelkurs') || s === 'avrundningKr')

/** Frågor vars hjälptext är tom sträng (null betyder att ingen text ska visas). */
export function saknadeHjalptexter(fragor) {
  return fragor.fragor.filter((f) => f.hjalptext === '').map((f) => f.id)
}
