# Visumtestet

Gratis visumtest på svenska för dig som vill bo i Thailand längre än en semester. Statisk sajt byggd med Vite och TypeScript, utan backend.

## Filerna du redigerar

| Fil | Innehåll |
| --- | --- |
| `data/regler.json` | Alla belopp, gränser och regler. Inga siffror finns i koden. |
| `data/svar.json` | Svarstexterna som mallar med platshållare, plus knappar och rubriker. |
| `data/fragor.json` | Frågorna, svarsalternativen och hjälptexterna. |
| `config.json` | Länk till Shopify-produkten, Brevo-id:n, uppgifter till integritetstexten och växelkurs med datum. |
| `netlify/functions/epost.ts` | Funktionen som tar emot e-postadressen och lägger in den i Brevo. |
| `docs/dns-poster.md` | Vilka DNS-poster som läggs in hos Loopia. |

## Ändra en regel

1. Kör `npm run kallor`. Du får alla regler med värde, källa och status, så att du kan bocka av dem en i taget.
2. Öppna källan och jämför med värdet.
3. Ändra i `data/regler.json`. Varje regel ser ut så här:

   ```json
   {
     "id": "non-o-inkomstkrav",
     "varde": 65000,
     "enhet": "THB/manad",
     "kalla": "https://thaiembassy.se/en/visa/",
     "senastKontrollerad": "2026-10-01",
     "verifierad": true
   }
   ```

4. Sätt `"verifierad": true` och `senastKontrollerad` till dagens datum (`ÅÅÅÅ-MM-DD`). Datumet visas under svaren. Ändrar du ett värde senare ska du sätta tillbaka `verifierad` till `false` tills du har kontrollerat igen.

**Produktionsbygget stoppas** (`npm run build`) om någon regel har `"verifierad": false`, saknar värde, källa eller datum, och om `config.json` har en platshållare kvar (se Konfiguration). I utvecklingsläge visas i stället en röd banderoll: *Innehåller overifierade uppgifter*.

### Regler som ändras över tid

En regel kan ha olika värde under olika perioder. Då är `varde` en lista i stället för ett tal. Rätt värde väljs automatiskt efter dagens datum (svensk tid), både i svaren och i bygget:

```json
{
  "id": "sink-avdrag",
  "varde": [
    { "fran": null, "till": "2026-12-31", "varde": 22.5 },
    { "fran": "2027-01-01", "till": null, "varde": 20 }
  ],
  "enhet": "procent"
}
```

`fran` och `till` är inklusive och kan vara `null`. Gäller ingen period idag saknas värdet och produktionsbygget stoppas. Webbplatsen byggs om vid publicering, så låt en ny driftsättning ske efter ett datumbyte (se även bygget på Vercel/Netlify). Sidans besökare får rätt värde direkt eftersom datumet avgörs i webbläsaren.

Regler kan också ha `villkor`, en text om vad värdet kräver. Villkoret visas inte i svaren om du inte själv tar med det i en mall.

## Automatisk källkontroll

Varje dag kontrollerar GitHub Actions (`.github/workflows/kallkontroll.yml`) att källorna fortfarande säger det reglerna säger. Du kan också köra den själv: `npm run kontrollera`. Körningen skriver en rapport på svenska i `rapporter/ÅÅÅÅ-MM-DD.md`.

**Kontrollen bekräftar aldrig en regel första gången.** Den kan bara sätta `verifierad` till `false` och uppdatera `senastKontrollerad` för en regel som du redan har bekräftat.

### Fälten som kontrollen använder

| Fält | Betydelse |
| --- | --- |
| `citat` | Den exakta meningen på källsidan som innehåller värdet. Värdet måste stå i citatet. Blanksteg och radbrytningar spelar ingen roll, allt annat måste stämma ordagrant. |
| `metod` | `html`, `pdf` eller `manuell`. Vid `manuell` kontrolleras inget automatiskt. |
| `bekraftad` | `{ "av": "Raul", "datum": "ÅÅÅÅ-MM-DD" }`. Du bekräftar att du har läst källan. Utan den hoppar kontrollen över regeln, och produktionsbygget stoppas. |
| `sidhash` | Fingeravtryck av källsidans text. |
| `extraKallor` | Lista med fler källor (`kalla`, `citat`, `metod`, `sidhash`) som alla måste stämma. `sink-avdrag` använder det för Skatteverket och SFS 1991:586. |
| `kontrolleraVarde` | Valfritt. Lista med de värden som ska stå i just den källans citat. Standard är alla värden regeln kan ha. |
| `felIRad` | Räknas av kontrollen. Tre misslyckade hämtningar i rad sätter `verifierad` till `false`. |

