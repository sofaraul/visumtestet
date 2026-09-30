// Testar logiken mot alla svarskombinationer, före och efter 2027-01-01, med fast växelkurs.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { beraknaVag } from '../src/flode'
import {
  DATUM, EFTER, FORE, TESTKONFIG, allaVagar, bahtRegler, byggPost, forvantadJaNej, forvantadKr, fragor, innehall, medKurs,
  meningar, regel, regler, renderadeFragor, talITexten, tillatnaTal, vagNamn, vardeUtanEnhet, visa, type Post,
} from './allaVagar'
import { formatTal } from '../src/mall'

const vagar = allaVagar()
const poster: Post[] = vagar.flatMap((v) => DATUM.map((d) => byggPost(v, d)))
const medSvar = poster.filter((p) => p.modell)
const underArbete = poster.filter((p) => !p.modell)
const pension = medSvar.filter((p) => p.vag.slut === 'pension')
const sasong = medSvar.filter((p) => p.vag.slut === 'sasong')
/** Pensionärsvägar där minst en väg ser ut att passa. */
const nonO = pension.filter((p) => p.modell!.mall === 'pension')
const ingenVag = pension.filter((p) => p.modell!.mall === 'pensionIngen')

const FRISKRIVNING =
  'Det här är allmän information, inte personlig rådgivning. Regler och belopp ändras, och din situation kan innehålla detaljer som ett formulär inte fångar.'
const KRAVRUBRIK_FORLANGNING = 'För att få stanna ett år i taget krävs:'
const KURSDATUM = TESTKONFIG.vaxelkurs.datum!

/** Formuleringar som påstår att något är uppfyllt eller ska göras. */
const PAASTAENDE = /\buppfyll(er|da|t|ar)\b|\bdu (ska|klarar|har rätt)\b|\bkraven är\b|stämmer med|\bgodkänd/i

/** Samlar brott mot ett krav. Tom lista = kravet håller för alla vägar i urvalet. */
const brott = (urval: Post[], kontroll: (p: Post) => string | null) =>
  urval.flatMap((p) => {
    const fel = kontroll(p)
    return fel ? [`[${p.datum}] ${vagNamn(p.vag.svar)}: ${fel}`] : []
  })
const inga = (lista: string[]) => expect(lista, `${lista.length} brott, t.ex.\n${lista.slice(0, 4).join('\n')}`).toEqual([])

describe('vägarna genom frågorna', () => {
  it('varje väg slutar i ett svar eller "under arbete", utan dubbletter', () => {
    const nycklar = vagar.map((v) => JSON.stringify(v.svar))
    expect(new Set(nycklar).size).toBe(nycklar.length)
    expect(new Set(vagar.map((v) => v.slut))).toEqual(new Set(['sasong', 'pension', 'underArbete']))
  })
  it('varje svarsalternativ i varje fråga används av minst en väg', () => {
    for (const f of fragor)
      for (const alt of f.alternativ) {
        expect(vagar.some((v) => v.svar[f.id] === alt.id), `${f.id}=${alt.id} används aldrig`).toBe(true)
      }
  })
  it('"under arbete" bara utanför säsongsspåret och bara för under 50 år, lön eller eget företag', () => {
    const skaVara = (v: (typeof vagar)[number]) =>
      v.svar.dagar !== 'farre' && (v.svar.alder === 'under' || v.svar.pengar === 'lon' || v.svar.pengar === 'eget')
    expect(vagar.filter((v) => (v.slut === 'underArbete') !== skaVara(v)).map((v) => vagNamn(v.svar))).toEqual([])
  })
  it('fråga 1 "färre än" ger säsongsspåret, övriga pensionärsspåret', () => {
    for (const v of vagar.filter((x) => x.slut !== 'underArbete')) {
      expect(v.slut, vagNamn(v.svar)).toBe(v.svar.dagar === 'farre' ? 'sasong' : 'pension')
    }
    for (const v of vagar.filter((x) => x.slut === 'pension')) expect(['pension', 'kapital', 'kombination']).toContain(v.svar.pengar)
  })
})

