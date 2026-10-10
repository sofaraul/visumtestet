# Uppdrag: visumtestet

## Uppdraget

Bygg ett gratis visumtest på svenska för svenskar som planerar att bo i Thailand längre än en semester. Besökaren svarar på upp till sex frågor och får ett svar om sin troliga visumväg, vad hen behöver uppfylla, om thailändsk skatt berör hen, och en vanlig fallgrop. Därefter erbjuds den betalda guiden.

## Målgrupp

Svenskar mellan 50 och 75 år, de flesta på mobil, ofta via en länk från en Facebookgrupp. Det styr designen:

* Mobil först.
* Minst 18 px brödtext, hög kontrast och stora tryckytor.
* En fråga per skärm, en tydlig förloppsindikator och en alltid synlig Tillbaka-knapp.
* Inga popups, ingen chattbot, inget som ser ut som en annons.

## Teknik

* Statisk sajt utan backend i version 1. Vite och TypeScript, utan tungt ramverk.
* Driftsätts på Vercel eller Netlify direkt från repot.
* All konfiguration i en fil: länk till Shopify-produkten, e-postmottagare och växelkurs med datum.

## Den viktigaste regeln: data skild från logik

Alla belopp, gränser och regler ligger i `data/regler.json`, aldrig i koden. Varje regel har den här formen:

```json
{
  "id": "non-o-inkomstkrav",
  "varde": 65000,
  "enhet": "THB/manad",
  "kalla": "https://thaiembassy.se/en/visa/",
  "senastKontrollerad": null,
  "verifierad": false
}
```

* Produktionsbygget ska misslyckas om någon regel har `"verifierad": false`. I utvecklingsläge visas i stället en röd banderoll: Innehåller overifierade uppgifter.
* Datumet i `senastKontrollerad` visas under varje svar.
* Skapa ett skript, `npm run kallor`, som listar alla regler med källa och status, så att ägaren kan bocka av dem en i taget.

Fyll filen med följande startvärden, samtliga som overifierade:

* Non-O, pension: 65 000 baht i månaden eller 800 000 baht på konto. Källa: https://thaiembassy.se/en/visa/
* LTR, pensionärer: minst 50 år och 80 000 USD per år. Källa: https://ltr.boi.go.th/
* Thailändsk skatterättslig hemvist: 180 dagar per kalenderår. Källa: rd.go.th
* SINK-avdrag på svensk pension: 22,5 procent. Källa: https://www.pensionsmyndigheten.se/ga-i-pension/planera-din-pension/planera-din-pension-du-som-bor-utanfor-sverige
* Garantipension: upphör vid bosättning utanför Sverige, men kan behållas vid vistelse på högst ett år. Källa: https://www.pensionsmyndigheten.se/ga-i-pension/planera-din-pension/planera-att-flytta-fran-sverige
* Visumfri vistelse för svenska medborgare: antal dagar okänt. Lämna värdet tomt.

## Frågorna

1. Hur många dagar per år räknar du med att vara i Thailand? – Färre än 180 dagar / 180 dagar eller fler / Vet inte än
2. Hur gammal är du? – Under 50 / 50 eller äldre
3. Var kommer dina pengar ifrån? – Pension / Lön från svensk arbetsgivare / Eget företag eller frilans / Kapital och sparande / Kombination
4. Är din inkomst före skatt minst X kr i månaden? – Ja / Nej / Vet inte (X räknas fram ur Non-O-kravet i baht och växelkursen)
5. Kan du ha minst Y kr på ett thailändskt konto från minst två månader före ansökan om förlängning? – Ja / Nej / Vet inte (Y räknas fram ur bankkravet i baht och växelkursen)
6. Har du familj i Thailand? – Nej / Ja, make eller maka / Ja, barn

I säsongsspåret ställs dessutom en fråga direkt efter fråga 1: Hur länge varar varje vistelse? – Högst 30 dagar åt gången / Längre än 30 dagar åt gången. Säsongsspåret frågar inte om ålder.

Visa hjälptexterna under frågorna 1, 2, 4 och 5. Texterna finns i fliken Visumguiden och läggs in i `data/fragor.json`.

## Förgrening

* Fråga 1, färre än 180 dagar: säsongsspåret. Fråga om vistelsens längd och fråga 6, sedan svar. Ingen åldersfråga.
* Fråga 1, 180 dagar eller fler eller vet inte än: vidare till fråga 2.
* Fråga 2, under 50 (utanför säsongsspåret): spåret är under arbete.
* Fråga 3, lön eller eget företag: spåret är under arbete.
* Övriga: pensionärsspåret. Fråga 4, 5 och 6, sedan svar. Svarar besökaren Nej på både fråga 4 och 5 ser ingen pensionärsväg ut att passa, och kraven visas som information.
* Spår under arbete: visa Ditt spår är under arbete och erbjud e-post för besked när det är klart.

## Svaret

Samma struktur i alla spår:

