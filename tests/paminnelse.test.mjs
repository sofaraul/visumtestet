import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { byggPaminnelse, PAMINNELSE_ETIKETT } from '../scripts/paminnelse.mjs'
import { skapaArenden } from '../scripts/arenden.mjs'

const regler = JSON.parse(readFileSync('data/regler.json', 'utf-8'))
const MANUELLA = ['non-o-minalder', 'non-o-inkomstkrav', 'non-o-bankkrav', 'non-o-bank-minsta-saldo', 'non-o-kombination', 'non-o-forlangning-max', 'o-a-forsakringskrav', 'skatt-hemvist-dagar']

describe('månadspåminnelse om manuella regler', () => {
  const p = byggPaminnelse(regler, '2026-10-01')
  it('ärendet gäller månaden och listar exakt de manuella reglerna', () => {
    expect(p.titel).toBe('Manuell kontroll 2026-10')
    expect(p.antal).toBe(MANUELLA.length)
    for (const id of MANUELLA) expect(p.text, id).toContain(`\`${id}\``)
  })
  it('automatiskt kontrollerade regler är inte med', () => {
    for (const id of ['ltr-minalder', 'ltr-inkomstkrav', 'sink-avdrag', 'garantipension-max-vistelse', 'visumfri-vistelse-dagar']) expect(p.text, id).not.toContain(`\`${id}\``)
  })
  it('varje regel visas med sitt citat och en länk till källan', () => {
    for (const id of MANUELLA) {
      const r = regler.find((x) => x.id === id)
      expect(p.text, id).toContain(`"${r.citat}"`)
      expect(p.text, id).toContain(`(${new URL(r.kalla).href})`)
    }
  })
  it('länkar med thailändsk text kodas så att de blir klickbara', () => {
    expect(p.text).toMatch(/\(https:\/\/www\.immigration\.go\.th\/[^ )]*%E0%B8/)
  })
  it('det finns en avbockningslista', () => {
    expect(p.text.match(/^- \[ \] /gm)).toHaveLength(MANUELLA.length)
  })
  it('en regel utan citat visas med "citat saknas", och inget ärende skapas när inget är manuellt', () => {
    const utan = byggPaminnelse([{ ...regler.find((r) => r.id === 'non-o-inkomstkrav'), citat: null }], '2026-10-01')
    expect(utan.text).toContain('**citat saknas**')
    const auto = regler.filter((r) => r.metod === 'html' || r.metod === 'pdf')
    expect(byggPaminnelse(auto, '2026-10-01')).toBeNull()
  })
  it('sju regler utan extra källor räknas en gång, en extra manuell källa räknas för sig', () => {
    const sink = regler.find((r) => r.id === 'sink-avdrag')
    const mix = byggPaminnelse([{ ...sink, extraKallor: [{ ...sink.extraKallor[0], metod: 'manuell', sidhash: null }] }], '2026-10-01')
    expect(mix.antal).toBe(1)
    expect(mix.text).toContain('(källa 2)')
  })
})

describe('ärendet får etiketten manuell-kontroll, inte källkontroll', () => {
  it('skapar etiketten och ärendet med rätt etikett, och dubblerar inte', async () => {
    const anrop = []
    const fetchFn = async (url, init) => {
      anrop.push({ metod: init.method, sokvag: url.replace('https://api.github.com/repos/o/r', ''), kropp: init.body ? JSON.parse(init.body) : null })
      const json = (status, data) => ({ status, json: async () => data })
      if (init.method === 'POST' && url.endsWith('/labels')) return json(201, {})
      if (init.method === 'GET') return json(200, [{ title: 'Manuell kontroll 2026-09', html_url: 'https://github.com/o/r/issues/5' }])
      return json(201, { html_url: 'https://github.com/o/r/issues/6' })
    }
    const p = byggPaminnelse(regler, '2026-10-01')
    const res = await skapaArenden([p], { token: 't', repo: 'o/r', fetchFn, etikett: PAMINNELSE_ETIKETT })
    expect(res[p.titel]).toBe('https://github.com/o/r/issues/6')
    expect(anrop.find((a) => a.sokvag === '/labels').kropp.name).toBe('manuell-kontroll')
    expect(anrop.find((a) => a.metod === 'GET').sokvag).toContain('labels=manuell-kontroll')
    expect(anrop.find((a) => a.sokvag === '/issues' && a.metod === 'POST').kropp.labels).toEqual(['manuell-kontroll'])
    expect(JSON.stringify(anrop)).not.toContain('k%C3%A4llkontroll')
    // Samma månad igen: ärendet finns redan och skapas inte på nytt.
    const igen = await skapaArenden([byggPaminnelse(regler, '2026-09-01')], { token: 't', repo: 'o/r', fetchFn, etikett: PAMINNELSE_ETIKETT })
    expect(Object.values(igen)[0]).toContain('fanns redan')
  })
  it('källkontrollens ärenden använder fortfarande källkontroll', async () => {
    const etiketter = []
    const fetchFn = async (url, init) => {
      if (init.method === 'POST' && init.body) etiketter.push(JSON.parse(init.body).labels ?? JSON.parse(init.body).name)
      const json = (status, data) => ({ status, json: async () => data })
      return init.method === 'GET' ? json(200, []) : json(201, { html_url: 'https://x/1' })
    }
    await skapaArenden([{ titel: 't', text: 'b' }], { token: 't', repo: 'o/r', fetchFn })
    expect(etiketter.flat()).toContain('källkontroll')
  })
})

describe('arbetsflödet .github/workflows/manuell-kontroll.yml', () => {
  const yml = readFileSync('.github/workflows/manuell-kontroll.yml', 'utf-8')
  it('körs den första varje månad', () => expect(yml).toMatch(/cron: '\d+ \d+ 1 \* \*'/))
  it('får skapa ärenden och kör påminnelseskriptet', () => {
    expect(yml).toMatch(/issues: write/)
    expect(yml).toContain('npm run paminnelse')
  })
  it('kan köras för hand', () => expect(yml).toContain('workflow_dispatch'))
})