describe('2a: varje siffra i ett svar finns i regler.json eller config.json, eller räknas fram ur dem', () => {
  const tillatna = tillatnaTal()
  it('inga andra siffror förekommer i svaren', () => {
    inga(brott(poster, (p) => {
      const okanda = [...new Set(talITexten(p.text).filter((t) => !tillatna.has(t)))]
      return okanda.length ? `siffror som inte finns i reglerna eller konfigurationen: ${okanda.join(', ')}` : null
    }))
  })
  it('inga andra siffror förekommer i frågorna', () => {
    const okanda = renderadeFragor().flatMap((f) => talITexten(`${f.text} ${f.alternativ.map((a) => a.text).join(' ')} ${f.hjalptext ?? ''}`).filter((t) => !tillatna.has(t)))
    expect(okanda).toEqual([])
  })
  it('testet fångar en påhittad siffra', () => {
    expect(talITexten('Kravet är 12 345 baht').filter((t) => !tillatna.has(t))).toEqual(['12345'])
  })
})

describe('2b: varje svar har rubrik, ansvarsfriskrivning och datum för senaste kontroll', () => {
  it('svar med visumväg', () => {
    inga(brott(medSvar, (p) => {
      if (!p.text.includes('Din troliga väg')) return 'rubriken "Din troliga väg" saknas'
      if (!p.text.includes(FRISKRIVNING)) return 'ansvarsfriskrivningen saknas eller är ändrad'
      if (!/Senast kontrollerad mot källa: \d{1,2} [a-zåäö]+ \d{4}/.test(p.text)) return 'datum för senaste kontroll saknas'
      return null
    }))
  })
  it('"under arbete" har också ansvarsfriskrivningen', () => {
    inga(brott(underArbete, (p) => (p.text.includes(FRISKRIVNING) ? null : 'ansvarsfriskrivningen saknas')))
  })
})

describe('2c: inget "du ska" eller "du uppfyller" utan att villkoret går att avgöra', () => {
  it('påståenden förekommer bara för inkomstkravet och bara när besökaren svarat Ja', () => {
    inga(brott(medSvar, (p) => {
      const m = p.modell!
      const utanforKrav = [m.vag.mening, m.notis ?? '', m.skatt, m.fallgrop, m.erbjudande.text].filter((t) => PAASTAENDE.test(t))
      if (utanforKrav.length) return `påstående utanför kravlistan: "${utanforKrav[0]}"`
      for (const k of m.krav.filter((x) => PAASTAENDE.test(`${x.etikett} ${x.text}`))) {
        const avgorbart = k.jamfor === 'inkomst' && p.vag.svar.inkomst === 'ja' && k.status === 'ok'
        if (!avgorbart) return `påstående som inte går att avgöra från svaren (${k.regel}, status ${k.status}): "${k.etikett}. ${k.text}"`
      }
      return null
    }))
  })
  it('inkomst- och bankfrågan: Ja, Nej och Vet inte ger ok, under och okänt', () => {
    inga(brott(nonO, (p) => {
      const k = p.modell!.krav
      const inkomst = k.find((x) => x.jamfor === 'inkomst')?.status
      const bank = k.find((x) => x.jamfor === 'bank')?.status
      if (inkomst !== forvantadJaNej(p.vag.svar.inkomst)) return `inkomststatus ${inkomst}`
      if (bank !== forvantadJaNej(p.vag.svar.bank)) return `bankstatus ${bank}`
      return null
    }))
  })
  it('varje kravrad har en etikett som säger vad jämförelsen gav', () => {
    inga(brott(medSvar, (p) => {
      const tom = p.modell!.krav.find((k) => !k.etikett.trim())
      return tom ? `kravet ${tom.regel} saknar etikett för status ${tom.status}` : null
    }))
  })
  it('inga uppmaningar att söka visum', () => {
    inga(brott(medSvar, (p) => (/\b(ansök|sök)\s+(om|visum|nu)\b/i.test(p.text) ? 'uppmaning att söka' : null)))
  })
})