1. Din troliga väg: visumvägens namn och en mening om vad den innebär.
2. Det här behöver du uppfylla: tre punkter, jämförda med besökarens svar. Belopp i kronor räknas fram ur reglernas baht och växelkursen i konfigurationen och visas med kursens datum. I pensionärsspåret är rubriken för kraven "För att få stanna ett år i taget krävs:", eftersom kraven gäller förlängning i Thailand.
3. Skatt: en mening om huruvida 180-dagarsgränsen berör besökaren.
4. Det folk missar: en fallgrop kopplad till spåret.
5. Erbjudandet: en knapp till Shopify-produkten.

Under svaret visas Senast kontrollerad mot källa: [datum] och ansvarsfriskrivningen:

> Det här är allmän information, inte personlig rådgivning. Regler och belopp ändras, och din situation kan innehålla detaljer som ett formulär inte fångar.

Svarstexterna skrivs av ägaren. Bygg dem som redigerbara mallar i `data/svar.json` med platshållare.

## E-post

* Frågas först efter att svaret visats, aldrig före.
* Text: Vill du ha ditt svar mejlat till dig, plus besked när reglerna ändras?
* Samtyckesruta som inte är förkryssad, med länk till en kort integritetstext.
* Skickas till mottagaren i konfigurationen. Saknas mottagare visas inte fältet alls.

## Integritet

* Inga spårningscookies i version 1.
* Svaren på frågorna sparas inte. Bara e-postadressen sparas, och bara för den som samtyckt.

## Klart när

* Hela flödet fungerar på mobil, från första frågan till erbjudandet.
* Säsongs- och pensionärsspåret ger svar, övriga visar under arbete.
* Alla belopp hämtas från `regler.json` och inga siffror finns i koden.
* Produktionsbygget stoppas om någon regel är overifierad.
* README förklarar hur ägaren ändrar en regel och driftsätter.

## Gör inte

* Hitta inte på belopp, gränser eller regler. Saknas en uppgift lämnas den tom och flaggas.
* Formulera aldrig svar som uppmaningar som du ska söka. Skriv alltid din troliga väg.
* Lägg inte till funktioner utanför uppdraget.

---

# Arbetsnoter för framtida sessioner

