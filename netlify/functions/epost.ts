// Tar emot e-postadressen från visumtestet och lägger in kontakten i Brevo med dubbel bekräftelse
// (double opt-in). Sparar bara adressen, spåret (SPAR), samtycket till erbjudanden (ERBJUDANDEN, uppdrag 3)
// och källan (KALLA, uppdrag 4), aldrig svaren på frågorna.
// API-nyckeln kommer från miljövariabeln BREVO_API_KEY i Netlify, aldrig från koden eller repot.
import process from 'node:process'
import konfig from '../../config.json'
import { GILTIGA_SPAR } from '../../src/spar'
import { stada, OKAND } from '../../src/kalla'

const BREVO = 'https://api.brevo.com/v3/contacts/doubleOptinConfirmation'
const ATTRIBUT = 'https://api.brevo.com/v3/contacts/attributes/normal/'
/** Attribut som funktionen skapar i Brevo om de saknas. SPAR fanns redan när uppdrag 2 byggdes. */
export const NYA_ATTRIBUT: Record<string, 'boolean' | 'text'> = { ERBJUDANDEN: 'boolean', KALLA: 'text' }
const MAX_TECKEN = 2000
const ADRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface Beroenden {
  apiNyckel: string | undefined
  listaId: number | null
  mallId: number | null
  hamta: typeof fetch
  /** Antal tecken som källan högst får ha (config.json, matning.maxTeckenKalla). */
  maxTeckenKalla: number
  /** Delas mellan anrop i samma instans, så att attributen bara skapas en gång. */
  attribut: { klara: boolean }
}

const svara = (status: number, kropp: Record<string, unknown>) =>
  new Response(JSON.stringify(kropp), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

/** Brevo svarar med ett fel om kontakten redan finns. Det visas inte för besökaren, så att ingen kan läsa ut vilka adresser som är registrerade. */
const arRedanKontakt = (kropp: unknown) => /already exist|duplicate/i.test(JSON.stringify(kropp ?? ''))

/**
 * Skapar ERBJUDANDEN och KALLA i Brevo om de saknas. Brevo svarar med fel om attributet redan finns;
 * det räknas som klart. Misslyckas det på annat sätt försöker nästa anrop igen, och anmälan skickas ändå.
 */
async function skapaAttribut(d: Beroenden) {
  if (d.attribut.klara) return
  let alla = true
  for (const [namn, typ] of Object.entries(NYA_ATTRIBUT)) {
    try {
      const r = await d.hamta(ATTRIBUT + namn, {
        method: 'POST',
        headers: { 'api-key': d.apiNyckel!, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ type: typ }),
      })
      if (!r.ok && !arRedanKontakt(await r.json().catch(() => null))) alla = false
    } catch {
      alla = false
    }
  }
  d.attribut.klara = alla
}

export async function hantera(req: Request, d: Beroenden): Promise<Response> {
  if (req.method !== 'POST') return svara(405, { fel: 'metod' })
  if (!d.apiNyckel || !d.listaId || !d.mallId) return svara(503, { fel: 'ej-konfigurerad' })

  const text = await req.text()
  if (text.length > MAX_TECKEN) return svara(400, { fel: 'ogiltig' })
  let data: { email?: unknown; samtycke?: unknown; spar?: unknown; erbjudanden?: unknown; kalla?: unknown }
  try {
    data = JSON.parse(text)
  } catch {
    return svara(400, { fel: 'ogiltig' })
  }

  const email = typeof data.email === 'string' ? data.email.trim() : ''
  if (!email || email.length > 254 || !ADRESS.test(email)) return svara(400, { fel: 'adress' })
  if (data.samtycke !== 'ja') return svara(400, { fel: 'samtycke' })
  if (typeof data.spar !== 'string' || !GILTIGA_SPAR.includes(data.spar)) return svara(400, { fel: 'spar' })
  // Utan ikryssad ruta (eller från en äldre sida) blir det false.
  const erbjudanden = data.erbjudanden === 'ja'
  const kalla = typeof data.kalla === 'string' ? stada(data.kalla, d.maxTeckenKalla) : OKAND

  await skapaAttribut(d)

  let brevo: Response
  try {
    brevo = await d.hamta(BREVO, {
      method: 'POST',
      headers: { 'api-key': d.apiNyckel, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        email,
        attributes: { SPAR: data.spar, ERBJUDANDEN: erbjudanden, KALLA: kalla },
        includeListIds: [d.listaId],
        templateId: d.mallId,
        redirectionUrl: new URL('/bekraftad/', req.url).toString(),
      }),
    })
  } catch {
    return svara(502, { fel: 'brevo' })
  }
  if (brevo.ok) return svara(200, { ok: true })

  const fel = await brevo.json().catch(() => null)
  if (arRedanKontakt(fel)) return svara(200, { ok: true })
  // Loggar bara Brevos felkod, aldrig adressen.
  console.error('Brevo avvisade begäran', brevo.status, (fel as { code?: string } | null)?.code ?? '')
  return svara(502, { fel: 'brevo' })
}

const delat = { klara: false }

export default (req: Request) =>
  hantera(req, {
    apiNyckel: process.env.BREVO_API_KEY,
    listaId: konfig.epost.listaId,
    mallId: konfig.epost.bekraftelsemallId,
    hamta: fetch,
    maxTeckenKalla: konfig.matning.maxTeckenKalla,
    attribut: delat,
  })

export const config = { path: '/api/epost' }