describe('3a: färre än 180 dagar', () => {
  it('skatt, visumfri vistelse och garantipension', () => {
    inga(brott(sasong, (p) => {
      const m = p.modell!
      const gräns = visa('skatt-hemvist-dagar', p.datum)
      if (!/berör inte/i.test(m.skatt) || !/pengar som (du )?för in/i.test(m.skatt) || !m.skatt.includes(gräns)) {
        return `skatt: ska säga att thailändsk skatt inte berör pengar som förs in under ${gräns}. Fick: "${m.skatt}"`
      }
      const dagar = visa('visumfri-vistelse-dagar', p.datum)
      if (!p.text.includes(`${dagar} per besök`)) return `saknar "${dagar} per besök"`
      if (!/längre vistelser kräver visum/i.test(p.text)) return 'saknar "längre vistelser kräver visum"'
      const gp = visa('garantipension-max-vistelse', p.datum)
      if (!/garantipension kan behållas vid vistelse på högst/i.test(p.text) || !p.text.includes(gp)) return `saknar att garantipensionen kan behållas vid vistelse på högst ${gp}`
      return null
    }))
  })
  it('svaret skiljer på korta och långa vistelser', () => {
    const kort = sasong.filter((p) => p.vag.svar.vistelse === 'hogst')
    const lang = sasong.filter((p) => p.vag.svar.vistelse === 'langre')
    expect(kort.length).toBeGreaterThan(0)
    expect(lang.length).toBeGreaterThan(0)
    expect(kort.length + lang.length).toBe(sasong.length)
    inga(brott(kort, (p) => {
      const m = p.modell!
      if (m.vag.namn !== 'Visumfri vistelse') return `trolig väg "${m.vag.namn}" ska vara visumfri vistelse`
      const visumfri = m.krav.find((k) => k.regel === 'visumfri-vistelse-dagar')
      return visumfri?.status === 'ok' ? null : `visumfri vistelse har status ${visumfri?.status}, förväntade ok`
    }))
    inga(brott(lang, (p) => {
      const visumfri = p.modell!.krav.find((k) => k.regel === 'visumfri-vistelse-dagar')
      return visumfri?.status === 'under' ? null : `visumfri vistelse har status ${visumfri?.status}, förväntade under`
    }))
  })
})

describe('3b: 180 dagar eller fler', () => {
  it('svaret säger att man blir skatterättsligt bosatt och att pengar som förs in kan beskattas där', () => {
    inga(brott(medSvar.filter((p) => p.vag.svar.dagar === 'minst'), (p) =>
      /blir skatterättsligt bosatt i Thailand/i.test(p.modell!.skatt) && /pengar som förs in kan beskattas där/i.test(p.modell!.skatt)
        ? null
        : `skatt: "${p.modell!.skatt}"`,
    ))
  })
  it('"vet inte än" påstår ingenting om hemvist utan villkor', () => {
    inga(brott(medSvar.filter((p) => p.vag.svar.dagar === 'vetInte'), (p) => {
      const s = p.modell!.skatt
      return /^Om du stannar/.test(s) && !/^Du (blir|är) /.test(s) ? null : `skatt ska vara villkorad: "${s}"`
    }))
  })
})

describe('3c: pensionärsspåret när en väg ser ut att passa', () => {
  it('trolig väg är Non-O och de tre kraven är inkomst, bankkonto och kombination', () => {
    inga(brott(nonO, (p) => {
      const m = p.modell!
      if (!/Non-O/.test(m.vag.namn)) return `trolig väg "${m.vag.namn}"`
      const ids = m.krav.map((k) => k.regel)
      const forvantade = ['non-o-inkomstkrav', 'non-o-bankkrav', 'non-o-kombination']
      return JSON.stringify(ids) === JSON.stringify(forvantade) ? null : `krav: ${ids.join(', ')}`
    }))
  })
  it('kraven har belopp och villkor från reglerna', () => {
    inga(brott(pension, (p) => {
      const behovs = [
        visa('non-o-inkomstkrav', p.datum),
        visa('non-o-bankkrav', p.datum),
        regel('non-o-bankkrav').villkor!,
        visa('non-o-bank-minsta-saldo', p.datum),
        visa('non-o-kombination', p.datum),
      ]
      const saknas = behovs.filter((b) => !p.text.includes(b))
      return saknas.length ? `saknar: ${saknas.join(' | ')}` : null
    }))
  })
  it('försäkringskravet visas inte (det gäller bara O-A)', () => {
    inga(brott(pension, (p) => (/O-A|försäkring/i.test(p.text) || p.text.includes(visa('o-a-forsakringskrav', p.datum)) ? 'försäkringskravet visas' : null)))
  })
  it('garantipensionen nämns som upphörande vid flytt', () => {
    inga(brott(pension, (p) => {
      const tillstand = vardeUtanEnhet('garantipension-bosattning-utomlands', p.datum)
      return /garantipension/i.test(p.modell!.fallgrop) && p.modell!.fallgrop.includes(tillstand) ? null : `fallgrop: "${p.modell!.fallgrop}"`
    }))
  })
})

