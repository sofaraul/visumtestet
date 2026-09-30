// Källkontrollens kärna. Ren logik: hämtningen skickas in, så den kan testas utan nätverk.
//
// Regeln som aldrig bryts: kontrollen bekräftar aldrig en regel själv. Den kan sätta
// "verifierad" till false och uppdatera senastKontrollerad för en regel som en människa
// redan har bekräftat (bekraftad + citat + sidhash), men aldrig sätta den till true.
import { allaVarden, gallandeVarde, idagIso } from './gallande.mjs'
import { gissaMetod, hamtaText, hittaKandidater, innehallerCitat, innehallerVarde, sidhash } from './kalltext.mjs'

export const OK = 'OK'
export const ANDRAD = 'ÄNDRAD'
export const SAKNAS = 'SAKNAS'
export const FEL = 'FEL'
export const MANUELL = 'MANUELL'

/** Så många misslyckade hämtningar i rad som krävs innan verifierad sätts till false. */
export const FEL_I_RAD_GRANS = 3

const AUTOMATISKA_METODER = ['html', 'pdf']

/** Huvudkällan plus eventuella extra källor som alla måste stämma. */
export function kallorFor(regel) {
  const huvud = { nr: 1, kalla: regel.kalla, metod: regel.metod, citat: regel.citat, sidhash: regel.sidhash, kontrolleraVarde: regel.kontrolleraVarde }
  const extra = (regel.extraKallor ?? []).map((k, i) => ({ nr: i + 2, ...k }))
  return [huvud, ...extra].map((k) => ({ ...k, kontrolleraVarde: k.kontrolleraVarde ?? allaVarden(regel) }))
}

async function kontrolleraKalla(regel, kalla, hamta) {
  const saknas = []
  if (!kalla.kalla) saknas.push('källa saknas')
  if (!AUTOMATISKA_METODER.includes(kalla.metod)) saknas.push('metod är manuell')
  if (!regel.bekraftad) saknas.push('regeln är inte bekräftad av en människa')
  if (!kalla.citat) saknas.push('citat saknas')
  if (!kalla.sidhash) saknas.push('fingeravtryck saknas')
  if (saknas.length) return { ...kalla, status: MANUELL, orsak: saknas.join(', ') }

  let text
  try {
    text = await hamta(kalla.kalla, kalla.metod)
  } catch (fel) {
    return { ...kalla, status: FEL, orsak: fel.message }
  }

  const citatFinns = innehallerCitat(text, kalla.citat)
  const varden = kalla.kontrolleraVarde
  const vardeIText = varden.filter((v) => !innehallerVarde(kalla.citat, v))
  if (!citatFinns || vardeIText.length) {
    return {
      ...kalla,
      status: SAKNAS,
      orsak: !citatFinns ? 'citatet finns inte kvar ordagrant på sidan' : `värdet ${vardeIText.join(', ')} står inte i citatet`,
      nu: hittaKandidater(text, varden),
    }
  }
  const ny = sidhash(text)
  if (ny !== kalla.sidhash) return { ...kalla, status: ANDRAD, orsak: 'sidan har ändrats men citatet finns kvar', nyHash: ny }
  return { ...kalla, status: OK }
}

const VARST = [SAKNAS, FEL, ANDRAD, MANUELL, OK]
const sammanlagd = (kallor) => VARST.find((s) => kallor.some((k) => k.status === s))

/**
 * Kontrollerar alla regler. Returnerar uppdaterade regler (originalet rörs inte),
 * en rad per regel och de ärenden som ska skapas.
 */