Bekräftar du en PDF på thailändska: välj den engelska meningen som citat. Thailändsk PDF-text extraheras ofullständigt (tonmarkörer tappas).

### Status

| Status | Betyder | Kontrollen gör |
| --- | --- | --- |
| OK | Citatet finns kvar, värdet står i det och fingeravtrycket stämmer. | Sätter `senastKontrollerad` till dagens datum. |
| ÄNDRAD | Sidan har ändrats men citatet finns kvar. | Skapar ett ärende. Uppdatera `sidhash` när du har granskat sidan. |
| SAKNAS | Citatet är borta eller värdet står inte i det. | Sätter `verifierad` till `false` och skapar ett ärende med gammalt citat, vad som står nu och länk. |
| FEL | Sidan gick inte att hämta. | Skapar ett ärende. Efter tre i rad sätts `verifierad` till `false`. |
| MANUELL | Citat, fingeravtryck, bekräftelse eller automatisk metod saknas. | Gör ingenting. |

Alla ärenden får etiketten `källkontroll`. Ett redan öppet ärende med samma rubrik dubbleras inte.

### Lägga in citat första gången

Källorna måste hämtas från en plats med internetåtkomst. Gå till *Actions → Källkontroll → Run workflow* och välj läget `foresla`, eller kör `npm run kontrollera -- --foresla`. Då sparas `rapporter/forslag-ÅÅÅÅ-MM-DD.md` med meningar som innehåller värdena och sidans fingeravtryck, utan att något i `data/regler.json` ändras. Välj en mening per källa, kontrollera den mot källan och skriv in `metod`, `citat` och `sidhash` i regeln. Sätt `kontrolleraVarde` när värdet i regeln skrivs på ett annat sätt än i källan, t.ex. `["högst ett år"]` när källan skriver ett år med bokstäver.

### Regler som bara kan kontrolleras för hand

Vissa sidor går inte att hämta automatiskt (Immigration Bureau ligger bakom Cloudflares botskydd, och Revenue Departments PDF omdirigeras). De har `"metod": "manuell"`, med citatet inskrivet av en människa. Då skapar GitHub Actions ett ärende **den första varje månad** (`.github/workflows/manuell-kontroll.yml`, `npm run paminnelse`) med etiketten `manuell-kontroll`. Ärendet listar reglerna med värde, citat och länk, och en avbockningslista. Stäng ärendet när du har kontrollerat dem. Etiketten är en annan än `källkontroll`, så ärendet startar inte rutinen som ändrar regler. Ett ärende för samma månad skapas bara en gång.

Dagliga körningar sparas på standardgrenen. Skyddas grenen mot direkta pushar måste Actions få undantag.

## Efter merge: gör `main` till standardgren

Gör det **direkt efter att pull requesten är mergad**: *Settings → Branches → Default branch → `main`*.

GitHub kör schemalagda arbetsflöden (den dagliga källkontrollen och växelkursen, och månadspåminnelsen) bara på standardgrenen, och de dagliga uppdateringarna av `data/regler.json`, `config.json` och `rapporter/` committas dit. I det här repot har de schemalagda körningarna gått på grenen `claude/thailand-visa-test-ay90oq`, vilket tyder på att den är standardgren (den första gren som pushades till det tomma repot). Förblir den standardgren efter merge fortsätter de dagliga commit:arna att hamna på den gamla grenen i stället för på `main`. Produktionssajten, som byggs från `main`, får då aldrig de uppdaterade datumen och kurserna.

Kontrollera också att Vercel eller Netlify har `main` som produktionsgren. Den gamla grenen kan tas bort när `main` är standardgren.

## Växelkurs

