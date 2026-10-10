# DNS-poster hos Loopia för thailandskollen.se

Lämnad till Raul, som lägger in dem själv i Loopias DNS-editor för domänen. Domänen och DNS ligger hos Loopia. Det finns ingen proxy att stänga av, eftersom ingen annan DNS-tjänst står framför.

Tre tjänster ska fungera på samma domän:

| Adress | Pekar på |
| --- | --- |
| `thailandskollen.se` och `www.thailandskollen.se` | Shopify-butiken |
| `test.thailandskollen.se` | Netlify, visumtestet |
| Mejl som skickas från `@thailandskollen.se` | Brevo (domänautentisering) |

## 1. Shopify

| Typ | Värd (namn) | Värde |
| --- | --- | --- |
| A | `@` (själva domänen) | `23.227.38.65` |
| CNAME | `www` | `shops.myshopify.com` |

- Det får bara finnas **en** A-post för `@` och **en** post för `www`. Finns det redan andra A-poster för `@`, alla AAAA-poster för `@` eller en annan post för `www` i Loopias DNS-editor, ta bort dem innan du lägger in Shopifys. De krockar med Shopifys.
- Lägg sedan till domänen i Shopify: *Inställningar → Domäner → Anslut befintlig domän*. Shopify kan ta upp till 48 timmar på sig att verifiera.
- Värdena är Shopifys vanliga för tredjepartsdomäner. Jag hann inte läsa dem på Shopifys egen hjälpsida (nätverket i molnmiljön släpper inte in dit), utan har dem från sökträffar. Shopify visar exakt vad som gäller under *Domäner* när du ansluter domänen. Går de två åt olika håll, följ Shopify.

## 2. Netlify (visumtestet)

| Typ | Värd (namn) | Värde |
| --- | --- | --- |
| CNAME | `test` | `lustrous-wisp-b70985.netlify.app` |

- Värdet är sajtens nuvarande Netlify-adress. Kontrollera den under *Site configuration → Domain management* i Netlify.
- Lägg först till `test.thailandskollen.se` i Netlify (*Domain management → Add a domain*), annars svarar Netlify inte på adressen. Netlify föreslår kanske sin egen DNS. Det behövs inte, eftersom DNS ligger kvar hos Loopia. Certifikatet (https) skapas av Netlify automatiskt när DNS-posten har slagit igenom.
- Subdomänen `test` ska peka på produktionsgrenen, `main`. Det händer först när PR #1 är ihopslagen.

## 3. Brevo (domänautentisering)

Dessa poster finns **inte** i den här listan med värden, eftersom värdena är unika för ditt Brevo-konto och bara visas i Brevo. Jag har inte konto och kan inte hitta på dem.

1. I Brevo: *Senders, domains & dedicated IPs → Domains → Add a domain*, skriv `thailandskollen.se`.
2. Brevo visar då de poster som ska läggas in. Lägg in **alla** i Loopias DNS-editor exakt som de står. Det rör sig om tre sorters poster:
   - en TXT-post som bevisar att domänen är din (Brevo-koden),
   - DKIM-poster (signering av mejlen),
   - en DMARC-post (TXT på `_dmarc`).
3. Tryck *Authenticate* i Brevo när posterna är inlagda.

Särskilt för Loopia:

- Skriv värden (namnet) som Brevo anger, till exempel `brevo1._domainkey`, utan att lägga till `.thailandskollen.se`. Loopia lägger själv till domänen, och annars dubblas den. Kontrollera i listan efteråt.
- Det får bara finnas **en** SPF-post (TXT som börjar med `v=spf1`) och **en** DMARC-post på domänen. Om Brevo anger en SPF-post och det redan finns en, lägg in Brevos del i den befintliga i stället för att skapa en andra. Två poster gör att båda ogiltigförklaras.

## MX och e-post till hello@thailandskollen.se

MX-posterna sköts av Loopias vidarebefordran av e-post och **ska inte ändras eller tas bort**. Därför tar `hello@thailandskollen.se` emot post utan att något behöver göras för det. Lägg inte in några MX-poster för Brevo, Shopify eller Netlify: ingen av dem behöver dem här.

Loopia vidarebefordrar bara inkommande post. Brevo skickar den utgående. När du lägger in `hello@thailandskollen.se` som avsändare i Brevo kan Brevo be dig bekräfta adressen med en kod som skickas dit, och den når dig via vidarebefordran.