describe('3d: LTR är bara ett villkorat alternativ', () => {
  it('varje mening om LTR är villkorad av passiv inkomst och påstår aldrig att besökaren uppfyller', () => {
    inga(brott(nonO, (p) => {
      const ltr = meningar(p.text).filter((m) => /LTR/.test(m))
      if (!ltr.length) return 'LTR nämns inte'
      const krav = visa('ltr-inkomstkrav', p.datum)
      for (const m of ltr) {
        if (!m.includes(`om din passiva inkomst är minst ${krav}`)) return `LTR utan villkoret "om din passiva inkomst är minst ${krav}": "${m}"`
        if (/uppfyller|kvalificerar|berättigad|klarar|stämmer/i.test(m)) return `LTR-mening med påstående: "${m}"`
      }
      return null
    }))
  })
  it('ingen kravrad påstår något om LTR', () => {
    inga(brott(pension, (p) => (p.modell!.krav.some((k) => /LTR/.test(k.text)) ? 'LTR som kravrad' : null)))
  })
})

describe('3f: under arbete', () => {
  it('rubriken och inga visumpåståenden', () => {
    inga(brott(underArbete, (p) => {
      if (!p.text.includes('Ditt spår är under arbete')) return 'rubriken saknas'
      const visum = p.text.match(/visum|Non-O|LTR|troliga väg|uppfyll/i)
      return visum ? `visumpåstående: "${visum[0]}"` : null
    }))
  })
})

describe('3g: familj i Thailand', () => {
  const familj = medSvar.filter((p) => p.vag.svar.familj === 'make' || p.vag.svar.familj === 'barn')
  it('finns i urvalet', () => expect(familj.length).toBeGreaterThan(0))
  it('bara en notis om att en separat familjeväg finns, utan belopp', () => {
    inga(brott(familj, (p) => {
      const n = p.modell!.notis
      if (!n || !/separat familjeväg/i.test(n)) return `notis saknas eller nämner inte en separat familjeväg: "${n}"`
      const med = meningar(p.text).filter((m) => /familj/i.test(m) && talITexten(m).length)
      return med.length ? `mening om familj med siffror: "${med[0]}"` : null
    }))
  })
  it('utan familj visas ingen familjenotis', () => {
    inga(brott(medSvar.filter((p) => p.vag.svar.familj === 'nej'), (p) => (/familj/i.test(p.text) ? 'nämner familj' : null)))
  })
})

describe('3h: SINK-avdraget efter datum', () => {
  const sink = (p: Post) => p.text.match(/\bSINK\b[^.]*?(\d+(?:,\d+)? procent)/)?.[1] ?? null
  const harSink = pension.filter((p) => p.vag.svar.pengar !== 'kapital')
  it('22,5 procent till och med 2026-12-31', () => {
    inga(brott(harSink.filter((p) => p.datum === FORE), (p) => (sink(p) === '22,5 procent' ? null : `SINK visar ${sink(p)}`)))
  })
  it('20 procent från och med 2027-01-01', () => {
    inga(brott(harSink.filter((p) => p.datum === EFTER), (p) => (sink(p) === '20 procent' ? null : `SINK visar ${sink(p)}`)))
  })
  it('bara SINK-värdet skiljer mellan datumen', () => {
    for (const v of vagar.filter((x) => x.slut === 'pension')) {
      const fore = byggPost(v, FORE).text
      const efter = byggPost(v, EFTER).text
      expect(efter, vagNamn(v.svar)).toBe(fore.replace('22,5 procent', '20 procent'))
    }
  })
})

describe('4: fråga om vistelsens längd i säsongsspåret', () => {
  it('ställs direkt efter fråga 1, bara när man svarar färre än 180 dagar', () => {
    for (const v of vagar) {
      const ordning = Object.keys(v.svar)
      if (v.svar.dagar === 'farre') expect(ordning.slice(0, 2), vagNamn(v.svar)).toEqual(['dagar', 'vistelse'])
      else expect(ordning, vagNamn(v.svar)).not.toContain('vistelse')
    }
  })
  it('har exakt de två alternativen', () => {
    const f = fragor.find((x) => x.id === 'vistelse')
    expect(f?.alternativ.map((a) => a.text)).toEqual(['Högst 30 dagar åt gången', 'Längre än 30 dagar åt gången'])
  })
  it('gränsen i alternativen är densamma som i regler.json', () => {
    const f = fragor.find((x) => x.id === 'vistelse')!
    for (const a of f.alternativ) expect(a.text).toContain(vardeUtanEnhet('visumfri-vistelse-dagar', FORE))
    const dagar = fragor.find((x) => x.id === 'dagar')!
    for (const a of dagar.alternativ.filter((x) => x.id !== 'vetInte')) expect(a.text).toContain(vardeUtanEnhet('skatt-hemvist-dagar', FORE))
  })
})

