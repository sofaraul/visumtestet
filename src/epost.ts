import { h } from './dom'
import { config, innehall } from './data'

const t = innehall.epost

/** E-postfältet. Returnerar null om ingen mottagare finns i konfigurationen. */
export function epostFormular(rubrik: string, visumvag: string): HTMLElement | null {
  const mottagare = config.epost.mottagare
  if (!mottagare) return null

  const fel = h('p', { class: 'fel', role: 'alert' })
  const falt = h('input', { type: 'email', id: 'epost', name: 'epost', autocomplete: 'email', inputmode: 'email', required: true })
  const ruta = h('input', { type: 'checkbox', id: 'samtycke', name: 'samtycke' })
  const knapp = h('button', { type: 'submit', class: 'knapp' }, t.skicka)
  const integritet = h('details', { class: 'integritet' }, h('summary', {}, t.integritetLank), h('p', {}, t.integritet))

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
      const svar = await fetch(config.epost.tjanst.replace('{mottagare}', encodeURIComponent(mottagare)), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        // Bara adressen, samtycket och vilket spår svaret gäller. Inga svar på frågorna.
        body: JSON.stringify({ email: adress, samtycke: 'ja', spar: visumvag }),
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