export async function kontrolleraRegler(regler, { hamta = hamtaText, idag = idagIso() } = {}) {
  const nya = structuredClone(regler)
  const rader = []
  const arenden = []

  for (const regel of nya) {
    const kallor = []
    for (const kalla of kallorFor(regel)) kallor.push(await kontrolleraKalla(regel, kalla, hamta))
    const status = sammanlagd(kallor)
    const andringar = []

    if (status === OK && kallor.every((k) => k.status === OK) && regel.verifierad) {
      if (regel.senastKontrollerad !== idag) andringar.push(`senastKontrollerad ${regel.senastKontrollerad ?? 'saknades'} → ${idag}`)
      regel.senastKontrollerad = idag
    }
    if (status !== FEL && regel.felIRad) {
      andringar.push('felIRad nollställd')
      regel.felIRad = 0
    }
    if (status === SAKNAS && regel.verifierad) {
      regel.verifierad = false
      andringar.push('verifierad true → false')
    }
    if (status === FEL) {
      regel.felIRad = (regel.felIRad ?? 0) + 1
      andringar.push(`felIRad → ${regel.felIRad}`)
      if (regel.felIRad >= FEL_I_RAD_GRANS && regel.verifierad) {
        regel.verifierad = false
        andringar.push(`verifierad true → false (${FEL_I_RAD_GRANS} misslyckade hämtningar i rad)`)
      }
    }

    const arende = byggArende(regel, status, kallor, idag)
    if (arende) arenden.push(arende)
    rader.push({ id: regel.id, status, kallor, andringar, arende: arende?.titel ?? null })
  }
  return { regler: nya, rader, arenden }
}

function visaVarde(regel, idag) {
  const v = gallandeVarde(regel, idag)
  return v === null ? '(saknas)' : `${v} ${regel.enhet}`
}

function byggArende(regel, status, kallor, idag) {
  if (![SAKNAS, FEL, ANDRAD].includes(status)) return null
  const berorda = kallor.filter((k) => k.status === status)
  const rubrik = { [SAKNAS]: 'Citatet eller värdet finns inte kvar', [FEL]: 'Källan gick inte att hämta', [ANDRAD]: 'Källsidan har ändrats' }[status]
  const rader = [
    `Källkontrollen ${idag} gav **${status}** för regeln \`${regel.id}\`: ${rubrik}.`,
    '',
    `- Regel: \`${regel.id}\``,
    `- Värde som gäller idag: ${visaVarde(regel, idag)}`,
  ]
  for (const k of berorda) {
    rader.push('', `### Källa ${k.nr}: ${k.kalla}`, '', `Orsak: ${k.orsak}.`)
    if (status === SAKNAS) {
      rader.push('', '**Gammalt citat**', '', `> ${k.citat}`, '', '**Vad som finns på sidan nu**', '')
      rader.push(...(k.nu?.length ? k.nu.map((m) => `- ${m}`) : ['- Ingen mening med värdet hittades på sidan.']))
    }
    if (status === ANDRAD) rader.push('', `Gammalt fingeravtryck: \`${k.sidhash}\``, `Nytt fingeravtryck: \`${k.nyHash}\``)
  }
  rader.push('')
  if (status === SAKNAS) rader.push('`verifierad` har satts till `false` i `data/regler.json`. Produktionsbygget stoppas tills regeln har granskats av en människa.')
  if (status === FEL) {
    rader.push(`Misslyckade hämtningar i rad: ${regel.felIRad}.`)
    rader.push(regel.verifierad ? `Efter ${FEL_I_RAD_GRANS} i rad sätts \`verifierad\` till \`false\`.` : '`verifierad` är `false` i `data/regler.json`.')
  }
  if (status === ANDRAD) rader.push('Granska sidan. Om värdet och citatet fortfarande stämmer, uppdatera `sidhash` i `data/regler.json` till det nya fingeravtrycket.')
  return { titel: `Källkontroll ${status}: ${regel.id}`, text: rader.join('\n'), regelId: regel.id, status }
}

/**
 * Förslagsläget: hämtar källorna och visar meningar som innehåller värdet, samt
 * fingeravtrycket. Ändrar ingenting. En människa väljer citatet och för in det.
 */
