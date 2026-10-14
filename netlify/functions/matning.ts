// Räknar besök, fullföljda test, anmälningar och köpklick per källa (uppdrag 4, 14 oktober 2026).
// Varje händelse sparas som en nyckel i Netlify Blobs: datum (svensk tid)/steg/spår/källa/slumpat id.
// Inget IP-nummer, ingen webbläsaruppgift, inget id per besökare och inga cookies.
// GET ?fran=ÅÅÅÅ-MM-DD&till=ÅÅÅÅ-MM-DD svarar med summor per källa, aldrig enskilda händelser.
import { getStore } from '@netlify/blobs'
import konfig from '../../config.json'
import { STEG, STEG_MED_SPAR, stada, type Steg } from '../../src/kalla'
import { GILTIGA_SPAR } from '../../src/spar'

const MAX_TECKEN = 500
const DATUM = /^\d{4}-\d{2}-\d{2}$/
const DAG_MS = 86_400_000

export interface Lagring {
  spara(nyckel: string): Promise<void>
  /** Alla nycklar som börjar med prefixet. */
  lista(prefix: string): Promise<string[]>
}

export interface Beroenden {
  lagring: Lagring
  nu: () => Date
  maxTeckenKalla: number
  maxDagar: number
}

type PerSpar = Record<string, number>
export interface Summa {
  besok: number
  fullfoljt: PerSpar
  anmalan: PerSpar
  kopklick: PerSpar
}

const svara = (status: number, kropp: unknown) =>
  new Response(JSON.stringify(kropp), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

/** Datum i svensk tid, ÅÅÅÅ-MM-DD. */
export const svenskDag = (d: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(d)

const tomSumma = (): Summa => ({
  besok: 0,
  fullfoljt: Object.fromEntries(GILTIGA_SPAR.map((s) => [s, 0])),
  anmalan: Object.fromEntries(GILTIGA_SPAR.map((s) => [s, 0])),
  kopklick: Object.fromEntries(GILTIGA_SPAR.map((s) => [s, 0])),
})

function lagg(summa: Summa, steg: Steg, spar: string) {
  if (steg === 'besok') summa.besok++
  else summa[steg][spar] = (summa[steg][spar] ?? 0) + 1
}

async function taEmot(req: Request, d: Beroenden): Promise<Response> {
  const text = await req.text()
  if (text.length > MAX_TECKEN) return svara(400, { fel: 'ogiltig' })
  let data: { kalla?: unknown; steg?: unknown; spar?: unknown }
  try {
    data = JSON.parse(text)
  } catch {
    return svara(400, { fel: 'ogiltig' })
  }
  const steg = data.steg as Steg
  if (typeof data.steg !== 'string' || !STEG.includes(steg)) return svara(400, { fel: 'steg' })
  const spar = typeof data.spar === 'string' ? data.spar : ''
  if (STEG_MED_SPAR.includes(steg) ? !GILTIGA_SPAR.includes(spar) : spar !== '') return svara(400, { fel: 'spar' })
  if (typeof data.kalla !== 'string' || stada(data.kalla, d.maxTeckenKalla) !== data.kalla) return svara(400, { fel: 'kalla' })

  await d.lagring.spara(`${svenskDag(d.nu())}/${steg}/${spar || '-'}/${data.kalla}/${crypto.randomUUID()}`)
  return svara(202, { ok: true })
}

async function summera(req: Request, d: Beroenden): Promise<Response> {
  const p = new URL(req.url).searchParams
  const fran = p.get('fran') ?? ''
  const till = p.get('till') ?? ''
  if (!DATUM.test(fran) || !DATUM.test(till)) return svara(400, { fel: 'datum', format: 'fran=ÅÅÅÅ-MM-DD&till=ÅÅÅÅ-MM-DD' })
  const start = Date.parse(`${fran}T00:00:00Z`)
  const slut = Date.parse(`${till}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(slut) || slut < start) return svara(400, { fel: 'datum' })
  const dagar = Math.round((slut - start) / DAG_MS) + 1
  if (dagar > d.maxDagar) return svara(400, { fel: 'for-lang-period', maxDagar: d.maxDagar })

  const perKalla: Record<string, Summa> = {}
  const totalt = tomSumma()
  for (let i = 0; i < dagar; i++) {
    const dag = new Date(start + i * DAG_MS).toISOString().slice(0, 10)
    for (const nyckel of await d.lagring.lista(`${dag}/`)) {
      const [, steg, spar, kalla] = nyckel.split('/')
      if (!STEG.includes(steg as Steg) || !kalla) continue
      const s = spar === '-' ? '' : spar
      lagg((perKalla[kalla] ??= tomSumma()), steg as Steg, s)
      lagg(totalt, steg as Steg, s)
    }
  }
  return svara(200, { fran, till, tidszon: 'Europe/Stockholm', perKalla, totalt })
}

export async function hantera(req: Request, d: Beroenden): Promise<Response> {
  try {
    if (req.method === 'POST') return await taEmot(req, d)
    if (req.method === 'GET') return await summera(req, d)
    return svara(405, { fel: 'metod' })
  } catch {
    return svara(500, { fel: 'lagring' })
  }
}

function blobLagring(): Lagring {
  const store = getStore('matning')
  return {
    spara: async (nyckel) => {
      await store.set(nyckel, '')
    },
    lista: async (prefix) => {
      const { blobs } = await store.list({ prefix })
      return blobs.map((b) => b.key)
    },
  }
}

export default (req: Request) =>
  hantera(req, { lagring: blobLagring(), nu: () => new Date(), maxTeckenKalla: konfig.matning.maxTeckenKalla, maxDagar: konfig.matning.maxDagar })

export const config = { path: '/api/matning' }