Samma dagliga körning hämtar kursen baht per krona och skriver den till `config.json` med datum (`npm run vaxelkurs`). Källan är ECB:s officiella referenskurser: baht per krona räknas ur EUR/THB och EUR/SEK. Misslyckas hämtningen lämnas `config.json` orörd, och körningen markeras som misslyckad så att du ser det. Kursen och dess datum visas i svaret (`{vaxelkurs}` och `{vaxelkursDatum}`).

## Rutiner

I `rutiner/` finns instruktioner för agenter som arbetar med reglerna. De är bara textfiler, så något måste starta dem:

- `rutiner/andring.md`: körs när ett ärende skapas. Gäller bara ärenden med etiketten `källkontroll`. Läser ärendet, hämtar källan, jämför med `regler.json`, skriver en kort sammanfattning i ärendet och öppnar en PR med föreslaget nytt värde och citat. Sätter alltid `verifierad` till `false`. Slår aldrig ihop något.
- `rutiner/nyheter.md`: körs varje måndag. Söker officiella källor efter regler som saknas i `regler.json` och skapar ett ärende per fynd (etiketten `regelnyhet`). Ändrar ingen kod.

## Skriva svarstexterna

Texterna i `data/svar.json` är utkast. Skriv över dem med egna. Platshållare:

| Platshållare | Blir |
| --- | --- |
| `{non-o-inkomstkrav}` | Värdet med enhet, t.ex. "65 000 baht i månaden". Regelns id styr. |
| `{non-o-inkomstkrav.varde}` | Bara värdet, t.ex. "65 000". |
| `{non-o-bankkrav.villkor}` | Regelns `villkor`, t.ex. bankkravets tidsvillkor. |
| `{visumfri-vistelse-dagar.start}` | Datumet då regelns gällande period började, på svenska, t.ex. "15 september 2026". Bara för regler med perioder. Saknas startdatum visas `[uppgift saknas]`. |
| `{non-o-inkomstkrav.kr}` | Beloppet i kronor, framräknat ur regelns baht och kursen i `config.json` och avrundat uppåt, t.ex. "21 700 kr". Fungerar för regler i baht. |
| `{svar.dagar}` | Besökarens svar på frågan med id `dagar` (`dagar`, `vistelse`, `alder`, `pengar`, `inkomst`, `bank`, `familj`). |
| `{vaxelkurs}`, `{vaxelkursDatum}` | Kursen och dess datum (ÅÅÅÅ-MM-DD) från `config.json`. |

Enhetsetiketterna ("baht i månaden" osv.) ligger under `enheter` i samma fil. Saknas ett värde visas `[uppgift saknas]`, så du ser det direkt. Texten är ren text, ingen HTML.

Under varje svar visas äldsta `senastKontrollerad` bland de regler svaret använder. Har någon av dem inget datum står det *ej kontrollerad*.

## Hjälptexter under frågorna

Lägg in texterna från fliken Visumguiden i `hjalptext` i `data/fragor.json` för frågorna `dagar`, `alder`, `inkomst` och `bank`. Frågetexterna kan ha platshållare, t.ex. `{non-o-inkomstkrav.kr}` i inkomstfrågan. Tom sträng (`""`) betyder att texten saknas och flaggas i banderollen. `null` betyder att frågan inte ska ha någon hjälptext.

## Konfiguration (`config.json`)

```json
{
  "shopifyLank": "https://thailandskollen.se/products/PLATSHALLARE",
  "epost": { "tjanst": "/api/epost", "listaId": null, "bekraftelsemallId": null },
  "integritet": { "ansvarig": "Raul Andrei Sofa, enskild firma", "kontaktEpost": "hello@thailandskollen.se" },
  "avrundningKr": 100,
  "vaxelkurs": { "thbPerSek": 0.0, "datum": "ÅÅÅÅ-MM-DD" }
}
```