// ---- Granskning av logikmatrisen, omgång 2 ---------------------------------------------------

describe('punkt 1: SINK gäller pension, inte kapitalinkomster', () => {
  const MENING = (datum: string) => `Om du flyttar från Sverige och blir begränsat skattskyldig dras SINK på din svenska pension: ${visa('sink-avdrag', datum)}.`
  it('pension och kombination får SINK, villkorat, med värdet för datumet', () => {
    const urval = pension.filter((p) => p.vag.svar.pengar === 'pension' || p.vag.svar.pengar === 'kombination')
    expect(urval.length).toBeGreaterThan(0)
    inga(brott(urval, (p) => (p.modell!.skatt.includes(MENING(p.datum)) ? null : `skatt: "${p.modell!.skatt}"`)))
  })
  it('kapital nämner inte SINK, vare sig i skatten eller någon annanstans', () => {
    const kapital = pension.filter((p) => p.vag.svar.pengar === 'kapital')
    expect(kapital.length).toBeGreaterThan(0)
    inga(brott(kapital, (p) => (/\bSINK\b/.test(p.text) ? 'SINK nämns' : null)))
  })
  it('säsongsspåret och "under arbete" nämner inte SINK', () => {
    inga(brott([...sasong, ...underArbete], (p) => (/\bSINK\b/.test(p.text) ? 'SINK nämns' : null)))
  })
  it('SINK nämns aldrig som ett obetingat påstående', () => {
    inga(brott(pension.filter((p) => /\bSINK\b/.test(p.text)), (p) => {
      const m = meningar(p.text).find((x) => /\bSINK\b/.test(x))!
      return /^Om du flyttar från Sverige och blir begränsat skattskyldig/.test(m) ? null : `obetingad mening: "${m}"`
    }))
  })
})

describe('punkt 2: kraven gäller förlängning ett år i taget', () => {
  const NON_O = ['non-o-inkomstkrav', 'non-o-bankkrav', 'non-o-bank-minsta-saldo', 'non-o-kombination']
  it('rubriken för kraven är "För att få stanna ett år i taget krävs:"', () => {
    inga(brott(pension, (p) => (p.modell!.rubriker.krav === KRAVRUBRIK_FORLANGNING && p.text.includes(KRAVRUBRIK_FORLANGNING) ? null : `rubrik: "${p.modell!.rubriker.krav}"`)))
    inga(brott(pension, (p) => (p.text.includes('Det här behöver du uppfylla') ? 'den vanliga kravrubriken används' : null)))
  })
  it('säsongsspåret behåller den vanliga kravrubriken', () => {
    inga(brott(sasong, (p) => (p.modell!.rubriker.krav === 'Det här behöver du uppfylla' ? null : `rubrik: "${p.modell!.rubriker.krav}"`)))
  })
  it('kraven beskrivs inte som krav för visumansökan från Sverige', () => {
    inga(brott(pension, (p) => {
      const m = p.modell!
      const kravtext = [m.rubriker.krav, ...m.krav.map((k) => `${k.etikett}. ${k.text}`)].join('\n')
      return /visumansökan|ansökan från Sverige|ansök(a|er) om visum|från Sverige/i.test(kravtext) ? 'kraven beskrivs som krav för visumansökan från Sverige' : null
    }))
  })
  it('svaret säger att vistelsen förlängs och att varje beviljande gäller högst 1 år', () => {
    inga(brott(nonO, (p) => {
      const max = visa('non-o-forlangning-max', p.datum)
      return /förlängs/.test(p.modell!.vag.mening) && p.modell!.vag.mening.includes(`varje beviljande gäller högst ${max}`) ? null : `mening: "${p.modell!.vag.mening}"`
    }))
  })
  it('regeln non-o-forlangning-max finns, med samma källa som kraven, verifierad av Raul 2026-09-30', () => {
    const r = regel('non-o-forlangning-max')
    expect(r.varde).toBe(1)
    expect(r.enhet).toBe('ar')
    expect(r.villkor).toMatch(/högst 1 år per beviljande/i)
    expect(r.verifierad).toBe(true)
    expect(r.senastKontrollerad).toBe('2026-09-30')
    expect(r.bekraftad).toEqual({ av: 'Raul', datum: '2026-09-30' })
    for (const id of NON_O) expect(regel(id).kalla, id).toBe(r.kalla)
    expect(r.kalla).toContain('immigration.go.th')
  })
  it('regel 1, 2, 10 och 11 har Immigration Bureau som källa', () => {
    for (const id of NON_O) expect(regel(id).kalla, id).toContain('immigration.go.th')
  })
})