export async function foreslaKallor(regler, { hamta = hamtaText } = {}) {
  const resultat = []
  for (const regel of regler) {
    for (const kalla of kallorFor(regel)) {
      const metod = AUTOMATISKA_METODER.includes(kalla.metod) ? kalla.metod : gissaMetod(kalla.kalla ?? '')
      if (!kalla.kalla) {
        resultat.push({ id: regel.id, nr: kalla.nr, kalla: null, fel: 'källa saknas' })
        continue
      }
      try {
        const text = await hamta(kalla.kalla, metod)
        resultat.push({ id: regel.id, nr: kalla.nr, kalla: kalla.kalla, metod, sidhash: sidhash(text), kandidater: hittaKandidater(text, kalla.kontrolleraVarde), varden: kalla.kontrolleraVarde })
      } catch (fel) {
        resultat.push({ id: regel.id, nr: kalla.nr, kalla: kalla.kalla, metod, fel: fel.message })
      }
    }
  }
  return resultat
}

const cell = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const kort = (url) => (url && url.length > 70 ? `${url.slice(0, 67)}…` : (url ?? '–'))

export function byggRapport({ idag, rader, arenden, skapade = null, skapaInte = false }) {
  const antal = (s) => rader.filter((r) => r.status === s).length
  const ut = [
    `# Källkontroll ${idag}`,
    '',
    `Regler: ${rader.length}. OK: ${antal(OK)}. Ändrad sida: ${antal(ANDRAD)}. Saknas: ${antal(SAKNAS)}. Fel: ${antal(FEL)}. Manuell: ${antal(MANUELL)}.`,
    '',
    '| Regel | Status | Källor och anmärkning |',
    '| --- | --- | --- |',
  ]
  for (const r of rader) {
    const kallor = r.kallor.map((k) => `${k.nr}. ${k.status}${k.orsak ? ` (${k.orsak})` : ''} – ${kort(k.kalla)}`).join('<br>')
    ut.push(`| \`${r.id}\` | **${r.status}** | ${cell(kallor)} |`)
  }

  const andrade = rader.filter((r) => r.andringar.length)
  ut.push('', '## Ändringar i data/regler.json', '')
  ut.push(...(andrade.length ? andrade.map((r) => `- \`${r.id}\`: ${r.andringar.join('; ')}`) : ['Inga.']))

  ut.push('', '## Ärenden', '')
  if (!arenden.length) ut.push('Inga ärenden behövs.')
  else if (skapaInte) ut.push('Ärenden skapades inte i den här körningen (ingen GitHub-åtkomst). De som skulle skapas:', '', ...arenden.map((a) => `- ${a.titel}`))
  else ut.push(...arenden.map((a) => `- ${a.titel}${skapade?.[a.titel] ? ` – ${skapade[a.titel]}` : ''}`))

  const manuella = rader.filter((r) => r.status === MANUELL)
  if (manuella.length) {
    ut.push('', '## Regler utan automatisk kontroll', '', 'De här har ingen automatisk kontroll. De kontrolleras av en människa tills citat, fingeravtryck och bekräftelse finns.', '')
    for (const r of manuella) ut.push(`- \`${r.id}\`: ${[...new Set(r.kallor.filter((k) => k.status === MANUELL).map((k) => k.orsak))].join('; ')}`)
  }
  return `${ut.join('\n')}\n`
}

export function byggForslagsrapport({ idag, resultat }) {
  const ut = [
    `# Förslag på citat ${idag}`,
    '',
    'Inget i `data/regler.json` har ändrats. Välj för varje källa en mening som är ett ordagrant utdrag ur sidan och som innehåller värdet. För in `metod`, `citat` och `sidhash` i regeln och sätt `bekraftad` när du har läst källan själv.',
    '',
  ]
  for (const r of resultat) {
    ut.push(`## \`${r.id}\` – källa ${r.nr}`, '')
    if (r.fel) {
      ut.push(`Kunde inte hämtas${r.kalla ? ` (${r.kalla})` : ''}: ${r.fel}.`, '')
      continue
    }
    ut.push(`${r.kalla}`, '', `- metod: \`${r.metod}\``, `- sidhash: \`${r.sidhash}\``, `- söker värde: ${r.varden.join(', ')}`, '')
    if (!r.kandidater.length) ut.push('Ingen mening med värdet hittades. Kontrollera sidan manuellt.', '')
    else ut.push('Meningar med värdet:', '', ...r.kandidater.map((m) => `> ${m}`), '')
  }
  return `${ut.join('\n')}\n`
}