* Kod i `src/`: `flode.ts` (förgrening, bara frågeordning), `jamfor.ts` (jämförelser), `mall.ts` (platshållare), `svar.ts` (bygger svaret), `ui.ts`/`epost.ts`/`banderoll.ts` (vyer). Belopp och texter finns i `data/` och `config.json`.
* Regler kan vara datumstyrda: `varde` är då en lista med perioder (`fran`, `till`, `varde`). `scripts/gallande.mjs` väljer värdet som gäller idag, både i webbläsaren och i skripten.
* Källkontroll: `scripts/kalltext.mjs` (hämta och jämför text), `kontroll.mjs` (status och regler för vad som ändras), `arenden.mjs` (GitHub-ärenden), `kontrollera.mjs` (CLI). Den får aldrig sätta `verifierad` till true. Hitta aldrig på ett citat: citat och sidhash kommer från en hämtad sida och förs in av en människa efter `npm run kontrollera -- --foresla`.
* Manuella regler (`metod: "manuell"`) påminns om den första varje månad: `scripts/paminnelse.mjs` och `.github/workflows/manuell-kontroll.yml` skapar ett ärende med etiketten `manuell-kontroll` (inte `källkontroll`). Åldern i fråga 2 kommer från regeln `non-o-minalder`; LTR-åldern är `ltr-minalder` ("över 50 år", källans formulering). `kontrolleraVarde` i en regel styr vilket värde som ska stå i citatet.
* `scripts/vaxelkurs.mjs` hämtar växelkursen (ECB) till `config.json`. `rutiner/` innehåller agentinstruktioner (`andring.md`, `nyheter.md`). Nyhetsärenden ska aldrig få etiketten `källkontroll`.
* `scripts/regler.mjs` delas av `npm run kallor` och bygget (`vite.config.ts`).
* `npm test` innehåller ett test som stoppar siffror i `src/`. Lägg aldrig belopp eller gränser i koden.
* Tomma värden är avsiktliga och flaggas: `visumfri-vistelse-dagar` och `null` i `config.json`. Fyll dem inte med gissningar. Hjälptexterna i `fragor.json` är ifyllda av ägaren.
* `vite.config.ts` avgör förhandsvisning eller produktion (`__FORHANDSVISNING__`): `VERCEL_ENV=preview`, `CONTEXT=deploy-preview|branch-deploy` och `--mode development` är förhandsvisningar utan byggstopp men med röd banderoll. Bara produktionsbygget stoppas av overifierade regler.
* Kraven i pensionärsspåret (regel non-o-inkomstkrav, non-o-bankkrav, non-o-bank-minsta-saldo, non-o-kombination och non-o-forlangning-max) gäller förlängning av vistelsen i Thailand, ett år i taget (Immigration Bureau, punkt 2.22). De får inte beskrivas som krav för visumansökan från Sverige. SINK nämns bara när pengarna kommer från pension eller kombination (`sinkNar` i `data/svar.json`). Säsongsvistelser längre än 30 dagar namnger inget visum.
* Produktionsbygget kräver `vaxelkurs` och `avrundningKr` i `config.json`, eftersom frågorna räknar fram belopp i kronor. `{regel-id.kr}` i mallar och frågor.
* Källor för meningar i `data/svar.json` som saknar platshållare (alltså som inte hämtar sitt innehåll ur `regler.json`):
  * "för semester och kortare affärsbesök" och e-visumportalen: Thailands ambassad i Stockholm, samma sida som `visumfri-vistelse-dagar` (https://thaiembassy.se/en/visa/).
  * "styrkas, till exempel med ett pensionsbesked": Immigration Bureau, dokument 7-6, dokumentlistan punkt 3.
  * Anmälan och återbetalning av garantipension: Pensionsmyndigheten, samma sida som `garantipension-max-vistelse`.
* Testa flödet på mobilbredd (390 px) efter ändringar i UI.
* `tests/logik-matris.test.ts` prövar alla vägar mot kraven: alla siffror i ett svar måste finnas i `regler.json` eller `config.json`, inget påstående utan att villkoret går att avgöra från svaren, LTR bara villkorat, familj bara som notis om en separat väg, SINK efter datum. Belopp i kronor får bara komma från `{regel-id.kr}`. Svarsmallarna är `sasongKort`, `sasongLang`, `pension` och `pensionIngen` i `data/svar.json`, och varje kravrad har egna etiketter per utfall. `npm run logikmatris` skriver `rapporter/logik-matris.md`.

---

# Uppdrag 2 (6 oktober 2026): Brevo, integritetstext och domän

* E-posten går via Brevo, inte FormSubmit. Mission-avsnittet "E-post" ovan är ersatt på dessa punkter: texten är *Vill du få besked när reglerna som berör dig ändras?* (löftet om att mejla svaret är borttaget, eftersom svaren inte sparas), mottagaren i konfigurationen finns inte längre, och fältet saknas när `BREVO_API_KEY` (miljövariabel i Netlify, aldrig i repot), `epost.listaId` eller `epost.bekraftelsemallId` saknas vid bygget (`__EPOST_AKTIV__`, `epostAktiv` i `scripts/regler.mjs`).
* `netlify/functions/epost.ts` tar emot `{email, samtycke, spar}` och anropar Brevos double opt-in-endpoint (`/v3/contacts/doubleOptinConfirmation`) med attributet `SPAR` (`pensionar`, `sasong`, `under-arbete`, se `src/spar.ts`). Den släpper bara igenom de tre fälten, loggar aldrig adressen och svarar likadant om kontakten redan finns. Anropet är testat mot en låtsas-Brevo i `tests/epost-funktion.test.ts`, och av ägaren på riktigt i Netlify-förhandsvisningen den 6 oktober 2026: kontakten hamnade i lista 5 med `SPAR` = `sasong` och `DOUBLE_OPT-IN` = 1. Molnmiljön når inte Brevo, så sessioner kan inte själva köra anropet. Kontrollera mot Brevos dokumentation om något ändras.
* Sidorna `/integritet/` och `/bekraftad/` (`integritet/index.html`, `bekraftad/index.html`, `src/sida.ts`) hämtar text ur `sidor` i `data/svar.json`. `{ansvarig}` och `{kontaktEpost}` kommer ur `config.json`. Ansvarig är `Raul Andrei Sofa, enskild firma` (ägarens uppgift 6 oktober 2026). Texten börjar med "Personuppgiftsansvarig är {ansvarig}." Sidfoten (`src/fot.ts`) länkar till integritetssidan på alla sidor.
* `shopifyLank` är en platshållare (`PLATSHALLARE`) tills Shopify-produkten är publicerad. Produktionsbygget stoppas av varje platshållare i `config.json` (`PLATSHALLARE` eller `[text]`, `platshallareIConfig` i `scripts/regler.mjs`, ägarens beslut 6 oktober 2026). Förhandsvisningar stoppas inte, och tomma värden (`null`) är bara varningar. Slå inte ihop PR #1 före publiceringen, annars leder köpknappen till en sida som inte finns.
* Domänerna: `thailandskollen.se` och `www` till Shopify, `test.thailandskollen.se` till Netlify. Domänen och DNS ligger hos Loopia (DNS-editor och vidarebefordran av e-post via Loopia), och listan står i `docs/dns-poster.md`. MX-posterna (Loopias vidarebefordran) ska inte ändras. Brevos poster har inga värden där, eftersom de bara visas i Brevo-kontot.
* Köpare från Shopify till Brevo hör inte till uppdraget. Det kopplas med Brevos Shopify-app vid lansering.