- `shopifyLank`: knappen i slutet av svaret. Värdet är en platshållare (`PLATSHALLARE`) tills produkten är publicerad. Byt då till produktens riktiga adress. **Produktionsbygget stoppas** så länge platshållaren finns kvar.
- `epost.tjanst`: adressen till Netlify-funktionen. Ändras inte.
- `epost.listaId` och `epost.bekraftelsemallId`: id för listan *Visumtestet* och bekräftelsemallen i Brevo (se nedan). Det är inga hemligheter.
- `integritet.ansvarig`: den personuppgiftsansvarige på integritetssidan ("Personuppgiftsansvarig är …"). Skriv namn och firmaform. Innehåller värdet `[hakparenteser]` eller `PLATSHALLARE` **stoppas produktionsbygget**. `integritet.kontaktEpost`: adressen som personer mejlar för att få ut, rätta eller radera sina uppgifter.
- `vaxelkurs`: baht per krona och datumet för kursen. Frågorna om inkomst och bankkonto räknar fram belopp i kronor ur den, så **produktionsbygget stoppas om kursen saknas**. Kursen fylls i av den dagliga körningen (`npm run vaxelkurs`), eller skriv in den själv.
- `avrundningKr`: beloppen i kronor avrundas uppåt till närmaste så här många kronor (100), så att "minst X kr" aldrig ligger under kravet i baht.

Produktionsbygget stoppas av varje platshållare i `config.json`: ett värde som innehåller `PLATSHALLARE` eller text inom `[hakparenteser]`, var som helst i filen. Tomma värden (`null`), som `epost.listaId` och `epost.bekraftelsemallId` innan Brevo-kontot är klart, stoppar inte bygget. De skrivs som varning, listas av `npm run kallor` och visas i banderollen i förhandsvisningar, och e-postfältet döljs. Förhandsvisningar stoppas aldrig.

### Hur e-posten skickas (Brevo)

E-postfältet skickar till Netlify-funktionen `netlify/functions/epost.ts` på `/api/epost`. Funktionen lägger in kontakten i Brevos lista *Visumtestet* med dubbel bekräftelse (double opt-in): besökaren får ett mejl och blir först kontakt när hen klickat på länken. Efter klicket skickas besökaren till `/bekraftad/`. Spåret sparas som Brevo-attributet `SPAR` med värdet `pensionar`, `sasong` eller `under-arbete`. Inga svar på frågorna sparas, bara adressen och spåret, och bara för den som kryssat i samtyckesrutan.

**Fältet visas bara när allt detta finns.** Annars ritas det inte alls:

1. Miljövariabeln `BREVO_API_KEY` i Netlify (*Site configuration → Environment variables*). Nyckeln ligger aldrig i koden eller repot, och bakas aldrig in i sajten. Variabeln måste gälla både *Builds* och *Functions* (standard är alla), och sajten måste byggas om efter att du lagt in den.
2. `epost.listaId` i `config.json`: id för listan *Visumtestet*.
3. `epost.bekraftelsemallId` i `config.json`: id för bekräftelsemallen.

Så här gör du i Brevo (kontot är gratisnivån):

1. Skapa en kontaktlista som heter *Visumtestet*. Id:t står i listöversikten.
2. Skapa ett kontaktattribut av typen text som heter `SPAR` (*Contacts → Settings → Contact attributes*). Utan det avvisar Brevo anropet.
3. Skapa en mall för dubbel bekräftelse (*Double opt-in template*). Den **måste** innehålla bekräftelselänken `{{ params.DOIurl }}`. Mallens id är `epost.bekraftelsemallId`.
4. Skapa en API-nyckel (*SMTP & API → API keys*) och lägg den som `BREVO_API_KEY` i Netlify.
5. Autentisera avsändardomänen `thailandskollen.se` i Brevo. DNS-posterna står i `docs/dns-poster.md`.

Funktionen svarar likadant om adressen redan finns som kontakt, så att ingen kan läsa ut vilka adresser som är registrerade. Den loggar aldrig adressen.

Utan `BREVO_API_KEY` på din dator visas inget fält i `npm run dev`. Vill du se fältet lokalt: `BREVO_API_KEY=x npm run dev` och skriv in två id i `config.json` (ändra inte det du checkar in). Själva anropet till `/api/epost` finns bara på Netlify.

### Integritetssidan och bekräftelsesidan

