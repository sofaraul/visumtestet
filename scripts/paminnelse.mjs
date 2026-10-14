// npm run paminnelse: skapar ett ärende med etiketten manuell-kontroll som listar de regler
// som bara kan kontrolleras för hand, med citat och länk. Körs den första varje månad.
// Utan GITHUB_TOKEN skrivs ärendet bara ut.
import { idagIso } from './gallande.mjs'
import { laRegler } from './regler.mjs'
import { manuellaKallor } from './kontroll.mjs'
import { skapaArenden } from './arenden.mjs'

export const PAMINNELSE_ETIKETT = 'manuell-kontroll'

const cell = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
/** Adress med kodade tecken, så att länkar med thailändsk text blir klickbara i GitHub. */
const lank = (url) => (url ? `[öppna källan](${new URL(url).href})` : '**källa saknas**')
const visaVarde = (r) => (Array.isArray(r.varde) ? r.varde.map((p) => p.varde).join(' / ') : `${r.varde ?? '(tomt)'} ${r.enhet}`)

/** Ärendet för en månad (ÅÅÅÅ-MM). Returnerar null om inga regler kräver manuell kontroll. */
export function byggPaminnelse(regler, idag = idagIso()) {
  const kallor = manuellaKallor(regler)
  if (!kallor.length) return null
  const manad = idag.slice(0, 7)
  const rader = kallor.map(({ regel, kalla }) => {
    const nr = kalla.nr > 1 ? ` (källa ${kalla.nr})` : ''
    const bekraftad = regel.bekraftad ? `${regel.bekraftad.av} ${regel.bekraftad.datum}` : 'ej bekräftad'
    return `| \`${regel.id}\`${nr} | ${cell(visaVarde(regel))} | ${kalla.citat ? `"${cell(kalla.citat)}"` : '**citat saknas**'} | ${lank(kalla.kalla)} | ${bekraftad} |`
  })
  const lista = kallor.map(({ regel, kalla }) => `- [ ] \`${regel.id}\`${kalla.nr > 1 ? ` (källa ${kalla.nr})` : ''}: ${lank(kalla.kalla)}`)
  const text = [
    `Det här är den månatliga påminnelsen (${manad}). ${kallor.length} källor kontrolleras inte automatiskt, och måste kontrolleras för hand.`,
    '',
    'Öppna varje länk, kontrollera att citatet finns kvar och att värdet i regeln stämmer med det. Stämmer något inte: ändra regeln i `data/regler.json` och sätt `"verifierad": false` tills den är kontrollerad igen.',
    '',
    '| Regel | Värde | Citat | Länk | Senast bekräftad |',
    '| --- | --- | --- | --- | --- |',
    ...rader,
    '',
    '## Att bocka av',
    '',
    ...lista,
    '',
    'Stäng ärendet när allt är kontrollerat.',
  ].join('\n')
  return { titel: `Manuell kontroll ${manad}`, text, antal: kallor.length }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arende = byggPaminnelse(laRegler())
  if (!arende) {
    console.log('Inga regler kräver manuell kontroll.')
  } else {
    const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo } = process.env
    if (!token || !repo) {
      console.log(`${arende.titel}\n\n${arende.text}\n\n(Ärendet skapades inte: ingen GitHub-åtkomst.)`)
    } else {
      const svar = await skapaArenden([arende], { token, repo, etikett: PAMINNELSE_ETIKETT, farg: 'fbca04', beskrivning: 'Påminnelse om regler som kontrolleras för hand' })
      console.log(`${arende.titel}: ${svar[arende.titel]}`)
    }
  }
}
