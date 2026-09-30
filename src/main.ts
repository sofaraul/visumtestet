import './style.css'
import { config, fragor, innehall, regler } from './data'
import { beraknaVag, rensaSvar } from './flode'
import { byggSvar, renderaFraga } from './svar'
import { fragaSkarm, hittaFraga, introSkarm, svarSkarm, underArbeteSkarm, type Atgarder } from './ui'
import type { Svaren } from './types'
import { visaBanderoll } from './banderoll'

// Svaren finns bara i minnet. De sparas varken i cookies, localStorage eller på server.
let svar: Svaren = {}
let pos = -1 // -1 = startsidan, 0.. = frågorna, därefter svaret

const app = document.getElementById('app')!

function rita() {
  const vag = beraknaVag(svar)
  pos = Math.min(pos, vag.slut ? vag.fragor.length : vag.fragor.length - 1)

  let skarm: HTMLElement
  if (pos < 0) skarm = introSkarm(atgarder)
  else if (pos < vag.fragor.length) {
    const id = vag.fragor[pos]
    skarm = fragaSkarm(renderaFraga(hittaFraga(id), { regler, fragor, config, innehall }), svar[id], pos + 1, vag.total, atgarder)
  } else if (vag.slut === 'underArbete') skarm = underArbeteSkarm(atgarder)
  else skarm = svarSkarm(byggSvar({ spar: vag.slut!, svar, regler, fragor, config, innehall }), atgarder)

  app.replaceChildren(skarm)
  window.scrollTo(0, 0)
  ;(skarm.querySelector('[tabindex="-1"]') as HTMLElement | null)?.focus({ preventScroll: true })
}

function gaTill(nyPos: number) {
  pos = nyPos
  history.pushState({ pos }, '')
  rita()
}

const atgarder: Atgarder = {
  start: () => gaTill(0),
  nasta() {
    if (!svar[beraknaVag(svar).fragor[pos]]) return false
    gaTill(pos + 1)
    return true
  },
  tillbaka() {
    if (history.state?.pos === pos) history.back()
    else {
      pos = Math.max(pos - 1, -1)
      rita()
    }
  },
  valj(fragaId, alternativId) {
    svar = rensaSvar({ ...svar, [fragaId]: alternativId })
  },
  omstart() {
    svar = {}
    gaTill(-1)
  },
}

window.addEventListener('popstate', (e) => {
  pos = typeof e.state?.pos === 'number' ? e.state.pos : -1
  rita()
})

history.replaceState({ pos: -1 }, '')
visaBanderoll(document.getElementById('banderoll')!)
rita()
