// Testar logiken mot alla svarskombinationer, före och efter 2027-01-01, med fast växelkurs.
import { describe, expect, it } from 'vitest'
import {
  DATUM, EFTER, FORE, allaVagar, byggPost, fragor, forvantadInkomststatus, innehall, meningar, regel,
  talITexten, tillatnaTal, vagNamn, vardeUtanEnhet, visa, type Post, type Vag,
} from './allaVagar'

const vagar = allaVagar()
const poster: Post[] = vagar.flatMap((v) => DATUM.map((d) => byggPost(v, d)))
const medSvar = poster.filter((p) => p.modell)
const underArbete = poster.filter((p) => !p.modell)
const pension = medSvar.filter((p) => p.vag.slut === 'pension')
const sasong = medSvar.filter((p) => p.vag.slut === 'sasong')

const FRISKRIVNING =
  'Det här är allmän information, inte personlig rådgivning. Regler och belopp ändras, och din situation kan innehålla detaljer som ett formulär inte fångar.'

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
  it('"under arbete" bara för under 50 år, lön eller eget företag', () => {
    const skaVara = (v: Vag) => v.svar.alder === 'under' || v.svar.pengar === 'lon' || v.svar.pengar === 'eget'
    expect(vagar.filter((v) => (v.slut === 'underArbete') !== skaVara(v)).map((v) => vagNamn(v.svar))).toEqual([])
  })
  it('fråga 1 "färre än" ger säsongsspåret, övriga pensionärsspåret, och annat ger inget spår', () => {
    for (const v of vagar.filter((x) => x.slut !== 'underArbete')) {
      expect(v.slut, vagNamn(v.svar)).toBe(v.svar.dagar === 'farre' ? 'sasong' : 'pension')
    }
    for (const v of vagar.filter((x) => x.slut === 'pension')) expect(['pension', 'kapital', 'kombination']).toContain(v.svar.pengar)
  })
})