`/integritet/` och `/bekraftad/` är vanliga sidor med text ur `data/svar.json` under `sidor`. `{ansvarig}` och `{kontaktEpost}` hämtas ur `config.json`. Länken till integritetssidan finns i sidfoten på varje sida och vid samtyckesrutan (den öppnas i en egen flik, så att besökarens svar finns kvar).

## Logiktest

`npm test` bygger svaret för varje möjlig väg genom frågorna (174 vägar, före och efter 2027-01-01, med en fast växelkurs) och kontrollerar dem mot kraven i `tests/logik-matris.test.ts`:

- varje siffra i ett svar finns i `regler.json` eller `config.json`,
- varje svar har rubriken "Din troliga väg", ansvarsfriskrivningen och kontrolldatum,
- inget svar påstår att något är uppfyllt om det inte går att avgöra från svaren,
- kraven per spår (säsong, pension, LTR bara villkorat, under arbete, familj, SINK bara för pension och efter datum, kraven som förlängning ett år i taget, framräknade belopp i kronor som stämmer med beräkningen).

Ändrar du en mall i `data/svar.json` och något krav bryts pekar testet ut vilken väg och vilken mening. `npm run logikmatris` skriver `rapporter/logik-matris.md` med en rad per väg.

## Utveckla

```sh
npm install
npm run dev                     # lokal server med röd banderoll för overifierat
npm test                        # enhetstester
npm run kallor                  # lista regler, källor och status
npm run build                   # produktionsbygge, stoppas av overifierade regler
npm run build:forhandsvisning   # bygge utan regelkontroll, med banderoll
```

## Driftsätta

Sajten är statisk, med en Netlify-funktion för e-posten. Koppla repot till Netlify. `netlify.toml` anger:

- Build command: `npm run build`
- Output directory: `dist`
- Functions: `netlify/functions`

Vercel fungerar inte för e-postfältet, eftersom funktionen är skriven för Netlify.

Domänerna: `thailandskollen.se` och `www` pekar på Shopify, `test.thailandskollen.se` på Netlify. DNS-posterna står i `docs/dns-poster.md`.

Bygget avgör själv om det är produktion eller förhandsvisning:

| Bygge | Regelkontroll | Röd banderoll |
| --- | --- | --- |
| Produktion (Vercel `production`, Netlify `production`) | Stoppas av overifierade regler | Nej |
| Förhandsvisning (Vercel `preview`, Netlify `deploy-preview` och `branch-deploy`, `npm run dev`, `npm run build:forhandsvisning`) | Nej | Ja, om något är overifierat eller saknas |

Produktionsgrenen är normalt `main`. Allt annat blir en förhandsvisning.

## Se och testa på mobilen innan reglerna är verifierade

1. Koppla repot till Vercel eller Netlify enligt ovan. Produktionsbygget på `main` misslyckas så länge reglerna är overifierade. Det är avsiktligt, och `main` publiceras inte.
2. Varje gren och pull request får en egen förhandsadress (Vercel: *Preview*, Netlify: *Deploy Preview* eller *Branch Deploy*). Adressen står i pull requesten och i Vercel/Netlify under *Deployments*.
3. Öppna adressen på mobilen, eller skanna en QR-kod av den. Du ser hela flödet med den röda banderollen överst. Den listar vilka regler, konfigurationsvärden och hjälptexter som återstår.
4. Ändra i datafilerna på en gren, pusha, och öppna den nya förhandsadressen.

Förhandsadresserna är publika för den som har länken. Vill du begränsa dem, kontrollera inställningarna för förhandsvisningar (Vercel: *Deployment Protection*, Netlify: lösenordsskydd) innan du delar dem.

Lokalt: `npm run dev -- --host` skriver ut en adress på det lokala nätverket, som du kan öppna på en mobil på samma wifi. Det fungerar bara om du kör projektet på din egen dator.

## Integritet

Inga spårningscookies och ingen analys. Svaren hålls bara i webbläsarens minne och sparas inte. Bara e-postadressen och spåret (pensionär, säsong eller under arbete) sparas, hos Brevo, och bara för den som kryssar i samtyckesrutan och bekräftar adressen i mejlet. Texten står på `/integritet/` och i `data/svar.json` under `sidor.integritet`.