describe('punkt 3: säsongsspåret frågar inte om ålder', () => {
  it('flödet går från vistelsens längd direkt till familj', () => {
    expect(beraknaVag({ dagar: 'farre', vistelse: 'hogst' }).fragor).toEqual(['dagar', 'vistelse', 'familj'])
    expect(beraknaVag({ dagar: 'farre', vistelse: 'hogst', familj: 'nej' })).toMatchObject({ slut: 'sasong', total: 3 })
  })
  it('ingen säsongsväg innehåller ett svar på åldersfrågan', () => {
    for (const v of vagar.filter((x) => x.svar.dagar === 'farre')) expect(Object.keys(v.svar), vagNamn(v.svar)).not.toContain('alder')
  })
  it('"Högst 30 dagar åt gången" ger Visumfri vistelse, och aldrig "under arbete"', () => {
    const kort = vagar.filter((v) => v.svar.dagar === 'farre' && v.svar.vistelse === 'hogst')
    expect(kort).toHaveLength(3) // en väg per svar på familjefrågan
    for (const v of kort) {
      expect(v.slut).toBe('sasong')
      for (const d of DATUM) expect(byggPost(v, d).modell!.vag.namn).toBe('Visumfri vistelse')
    }
  })
  it('åldersfrågan ställs fortfarande utanför säsongsspåret', () => {
    for (const dagar of ['minst', 'vetInte']) expect(beraknaVag({ dagar }).fragor).toEqual(['dagar', 'alder'])
  })
})

describe('punkt 4: inkomst Nej och bank Nej ger inte Non-O', () => {
  it('bara den kombinationen ger "ingen väg"', () => {
    const skaVara = (p: Post) => p.vag.svar.inkomst === 'nej' && p.vag.svar.bank === 'nej'
    expect(ingenVag.length).toBeGreaterThan(0)
    expect(pension.filter((p) => skaVara(p) !== (p.modell!.mall === 'pensionIngen')).map((p) => vagNamn(p.vag.svar))).toEqual([])
  })
  it('trolig väg är den avtalade meningen och inget visum nämns', () => {
    inga(brott(ingenVag, (p) => {
      const m = p.modell!
      if (m.vag.namn !== 'Ingen av pensionärsvägarna ser ut att passa med dina svar just nu') return `trolig väg: "${m.vag.namn}"`
      return /Non-O|LTR|O-A/.test(`${m.vag.namn} ${m.vag.mening}`) ? 'nämner ett visum som trolig väg' : null
    }))
  })
  it('kraven visas som information: samma tre krav, ingen jämförelse och inga påståenden', () => {
    inga(brott(ingenVag, (p) => {
      const m = p.modell!
      const ids = m.krav.map((k) => k.regel)
      if (JSON.stringify(ids) !== JSON.stringify(['non-o-inkomstkrav', 'non-o-bankkrav', 'non-o-kombination'])) return `krav: ${ids.join(', ')}`
      if (m.krav.some((k) => k.status !== 'info')) return `kravstatus: ${m.krav.map((k) => k.status).join(', ')}`
      if (m.rubriker.krav !== KRAVRUBRIK_FORLANGNING) return `rubrik: "${m.rubriker.krav}"`
      return PAASTAENDE.test(p.text) ? 'påstående i svaret' : null
    }))
  })
  it('Vet inte ger fortfarande Non-O, eftersom inget går att avgöra', () => {
    const vetInte = pension.filter((p) => (p.vag.svar.inkomst === 'vetInte' || p.vag.svar.bank === 'vetInte') && !(p.vag.svar.inkomst === 'nej' && p.vag.svar.bank === 'nej'))
    expect(vetInte.length).toBeGreaterThan(0)
    inga(brott(vetInte, (p) => (/Non-O/.test(p.modell!.vag.namn) ? null : `trolig väg: "${p.modell!.vag.namn}"`)))
  })
})

