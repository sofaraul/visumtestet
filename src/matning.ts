import { config } from './data'
import { kallaFran, type Steg } from './kalla'
import { SPAR_VARDE } from './spar'
import type { Slut } from './types'

// Räknar besök, fullföljda test, anmälningar och köpklick per källa (uppdrag 4).
// Inga cookies, ingen localStorage eller sessionStorage, inget id per besökare.
// Källan räknas fram när sidan laddas och finns bara i minnet.
// Räkningen får aldrig stoppa testet: varje fel sväljs.
const m = config.matning

function raknaFram(): string {
  try {
    return kallaFran(location.href, document.referrer, m.vard, m.maxTeckenKalla)
  } catch {
    return 'okand'
  }
}

export const kalla = raknaFram()

// Bara på produktionsvärden och inte i automatiserade webbläsare. Förhandsvisningar räknas inte.
const aktiv = () => {
  try {
    return location.hostname === m.vard && !navigator.webdriver && typeof navigator.sendBeacon === 'function'
  } catch {
    return false
  }
}

const raknade = new Set<string>()

export function rakna(steg: Steg, spar?: Slut, enGangPerSida = false) {
  try {
    const nyckel = `${steg}:${spar ?? ''}`
    if (enGangPerSida && raknade.has(nyckel)) return
    raknade.add(nyckel)
    if (!aktiv()) return
    const kropp = JSON.stringify({ kalla, steg, spar: spar ? SPAR_VARDE[spar] : '' })
    navigator.sendBeacon(m.tjanst, new Blob([kropp], { type: 'application/json' }))
  } catch {
    // Räkningen märks aldrig för besökaren.
  }
}