describe('2a: varje siffra i ett svar finns i regler.json eller config.json', () => {
  const tillatna = tillatnaTal()
  it('inga andra siffror förekommer', () => {
    inga(brott(poster, (p) => {
      const okanda = [...new Set(talITexten(p.text).filter((t) => !tillatna.has(t)))]
      return okanda.length ? `siffror som inte finns i reglerna eller konfigurationen: ${okanda.join(', ')}` : null
    }))
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
  it('påståenden förekommer bara för inkomstkravet och bara när intervallet ligger över kravet', () => {
    inga(brott(medSvar, (p) => {
      const m = p.modell!
      const utanforKrav = [m.vag.mening, m.notis ?? '', m.skatt, m.fallgrop, m.erbjudande.text].filter((t) => PAASTAENDE.test(t))
      if (utanforKrav.length) return `påstående utanför kravlistan: "${utanforKrav[0]}"`
      for (const k of m.krav.filter((x) => PAASTAENDE.test(`${x.etikett} ${x.text}`))) {
        const avgorbart = k.jamfor === 'inkomst' && forvantadInkomststatus(p.vag.svar, p.datum) === 'ok' && k.status === 'ok'
        if (!avgorbart) return `påstående som inte går att avgöra från svaren (${k.regel}, status ${k.status}): "${k.etikett}. ${k.text}"`
      }
      return null
    }))
  })
  it('bankfrågan: "Ja" och "Kanske" avgör inget eftersom beloppet inte anges', () => {
    inga(brott(pension, (p) => {
      const bank = p.modell!.krav.find((k) => k.jamfor === 'bank')
      if (!bank) return 'kravet om bankkonto saknas'
      const forvantad = p.vag.svar.bank === 'nej' ? 'under' : 'nara'
      return bank.status === forvantad ? null : `bankstatus ${bank.status}, förväntade ${forvantad}`
    }))
  })
  it('inkomstintervallet jämförs mot kravet i baht med den fasta kursen', () => {
    inga(brott(pension, (p) => {
      const inkomst = p.modell!.krav.find((k) => k.jamfor === 'inkomst')
      const forvantad = forvantadInkomststatus(p.vag.svar, p.datum)
      return inkomst?.status === forvantad ? null : `inkomststatus ${inkomst?.status}, förväntade ${forvantad}`
    }))
  })
  it('"nära gränsen" använder den fasta formuleringen', () => {
    const nara = pension.filter((p) => p.modell!.krav.some((k) => k.jamfor === 'inkomst' && k.status === 'nara'))
    expect(nara.length).toBeGreaterThan(0)
    inga(brott(nara, (p) => (p.text.includes('Du ligger nära gränsen – kontrollera ditt exakta belopp') ? null : 'formuleringen saknas')))
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
      if (!p.text.includes(`högst ${dagar} per besök`) && !p.text.includes(`${dagar} per besök`)) return `saknar "högst ${dagar} per besök"`
      if (!/längre vistelser kräver visum/i.test(p.text)) return 'saknar "längre vistelser kräver visum"'
      const gp = visa('garantipension-max-vistelse', p.datum)
      if (!/garantipension kan behållas vid vistelse på högst/i.test(p.text) || !p.text.includes(gp)) return `saknar att garantipensionen kan behållas vid vistelse på högst ${gp}`
      return null
    }))
  })
  it('svaret skiljer på korta och långa vistelser (fråga 4)', () => {
    const kort = sasong.filter((p) => p.vag.svar.vistelse === 'hogst')
    const lang = sasong.filter((p) => p.vag.svar.vistelse === 'langre')
    expect(kort.length).toBeGreaterThan(0)
    expect(lang.length).toBeGreaterThan(0)
    expect(kort.length + lang.length).toBe(sasong.length)
    inga(brott(kort, (p) => {
      const m = p.modell!
      if (!/^Visumfri vistelse$/.test(m.vag.namn)) return `trolig väg "${m.vag.namn}" ska vara visumfri vistelse`
      if (/visum för längre|ett visum/i.test(m.vag.mening)) return 'en kort vistelse ska inte få visumkrav som trolig väg'
      const visumfri = m.krav.find((k) => k.regel === 'visumfri-vistelse-dagar')
      return visumfri?.status === 'ok' ? null : `visumfri vistelse har status ${visumfri?.status}, förväntade ok`
    }))
    inga(brott(lang, (p) => {
      const m = p.modell!
      if (!/visum för längre vistelse/i.test(m.vag.namn)) return `trolig väg "${m.vag.namn}" ska vara visum för längre vistelse`
      if (/^Visumfri vistelse$/.test(m.vag.namn)) return 'en lång vistelse ska inte få visumfri vistelse som trolig väg'
      const visumfri = m.krav.find((k) => k.regel === 'visumfri-vistelse-dagar')
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

describe('3c: pensionärsspåret', () => {
  it('trolig väg är Non-O och de tre kraven är inkomst, bankkonto och kombination', () => {
    inga(brott(pension, (p) => {
      const m = p.modell!
      if (!/Non-O/.test(m.vag.namn)) return `trolig väg "${m.vag.namn}"`
      const ids = m.krav.map((k) => k.regel)
      const forvantade = ['non-o-inkomstkrav', 'non-o-bankkrav', 'non-o-kombination']
      return JSON.stringify(ids) === JSON.stringify(forvantade) ? null : `krav: ${ids.join(', ')}`
    }))
  })
  it('kraven har belopp och villkor från reglerna', () => {
    inga(brott(pension, (p) => {
      const t = p.text
      const behovs = [
        visa('non-o-inkomstkrav', p.datum),
        visa('non-o-bankkrav', p.datum),
        regel('non-o-bankkrav').villkor!,
        visa('non-o-bank-minsta-saldo', p.datum),
        visa('non-o-kombination', p.datum),
      ]
      const saknas = behovs.filter((b) => !t.includes(b))
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
    inga(brott(pension, (p) => {
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

describe('3e: Nej på bankfrågan och inkomst under kravet', () => {
  const urval = pension.filter((p) => p.vag.svar.bank === 'nej' && forvantadInkomststatus(p.vag.svar, p.datum) === 'under')
  it('finns i urvalet', () => expect(urval.length).toBeGreaterThan(0))
  it('svaret säger inte att kraven är uppfyllda', () => {
    inga(brott(urval, (p) => (PAASTAENDE.test(p.text) ? 'säger att något är uppfyllt' : null)))
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
  const sink = (p: Post) => p.text.match(/SINK-avdrag[^.]*?(\d+(?:,\d+)? procent)/)?.[1] ?? null
  it('22,5 procent till och med 2026-12-31', () => {
    inga(brott(pension.filter((p) => p.datum === FORE), (p) => (sink(p) === '22,5 procent' ? null : `SINK visar ${sink(p)}`)))
  })
  it('20 procent från och med 2027-01-01', () => {
    inga(brott(pension.filter((p) => p.datum === EFTER), (p) => (sink(p) === '20 procent' ? null : `SINK visar ${sink(p)}`)))
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

describe('texterna i svar.json', () => {
  it('ansvarsfriskrivningen är exakt den från uppdraget', () => {
    expect(innehall.gemensamt.friskrivning).toBe(FRISKRIVNING)
  })
})
