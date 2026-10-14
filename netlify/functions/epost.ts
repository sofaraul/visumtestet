// Tar emot e-postadressen från visumtestet och lägger in kontakten i Brevo med dubbel bekräftelse
// (double opt-in). Sparar bara adressen och spåret (attributet SPAR), aldrig svaren på frågorna.
// API-nyckeln kommer från miljövariabeln BREVO_API_KEY i Netlify, aldrig från koden eller repot.
import process from 'node:process'
import konfig from '../../config.json'
import { GILTIGA_SPAR } from '../../src/spar'

const BREVO = 'https://api.brevo.com/v3/contacts/doubleOptinConfirmation'
const MAX_TECKEN = 2000
const ADRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface Beroenden {
  apiNyckel: string | undefined
  listaId: number | null
  mallId: number | null
  hamta: typeof fetch
}

const svara = (status: number, kropp: Record<string, unknown>) =>
  new Response(JSON.stringify(kropp), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

/** Brevo svarar med ett fel om kontakten redan finns. Det visas inte för besökaren, så att ingen kan läsa ut vilka adresser som är registrerade. */
const arRedanKontakt = (kropp: unknown) => /already exist|duplicate/i.test(JSON.stringify(kropp ?? ''))

export async function hantera(req: Request, d: Beroenden): Promise<Response> {
  if (req.method !== 'POST') return svara(405, { fel: 'metod' })
  if (!d.apiNyckel || !d.listaId || !d.mallId) return svara(503, { fel: 'ej-konfigurerad' })

  const text = await req.text()
  if (text.length > MAX_TECKEN) return svara(400, { fel: 'ogiltig' })
  let data: { email?: unknown; samtycke?: unknown; spar?: unknown }
  try {
    data = JSON.parse(text)
  } catch {
    return svara(400, { fel: 'ogiltig' })
  }

  const email = typeof data.email === 'string' ? data.email.trim() : ''
  if (!email || email.length > 254 || !ADRESS.test(email)) return svara(400, { fel: 'adress' })
  if (data.samtycke !== 'ja') return svara(400, { fel: 'samtycke' })
  if (typeof data.spar !== 'string' || !GILTIGA_SPAR.includes(data.spar)) return svara(400, { fel: 'spar' })

  let brevo: Response
  try {
    brevo = await d.hamta(BREVO, {
      method: 'POST',
      headers: { 'api-key': d.apiNyckel, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        email,
        attributes: { SPAR: data.spar },
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

export default (req: Request) =>
  hantera(req, {
    apiNyckel: process.env.BREVO_API_KEY,
    listaId: konfig.epost.listaId,
    mallId: konfig.epost.bekraftelsemallId,
    hamta: fetch,
  })

export const config = { path: '/api/epost' }