describe('punkt 5: framräknade belopp', () => {
  const KURSER = [3, 3.3, 3.37]
  const rad = (kr: number) => `${formatTal(kr)} kr`
  const inkomstBaht = () => regel('non-o-inkomstkrav').varde as number
  const bankBaht = () => regel('non-o-bankkrav').varde as number

  it('inkomstfrågan är "Är din inkomst före skatt minst X kr i månaden?" med Ja / Nej / Vet inte', () => {
    for (const kurs of KURSER) {
      const f = renderadeFragor(medKurs(kurs)).find((x) => x.id === 'inkomst')!
      expect(f.text).toBe(`Är din inkomst före skatt minst ${rad(forvantadKr(inkomstBaht(), kurs, 100))} i månaden?`)
      expect(f.alternativ.map((a) => a.text)).toEqual(['Ja', 'Nej', 'Vet inte'])
    }
  })
  it('bankfrågan är "Kan du ha minst Y kr på ett thailändskt konto från minst två månader före ansökan?" med Ja / Nej / Vet inte', () => {
    for (const kurs of KURSER) {
      const f = renderadeFragor(medKurs(kurs)).find((x) => x.id === 'bank')!
      expect(f.text).toBe(`Kan du ha minst ${rad(forvantadKr(bankBaht(), kurs, 100))} på ett thailändskt konto från minst två månader före ansökan?`)
      expect(f.alternativ.map((a) => a.text)).toEqual(['Ja', 'Nej', 'Vet inte'])
    }
  })
  it('X och Y ändras när kursen ändras, så de är inte inskrivna', () => {
    const text = (kurs: number) => renderadeFragor(medKurs(kurs)).find((x) => x.id === 'inkomst')!.text
    expect(text(3)).not.toBe(text(3.3))
  })
  it('beloppet i kronor avrundas uppåt, så att "minst X kr" aldrig ligger under kravet i baht', () => {
    for (const kurs of KURSER) {
      const kr = forvantadKr(inkomstBaht(), kurs, 100)
      expect(kr * kurs).toBeGreaterThanOrEqual(inkomstBaht())
      expect((kr - 100) * kurs).toBeLessThan(inkomstBaht())
    }
  })
  it('kraven visar baht, "ungefär X kr" och kursens datum, och X stämmer med beräkningen för varje kurs', () => {
    for (const kurs of KURSER) {
      const konfig = medKurs(kurs)
      const urval = vagar.filter((v) => v.slut === 'pension').map((v) => byggPost(v, FORE, konfig))
      inga(brott(urval, (p) => {
        const krav = p.modell!.krav.map((k) => k.text).join('\n')
        const forvantade = bahtRegler()
          .filter((r) => ['non-o-inkomstkrav', 'non-o-bankkrav', 'non-o-bank-minsta-saldo', 'non-o-kombination'].includes(r.id))
          .map((r) => ({ id: r.id, kr: rad(forvantadKr(r.varde as number, kurs, 100)) }))
        const saknas = forvantade.filter((f) => !new RegExp(`ungefär ${f.kr.replace(/ /g, '[  ]')}`).test(krav))
        if (saknas.length) return `kurs ${kurs}: saknar ungefärligt belopp för ${saknas.map((s) => `${s.id} (${s.kr})`).join(', ')}`
        const ungefar = [...krav.matchAll(/ungefär ([\d  ]+ kr)/g)].map((m) => m[1].replace(/ /g, ' '))
        const tillatna = forvantade.map((f) => f.kr.replace(/ /g, ' '))
        const okanda = ungefar.filter((u) => !tillatna.includes(u))
        if (okanda.length) return `kurs ${kurs}: belopp som inte stämmer med beräkningen: ${okanda.join(', ')}`
        if (!krav.includes(`${visa('non-o-inkomstkrav', FORE)}, ungefär ${rad(forvantadKr(inkomstBaht(), kurs, 100))} med ECB:s kurs den ${KURSDATUM}`)) {
          return `inkomstkravet saknar formen "<baht>, ungefär <kr> med ECB:s kurs den <datum>"`
        }
        return null
      }))
    }
  })
  it('alla siffror i svaren är tillåtna för varje kurs (2a med framräknade belopp)', () => {
    for (const kurs of KURSER) {
      const konfig = medKurs(kurs)
      const tillatna = tillatnaTal(konfig)
      const urval = vagar.filter((v) => v.slut !== 'underArbete').map((v) => byggPost(v, FORE, konfig))
      inga(brott(urval, (p) => {
        const okanda = [...new Set(talITexten(p.text).filter((t) => !tillatna.has(t)))]
        return okanda.length ? `kurs ${kurs}: ${okanda.join(', ')}` : null
      }))
    }
  })
  it('ett belopp som inte stämmer med beräkningen fångas', () => {
    const tillatna = tillatnaTal(medKurs(3))
    expect(tillatna.has(String(forvantadKr(inkomstBaht(), 3, 100)))).toBe(true)
    expect(tillatna.has(String(forvantadKr(inkomstBaht(), 3, 100) + 100))).toBe(false)
  })
  it('utan kurs visas ingen påhittad siffra', () => {
    const f = renderadeFragor(medKurs(null)).find((x) => x.id === 'inkomst')!
    expect(f.text).toContain('[uppgift saknas]')
    expect(talITexten(f.text)).toEqual([])
  })
})

