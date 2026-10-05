import { h } from './dom'
import { config, fragor, innehall, regler } from './data'
import { saknasEllerPlatshallare } from '../scripts/platshallare.mjs'

/** Röd banderoll i utveckling och förhandsvisning, aldrig i produktion. */
export function visaBanderoll(el: HTMLElement) {
  if (!__FORHANDSVISNING__) return
  const g = innehall.granssnitt
  const overifierade = regler.filter((r) => !r.verifierad).map((r) => r.id)
  const kfg: string[] = []
  if (saknasEllerPlatshallare(config.shopifyLank)) kfg.push('shopifyLank')
  if (!config.epost.listaId) kfg.push('epost.listaId')
  if (!config.epost.bekraftelsemallId) kfg.push('epost.bekraftelsemallId')
  if (config.epost.listaId && config.epost.bekraftelsemallId && !__EPOST_AKTIV__) kfg.push('BREVO_API_KEY (Netlify)')
  if (saknasEllerPlatshallare(config.integritet.ansvarig)) kfg.push('integritet.ansvarig')
  if (!config.vaxelkurs.thbPerSek) kfg.push('vaxelkurs.thbPerSek')
  if (!config.vaxelkurs.datum) kfg.push('vaxelkurs.datum')
  if (!config.avrundningKr) kfg.push('avrundningKr')
  const texter = fragor.filter((f) => f.hjalptext === '').map((f) => f.id)

  if (!overifierade.length && !kfg.length && !texter.length) return
  el.className = 'banderoll'
  el.setAttribute('role', 'status')
  if (overifierade.length) el.append(h('strong', {}, g.banderoll), h('p', {}, overifierade.join(', ')))
  if (kfg.length) el.append(h('p', {}, `${g.banderollKonfig} ${kfg.join(', ')}`))
  if (texter.length) el.append(h('p', {}, `${g.banderollTexter} ${texter.join(', ')}`))
}
