import { h } from './dom'
import { config, innehall } from './data'
import { SPAR_VARDE } from './spar'
import type { Slut } from './types'

const t = innehall.epost

/** E-postfältet. Returnerar null om API-nyckeln eller Brevo-id:n saknas vid bygget. */
export function epostFormular(rubrik: string, spar: Slut): HTMLElement | null {
  if (!__EPOST_AKTIV__) return null

  const fel = h('p', { class: 'fel', role: 'alert' })
  const falt = h('input', { type: 'email', id: 'epost', name: 'epost', autocomplete: 'email', inputmode: 'email', required: true })
  const ruta = h('input', { type: 'checkbox', id: 'samtycke', name: 'samtycke' })
  const knapp = h('button', { type: 'submit', class: 'knapp' }, t.skicka)
  // Egen flik, så att besökarens svar finns kvar när hen kommer tillbaka.
  const integritet = h('p', { class: 'integritet' }, h('a', { href: '/integritet/', target: '_blank', rel: 'noopener' }, t.integritetLank))

  const form = h(
    'form',
    { novalidate: true, class: 'epost' },
    h('h2', {}, rubrik),
    h('label', { for: 'epost', class: 'etikett' }, t.etikett),
    falt,
    h('label', { class: 'kryss', for: 'samtycke' }, ruta, h('span', {}, t.samtycke)),
    integritet,
    fel,
    knapp,
  )

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    fel.textContent = ''
    const adress = falt.value.trim()
    if (!falt.checkValidity() || !adress) {
      fel.textContent = t.felAdress
      falt.focus()
      return
    }
    if (!ruta.checked) {
      fel.textContent = t.felSamtycke
      ruta.focus()
      return
    }
    knapp.disabled = true
    knapp.textContent = t.skickar
    try {
      const svar = await fetch(config.epost.tjanst, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        // Bara adressen, samtycket och spåret. Inga svar på frågorna.
        body: JSON.stringify({ email: adress, samtycke: 'ja', spar: SPAR_VARDE[spar] }),
      })
      if (!svar.ok) throw new Error(String(svar.status))
      form.replaceChildren(h('p', { class: 'tack', role: 'status' }, t.tack.replace('{epost}', adress)))
    } catch {
      fel.textContent = t.felSkick
      knapp.disabled = false
      knapp.textContent = t.skicka
    }
  })
  return form
}
