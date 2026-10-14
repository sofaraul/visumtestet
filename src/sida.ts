import './style.css'
import { h } from './dom'
import { config, innehall } from './data'
import { ritaFot } from './fot'

// Enkla textsidor (integritet, bekräftad adress). Texterna står i data/svar.json under `sidor`.
const namn = document.body.dataset.sida as keyof typeof innehall.sidor
const sida = innehall.sidor[namn]

const { ansvarig, kontaktEpost } = config.integritet

/** Byter platshållarna mot värdena ur config.json och gör e-postadressen till en länk. */
function stycke(text: string): HTMLElement {
  const fylld = text.replaceAll('{ansvarig}', ansvarig)
  const delar = fylld.replaceAll('{kontaktEpost}', '\u0000').split('\u0000')
  const barn: (Node | string)[] = []
  delar.forEach((del, i) => {
    if (i > 0) barn.push(h('a', { href: `mailto:${kontaktEpost}` }, kontaktEpost))
    barn.push(del)
  })
  return h('p', {}, ...barn)
}

document.title = sida.titel
document.getElementById('app')!.replaceChildren(
  h('h1', {}, sida.rubrik),
  ...sida.stycken.flatMap((s) => (s.rubrik ? [h('h2', {}, s.rubrik), stycke(s.text)] : [stycke(s.text)])),
  h('a', { class: 'knapp sekundar', href: '/' }, sida.tillbaka),
)
ritaFot(document.getElementById('fot')!)
