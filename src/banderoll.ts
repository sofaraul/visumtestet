import { h } from './dom'
import { config, fragor, innehall, regler } from './data'

/** Röd banderoll i utveckling och förhandsvisning, aldrig i produktion. */
export function visaBanderoll(el: HTMLElement) {
  if (!__FORHANDSVISNING__) return
  const g = innehall.granssnitt
  const overifierade = regler.filter((r) => !r.verifierad).map((r) => r.id)
  const kfg: string[] = []
  if (!config.shopifyLank) kfg.push('shopifyLank')
  if (!config.epost.mottagare) kfg.push('epost.mottagare')
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
