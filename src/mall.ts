import { gallandeVarde } from '../scripts/gallande.mjs'
import type { Regel } from './types'

export interface MallKontext {
  regler: Map<string, Regel>
  enheter: Record<string, string>
  saknas: string
  /** Färdiga värden för platshållare som {svar.dagar} och {inkomstThb}. */
  varden: Record<string, string>
  /** Fylls på med id för varje regel som mallen hämtat värde från. */
  anvanda: Set<string>
  /** Datum (ÅÅÅÅ-MM-DD) som datumstyrda regler värderas mot. Standard är idag. */
  idag?: string
}

const talFormat = new Intl.NumberFormat('sv-SE')

export const formatTal = (n: number) => talFormat.format(n)

function visaVarde(v: number | string): string {
  return typeof v === 'number' ? formatTal(v) : v
}

function losUpp(nyckel: string, ctx: MallKontext): string {
  if (nyckel in ctx.varden) return ctx.varden[nyckel]

  const [regelId, del] = nyckel.split(/\.(?=varde$|villkor$)/)
  const regel = ctx.regler.get(regelId)
  if (!regel) return `[okänd platshållare: ${nyckel}]`

  ctx.anvanda.add(regel.id)
  if (del === 'villkor') return regel.villkor ?? ctx.saknas
  const gallande = gallandeVarde(regel, ctx.idag)
  if (gallande === null || gallande === '') return ctx.saknas
  const varde = visaVarde(gallande)
  if (del === 'varde') return varde
  const enhet = ctx.enheter[regel.enhet] ?? regel.enhet
  return enhet ? `${varde} ${enhet}` : varde
}

/** Byter {platshållare} i en mall mot värden. Ren text ut, aldrig HTML. */
export function fyllMall(mall: string, ctx: MallKontext): string {
  return mall.replace(/\{([A-Za-z0-9_.-]+)\}/g, (_, nyckel: string) => losUpp(nyckel, ctx))
}