describe('punkt 6: långa vistelser i säsongsspåret namnger inget visum', () => {
  const lang = sasong.filter((p) => p.vag.svar.vistelse === 'langre')
  it('svaret är "Du behöver ett visum. Vilket som passar beror på hur länge du stannar."', () => {
    expect(lang.length).toBeGreaterThan(0)
    inga(brott(lang, (p) => {
      const { namn, mening } = p.modell!.vag
      return `${namn}. ${mening}` === 'Du behöver ett visum. Vilket som passar beror på hur länge du stannar.' ? null : `"${namn}. ${mening}"`
    }))
  })
  it('inget visum nämns vid namn någonstans i svaret', () => {
    inga(brott(lang, (p) => {
      const namn = p.text.match(/Non-O|Non-B|Non-Immigrant|\bLTR\b|O-A|turistvisum|turist|METV|SETV|TR-visum|Smart|Elite|Visum för längre/i)
      return namn ? `nämner "${namn[0]}"` : null
    }))
  })
  it('visumfri vistelse nämns inte som trolig väg för långa vistelser', () => {
    inga(brott(lang, (p) => (/^Visumfri vistelse$/.test(p.modell!.vag.namn) ? 'visumfri vistelse som trolig väg' : null)))
  })
  it('rapporten listar vilka regler som saknas för att kunna ge ett bättre svar', () => {
    const rapport = readFileSync('rapporter/logik-matris.md', 'utf-8')
    const saknas = rapport.indexOf('## Regler som saknas för långa säsongsvistelser')
    expect(saknas, 'rubriken saknas i rapporter/logik-matris.md').toBeGreaterThan(-1)
    expect(saknas).toBeLessThan(rapport.indexOf('## Matris'))
    expect(rapport.slice(saknas, rapport.indexOf('## Matris')).match(/^- /gm)?.length ?? 0).toBeGreaterThanOrEqual(3)
  })
  it('ändringarna ligger överst i rapporten, före matrisen', () => {
    const rapport = readFileSync('rapporter/logik-matris.md', 'utf-8')
    const andringar = rapport.indexOf('## Ändringar')
    expect(andringar).toBeGreaterThan(-1)
    expect(andringar).toBeLessThan(rapport.indexOf('## Matris'))
    expect(rapport.indexOf('omgång 2')).toBeLessThan(rapport.indexOf('omgång 1'))
  })
})

describe('rapporten rapporter/logik-matris.md', () => {
  const rapport = readFileSync('rapporter/logik-matris.md', 'utf-8')
  const rader = rapport.split('## Matris')[1].split('\n').filter((r) => /^\| \d+ \| /.test(r))
  it('har en rad per väg (kör npm run logikmatris om antalet inte stämmer)', () => {
    expect(rader).toHaveLength(vagar.length)
  })
  it('visar SINK bara på rader där pengarna kommer från pension eller kombination', () => {
    for (const r of rader) {
      if (/SINK/.test(r)) expect(r, r.slice(0, 120)).toMatch(/pengar (pension|kombination)/)
      if (/pengar kapital/.test(r)) expect(r).not.toMatch(/SINK/)
    }
  })
})

describe('texterna i svar.json', () => {
  it('ansvarsfriskrivningen är exakt den från uppdraget', () => {
    expect(innehall.gemensamt.friskrivning).toBe(FRISKRIVNING)
  })
  it('alla regler som mallarna använder finns', () => {
    const ids = new Set(regler.map((r) => r.id))
    for (const mall of Object.values(innehall.spar)) {
      if (!('krav' in mall)) continue
      for (const k of mall.krav) expect(ids.has(k.regel), k.regel).toBe(true)
    }
  })
})
