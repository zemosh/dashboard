# Dnešek — denní dashboard

Statická webová aplikace bez backendu. Funguje na PC i na iPhonu/iPadu, po přidání na plochu se chová jako nativní appka. Obrazovky se přepínají swipem, šipkami nebo tečkami dole.

```
index.html   manifest.webmanifest   icons/
styles.css   sw.js                  photos/
app.js       config.js  ← jediný soubor, který budeš měnit
```

## 1. Nahrání na web

Dashboard běží na **https://home.zemosh.cz** (server borderka, za přihlášením Authelia,
účty `jiri` a `tv`). Nahrání nové verze z PowerShellu ve složce projektu:

```
wsl ./deploy.sh
```

Skript pošle soubory rsyncem přes SSH (`ssh borderka`) a smaže na serveru, co lokálně
už není. Předtím zvyš `VERSION` v `sw.js`.

Kvůli přihlašování má `<link rel="manifest">` atribut `crossorigin="use-credentials"`
a service worker ukládá do cache jen skutečné soubory, ne přesměrování na přihlášení.

Jiné možnosti hostingu (původní návod). Aplikace potřebuje HTTPS (jinak nefunguje
service worker ani přidání na plochu). Nejrychlejší cesty:

- **Cloudflare Pages** — Create project → Direct Upload → přetáhni celou složku.
- **Netlify Drop** — app.netlify.com/drop, přetáhni složku, hotovo do minuty.
- **GitHub Pages** — commitni obsah do repozitáře a zapni Pages.

Otevřením `index.html` z disku (`file://`) se dá ledacos vyzkoušet, ale kalendář ani service worker tam běžet nebudou.

## 2. Přidání na plochu (iOS)

Safari → tlačítko Sdílet → Přidat na plochu. Spouštěj pak jen z ikony na ploše, ne ze Safari — jinak zůstane adresní řádek a nebude fungovat udržení rozsvíceného displeje.

## 3. Nastavení

Vše je v `config.js`. Minimálně zkontroluj `home` (souřadnice a časové pásmo), `clocks` a `mementoMori.birthDate`.

**Souřadnice** si najdeš třeba na mapy.cz pravým tlačítkem. Přesnost na dvě desetinná místa stačí.

**Modely počasí** v `weather.models` se posílají Open-Meteu. Kromě přednastavených ICON, ECMWF a GFS jsou k dispozici i `meteofrance_seamless` (AROME má nad Evropou 1,5 km) nebo `jma_seamless`. Seznam a chování si můžeš proklikat na open-meteo.com/en/docs.

## 4. Google Kalendář

Aplikace se ptá Googlu přímo z prohlížeče, takže nikde neleží žádné heslo — jen dočasný token v `localStorage` tvého zařízení. Nastavení je jednorázové:

1. Na console.cloud.google.com založ projekt (název je jedno).
2. **APIs & Services → Library** → najdi *Google Calendar API* → Enable.
3. **OAuth consent screen** → typ *External* → vyplň název a svůj e-mail → v sekci *Test users* přidej svůj Google účet. Publikovat aplikaci není potřeba, v režimu Testing ti to bude fungovat.
4. **Credentials → Create credentials → OAuth client ID** → typ *Web application*. Do **Authorized JavaScript origins** dej přesnou adresu, kde dashboard běží, například `https://dnesek.pages.dev`. Bez lomítka na konci. Chceš-li ladit lokálně, přidej i `http://localhost:8080`.
5. Vzniklé **Client ID** vlož do `config.js` jako `google.clientId`.
6. Do `google.calendarIds` napiš ID kalendářů. `primary` je tvůj hlavní; ostatní najdeš v Google Kalendáři pod Nastavení a sdílení → Integrace kalendáře → ID kalendáře (vypadá jako e-mail).

Token platí hodinu. Většinou se obnoví sám na pozadí; když se to nepovede, objeví se v kalendáři tlačítko k opětovnému připojení.

## 5. Fotky

Nahraj obrázky do složky `photos/` a vypiš je v `photos/photos.json`:

```json
{ "photos": [
  { "src": "photos/kolo.jpg", "caption": "Šumava, srpen" },
  { "src": "photos/deti.jpg" }
] }
```

Fotky zmenši zhruba na 2000 px na delší straně, ať se na telefonu nestahují dlouho.

## 6. Až rozjedeš vlastní hosting

V `config.js` jsou dva háčky, které mají přednost před vším ostatním:

- `calendarEndpoint` — URL vracející JSON pole `[{ start, end, allDay, title, location }]`, časy v ISO. Server si drží refresh token, takže dashboard nikdy neřeší přihlašování. Tohle je pro trvale běžící displej podstatně spolehlivější než OAuth v prohlížeči.
- `newsEndpoint` — URL vracející `[{ title, source, link, published }]`. Server stáhne RSS (ČT24, iRozhlas, NPR…) a přeloží ho do JSON. Dokud je pole prázdné, obrazovka se zprávami se vůbec nezobrazí — RSS nejde načíst přímo z prohlížeče kvůli CORS.

Na obojí bohatě stačí Cloudflare Worker ve free tarifu.

## 7. Aktualizace po změně souborů

Service worker si soubory cachuje. Po úpravě `config.js` nebo čehokoli jiného zvyš `VERSION` v `sw.js` (`v1` → `v2`) a načti stránku znovu; na iOS appku napřed úplně zavři (odsunout z přepínače aplikací).

## 8. Zdroje dat a jejich limity

- **Open-Meteo** — bez klíče, zdarma pro nekomerční použití, data pod CC BY 4.0. Předpověď se stahuje každých 10 minut a poslední odpověď se ukládá, takže při výpadku sítě uvidíš to poslední.
- **Rain Viewer** — radar zdarma pro osobní použití, snímky po 10 minutách za poslední 2 hodiny, bez záruky dostupnosti. Podmínkou je viditelné uvedení zdroje, které je v patičce — neodstraňuj ho.
- **Esri Dark Gray** — podkladová mapa pod radarem (server.arcgisonline.com, bez klíče; uvedení zdroje v rohu mapy neodstraňovat). CARTO od roku 2026 vyžaduje API klíč, OpenStreetMap odmítá požadavky bez adresy stránky (např. z `file://`).
- **Natural Earth** (public domain) — obrysy pevnin pro světovou mapu, `data/land.json`.

## 9. Co zatím neumí

- Zobrazení delší předpovědi radaru než to, co Rain Viewer právě nabízí.
- Vytváření nebo úpravy událostí v kalendáři — přístup je jen pro čtení.
- Notifikace. PWA na iOS je umí až od iOS 16.4 a jen pro appky přidané na plochu; zatím nejsou zapojené.
