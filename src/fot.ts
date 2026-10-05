import { h } from './dom'
import { innehall } from './data'

/** Sidfoten med länken till integritetstexten. Finns på varje sida. */
export function ritaFot(el: HTMLElement) {
  const lank = innehall.sidor.integritet.fotlank
  if (!lank) return
  el.className = 'fot'
  el.replaceChildren(h('a', { href: '/integritet/' }, lank))
}
