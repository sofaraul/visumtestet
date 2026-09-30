import { h } from './dom'
import { fragor, innehall } from './data'
import { byggUnderArbete, type Svar } from './svar'
import type { Fraga, Status } from './types'
import { epostFormular } from './epost'

const g = innehall.granssnitt
const ikon: Record<Status, string> = { ok: '✓', nara: '!', under: '✗', info: 'i', okant: '?' }

export interface Atgarder {
  start(): void
  tillbaka(): void
  /** Returnerar false om frågan inte är besvarad. */
  nasta(): boolean
  valj(fragaId: string, alternativId: string): void
  omstart(): void
}

export function introSkarm(a: Atgarder): HTMLElement {
  return h(
    'section',
    {},
    h('h1', { tabindex: '-1' }, g.introRubrik),
    h('p', {}, g.introText),
    h('button', { class: 'knapp', type: 'button', onclick: a.start }, g.start),
  )
}

function topp(a: Atgarder, n?: number, total?: number): HTMLElement {
  const rad = h('div', { class: 'topp' }, h('button', { class: 'tillbaka', type: 'button', onclick: a.tillbaka }, `← ${g.tillbaka}`))
  if (n === undefined || total === undefined) return rad
  const text = g.fragaAv.replace('{n}', String(n)).replace('{total}', String(total))
  const bar = h('div', { class: 'forlopp', role: 'progressbar', 'aria-valuemin': '1', 'aria-valuemax': String(total), 'aria-valuenow': String(n), 'aria-label': text })
  const fyllning = h('div', { class: 'forlopp-fyllning' })
  fyllning.style.width = `${(n / total) * 100}%`
  bar.append(fyllning)
  rad.append(h('p', { class: 'fraga-nr' }, text))
  return h('div', {}, rad, bar)
}

export function fragaSkarm(f: Fraga, valt: string | undefined, n: number, total: number, a: Atgarder): HTMLElement {
  const meddelande = h('p', { class: 'fel', role: 'alert' })
  const nasta = () => {
    if (!a.nasta()) meddelande.textContent = g.valjSvar
  }
  return h(
    'section',
    {},
    topp(a, n, total),
    h(
      'fieldset',
      { class: 'fraga' },
      h('legend', { tabindex: '-1' }, f.text),
      f.hjalptext && h('p', { class: 'hjalp' }, f.hjalptext),
      ...f.alternativ.map((alt) => {
        const id = `${f.id}-${alt.id}`
        const radio = h('input', { type: 'radio', name: f.id, id, value: alt.id, onchange: () => {
          meddelande.textContent = ''
          a.valj(f.id, alt.id)
        },
      })
        if (valt === alt.id) radio.checked = true
        return h('label', { class: 'alternativ', for: id }, radio, h('span', {}, alt.text))
      }),
    ),
    meddelande,
    h('button', { class: 'knapp', type: 'button', onclick: nasta }, g.nasta),
  )
}

function sektion(rubrik: string, ...barn: (Node | string)[]): HTMLElement {
  return h('section', { class: 'kort' }, h('h2', {}, rubrik), ...barn)
}

export function svarSkarm(s: Svar, a: Atgarder): HTMLElement {
  const epost = epostFormular(innehall.epost.rubrik, s.spar)
  return h(
    'article',
    {},
    topp(a),
    h('h1', { tabindex: '-1' }, s.rubriker.vag),
    h('section', { class: 'kort' }, h('p', { class: 'vagnamn' }, s.vag.namn), h('p', {}, s.vag.mening), s.notis && h('p', { class: 'notis' }, s.notis)),
    sektion(
      s.rubriker.krav,
      h(
        'ul',
        { class: 'krav' },
        ...s.krav.map((k) =>
          h(
            'li',
            { class: `krav-${k.status}` },
            k.etikett && h('span', { class: 'status' }, h('span', { 'aria-hidden': 'true', class: 'ikon' }, ikon[k.status]), k.etikett),
            h('span', {}, k.text),
          ),
        ),
      ),
    ),
    sektion(s.rubriker.skatt, h('p', {}, s.skatt)),
    sektion(s.rubriker.fallgrop, h('p', {}, s.fallgrop)),
    h(
      'section',
      { class: 'kort erbjudande' },
      h('p', {}, s.erbjudande.text),
      s.erbjudande.lank && h('a', { class: 'knapp', href: s.erbjudande.lank }, s.erbjudande.knapp),
    ),
    h('p', { class: 'kontroll' }, s.kontrollText),
    h('p', { class: 'friskrivning' }, s.friskrivning),
    epost,
    h('button', { class: 'knapp sekundar', type: 'button', onclick: a.omstart }, g.borjaOm),
  )
}

export function underArbeteSkarm(a: Atgarder): HTMLElement {
  const u = byggUnderArbete(innehall)
  return h(
    'article',
    {},
    topp(a),
    h('h1', { tabindex: '-1' }, u.rubrik),
    h('p', {}, u.text),
    epostFormular(innehall.epost.rubrikUnderArbete, 'underArbete'),
    h('p', { class: 'friskrivning' }, u.friskrivning),
    h('button', { class: 'knapp sekundar', type: 'button', onclick: a.omstart }, g.borjaOm),
  )
}

export const hittaFraga = (id: string) => fragor.find((f) => f.id === id)!
