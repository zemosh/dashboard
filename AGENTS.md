# AGENTS.md

„Dnešek“: osobní denní dashboard jako statická PWA bez backendu a bez buildu
(čisté HTML/CSS/JS). Běží na PC, iPhonu a iPadu u televize. Obrazovky (den, počasí,
radar, fotky, memento mori, zprávy) se přepínají swipem, šipkami nebo tečkami.
Podrobný návod pro uživatele je [README.md](README.md).

## Komunikace

- Uživatel komunikuje **česky**. Texty UI i komentáře v kódu jsou česky.
- Před většími změnami obsahu nebo zdrojů dat nejdřív navrhni a nech odsouhlasit.

## Soubory

- `config.js`: **jediný soubor, který uživatel běžně mění** (poloha, hodiny, modely počasí,
  radar, Google Kalendář, endpointy, fotky, pořadí obrazovek). Nové volby přidávej sem,
  s komentářem česky.
- `app.js`: veškerá logika, rozdělená bloky `/* ===== */` (pomocné funkce, obrazovky,
  ciferník se sluncem, hodiny, počasí a meteogram, radar, fotky, memento, kalendář, zprávy, wake lock).
- `sw.js`: service worker. **Po každé změně souborů zvýšit `VERSION`**, jinak si prohlížeče
  (hlavně PWA na iOS) drží starou verzi.
- `manifest.webmanifest`, `icons/`, `photos/photos.json` (seznam fotek).

## Vývoj a ověřování

- Lokálně **jen přes HTTP server**, např. `python -m http.server 8080` a `http://localhost:8080`.
  Z `file://` nefunguje service worker, kalendář, načtení `data/land.json` (světová mapa bez
  pevnin) a mapové servery odmítají požadavky bez adresy stránky.
- Radar (Rain Viewer) stahuje stovky dlaždic najednou (13 snímků) a Rain Viewer při častém
  načítání omezuje; proto se stahuje až při prvním zobrazení obrazovky radaru (`radarShown`).
  Při testování stránku zbytečně opakovaně nenačítat.
- Service worker nesmí cachovat mapové ani radarové dlaždice (`NO_CACHE` v `sw.js`), mezipaměť
  by rostla bez omezení.
- Úvodní obrazovka i memento se musí na iPadu (1180×820 i 820×1180) vejít bez posouvání.
  Světová mapa a mřížka mementa se překreslují přes `ResizeObserver`.
- Po editaci JS: `node --check app.js` (a `sw.js`, `config.js`).
- Ověřuj vizuálně v prohlížeči, i v úzkém okně (telefon) a na velké obrazovce (televize:
  čitelné z dálky, tmavý režim, bez nutnosti klikat).

## Produkce (server borderka)

- Adresa `https://home.zemosh.cz`, statické soubory v `/srv/sites/home.zemosh.cz/`,
  obsluhuje Caddy **za přihlášením Authelia** (účty `jiri` a `tv`). Konfigurace serveru je
  v repozitáři `borderka-infra`.
- Nasazení z PowerShellu ve složce projektu: `wsl ./deploy.sh` (rsync přes Windows
  `ssh.exe`, maže na serveru soubory, které lokálně nejsou). Commit a push dělá uživatel,
  pokud neřekne jinak.
- Kvůli Authelii (neporušovat):
  - `<link rel="manifest">` musí mít `crossorigin="use-credentials"`,
  - service worker smí ukládat do cache jen odpovědi `ok && type === 'basic' && !redirected`
    (po vypršení přihlášení server vrací přesměrování na `auth.zemosh.cz`),
  - všechny vlastní soubory jsou za přihlášením, nic veřejného na stejné adrese.
- Google Kalendář (OAuth v prohlížeči): v Google Cloud Console musí být v *Authorized
  JavaScript origins* `https://home.zemosh.cz`. Pro trvale běžící displej je plán nahradit
  OAuth vlastním endpointem na serveru (`calendarEndpoint` v `config.js`), totéž pro zprávy
  (`newsEndpoint`, RSS → JSON).

## Externí zdroje

- Open-Meteo (předpověď, bez klíče), Rain Viewer (radar; **uvedení zdroje v patičce
  neodstraňovat**, je to podmínka použití), Esri Dark Gray podklad radaru (CARTO chce od 2026 API klíč, OSM blokuje požadavky bez Refereru),
  Natural Earth obrysy pevnin v `data/land.json` (světová mapa den/noc), Leaflet z cdnjs,
  Google Fonts, Google Calendar API.
- Nové externí zdroje přidávat jen s ohledem na CORS (prohlížeč volá přímo, bez backendu).
