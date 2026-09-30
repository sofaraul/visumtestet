# Visumtestet

Gratis visumtest på svenska för dig som vill bo i Thailand längre än en semester. Statisk sajt byggd med Vite och TypeScript, utan backend.

## Filerna du redigerar

| Fil | Innehåll |
| --- | --- |
| `data/regler.json` | Alla belopp, gränser och regler. Inga siffror finns i koden. |
| `data/svar.json` | Svarstexterna som mallar med platshållare, plus knappar och rubriker. |
| `data/fragor.json` | Frågorna, svarsalternativen och hjälptexterna. |
| `config.json` | Länk till Shopify-produkten, e-postmottagare och växelkurs med datum. |

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

**Produktionsbygget stoppas** (`npm run build`) om någon regel har `"verifierad": false`, saknar värde, källa eller datum. I utvecklingsläge visas i stället en röd banderoll: *Innehåller overifierade uppgifter*.

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

Källorna måste hämtas från en plats med internetåtkomst. Gå till *Actions → Källkontroll → Run workflow* och välj läget `foresla`. Då sparas `rapporter/forslag-ÅÅÅÅ-MM-DD.md` med meningar som innehåller värdena och sidans fingeravtryck, utan att något i `data/regler.json` ändras. Välj en mening per källa, kontrollera den mot källan och skriv in `metod`, `citat`, `sidhash` och `bekraftad` i regeln. Lokalt: `npm run kontrollera -- --foresla`.

Dagliga körningar sparas på standardgrenen. Skyddas grenen mot direkta pushar måste Actions få undantag.

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
| `{svar.dagar}` | Besökarens svar på frågan med id `dagar` (`dagar`, `alder`, `pengar`, `inkomst`, `bank`, `familj`). |
| `{inkomstSek}`, `{inkomstThb}` | Vald inkomst och omräkningen till baht. |
| `{vaxelkurs}`, `{vaxelkursDatum}` | Kursen och datumet från `config.json`. |

Enhetsetiketterna ("baht i månaden" osv.) ligger under `enheter` i samma fil. Saknas ett värde visas `[uppgift saknas]`, så du ser det direkt. Texten är ren text, ingen HTML.

Under varje svar visas äldsta `senastKontrollerad` bland de regler svaret använder. Har någon av dem inget datum står det *ej kontrollerad*.

## Hjälptexter under frågorna

Lägg in texterna från fliken Visumguiden i `hjalptext` i `data/fragor.json` för frågorna `dagar`, `alder`, `inkomst` och `bank`. Tom sträng (`""`) betyder att texten saknas och flaggas i banderollen. `null` betyder att frågan inte ska ha någon hjälptext.

## Konfiguration (`config.json`)

```json
{
  "shopifyLank": "https://din-butik.myshopify.com/products/guiden",
  "epost": { "mottagare": "du@exempel.se", "tjanst": "https://formsubmit.co/ajax/{mottagare}" },
  "vaxelkurs": { "thbPerSek": 0.0, "datum": "ÅÅÅÅ-MM-DD" }
}
```

- `shopifyLank`: knappen i slutet av svaret. Saknas den visas ingen knapp.
- `epost.mottagare`: dit adresserna skickas. Saknas den visas inte e-postfältet alls.
- `vaxelkurs`: baht per krona och datumet för kursen. Saknas kursen kan inkomsten inte jämföras.

### Hur e-posten skickas

Sajten saknar backend, så formuläret skickas via tjänsten [FormSubmit](https://formsubmit.co) till mottagaren i `config.json`. Första gången någon skickar något får mottagaren ett mejl från FormSubmit som måste bekräftas. Skicka ett testmejl själv först. Vill du byta tjänst ändrar du `epost.tjanst`; den ska ta emot en JSON-post med `email`, `samtycke` och `spar`.

Bara e-postadressen, samtycket och vilket spår svaret gäller skickas. Svaren på frågorna lämnar aldrig webbläsaren. Integritetstexten står i `data/svar.json` under `epost.integritet`. Den nämner FormSubmit, så ändra den om du byter tjänst.

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

Sajten är statisk. Koppla repot till Vercel eller Netlify med:

- Build command: `npm run build`
- Output directory: `dist`

Samma kommando gör rätt i båda fallen, eftersom bygget själv avgör om det är produktion eller förhandsvisning:

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

Inga spårningscookies och ingen analys. Svaren hålls bara i webbläsarens minne och sparas inte. Bara e-postadressen sparas, och bara för den som kryssar i samtyckesrutan.
