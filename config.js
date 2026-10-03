/* ------------------------------------------------------------------
   Nastavení dashboardu. Tohle je jediný soubor, který potřebuješ měnit.
   Po úpravě stačí v prohlížeči tvrdě obnovit (na iOS zavřít a otevřít).
------------------------------------------------------------------ */

window.DASHBOARD_CONFIG = {

  /* Místo, podle kterého se počítá slunce, počasí i radar. */
  home: {
    name: 'Boston',
    lat: 42.3601,
    lon: -71.0589,
    tz: 'America/New_York'
  },

  /* Světový čas. lat/lon je volitelné – slouží k tečce den/noc
     a k vyznačení místa na světové mapě (úvodní obrazovka). */
  clocks: [
    { label: 'Praha',  tz: 'Europe/Prague',   lat: 50.0755, lon: 14.4378 },
    { label: 'Boston', tz: 'America/New_York', lat: 42.3601, lon: -71.0589 }
  ],

  weather: {
    /* Numerické modely do meteogramu. Názvy viz open-meteo.com/en/docs
       icon_seamless = DWD, ecmwf_ifs025 = ECMWF, gfs_seamless = NOAA,
       meteofrance_seamless = ARPEGE/AROME, jma_seamless = JMA        */
    models: [
      { id: 'icon_seamless',  label: 'ICON',  color: '#EFA855' },
      { id: 'ecmwf_ifs025',   label: 'ECMWF', color: '#6FBFD0' },
      { id: 'gfs_seamless',   label: 'GFS',   color: '#B59CD9' }
    ],
    hours: 72,        // délka meteogramu
    days: 7           // délka denní předpovědi
  },

  radar: {
    zoom: 7,          // radarová data Rain Viewer mají nejvíc 7, víc je jen zvětšené
    frameMs: 420,     // rychlost animace
    colorScheme: 4,   // 0–8, viz rainviewer.com/api/color-schemes.html
    smooth: 1,
    snow: 1
  },

  /* Kalendář: vyplň clientId a seznam kalendářů (e-mailové adresy kalendářů
     najdeš v Google Kalendáři → Nastavení kalendáře → ID kalendáře).
     Postup na vytvoření clientId je v README.md.
     Necháš-li prázdné, obrazovka jen napoví, co dodělat.               */
  google: {
    clientId: '',
    calendarIds: ['primary'],
    daysAhead: 7
  },

  /* Až rozjedeš vlastní hosting: URL endpointu, který vrátí JSON
     [{ start, end, allDay, title, location, calendar }].
     Když je vyplněno, má přednost před Google OAuth.                   */
  calendarEndpoint: '',

  /* Totéž pro zprávy: endpoint vracející [{ title, source, link, published }].
     Prázdné = obrazovka se zprávami se vůbec nezobrazí.                */
  newsEndpoint: '',

  photos: {
    manifest: 'photos/photos.json',
    intervalSec: 45,
    shuffle: true
  },

  /* Data narození: známý je jen rok, proto 1. července (střed roku).
     Přesné datum zpřesní počty týdnů i víkendů.                        */
  mementoMori: {
    birthDate: '1984-07-01',
    lifeExpectancy: 85,
    /* Víkendy s dětmi: kolik víkendů zbývá, než dítěti bude `childhoodEnd` let. */
    children: [
      { label: 'starší', birthDate: '2012-07-01' },
      { label: 'mladší', birthDate: '2015-07-01' }
    ],
    childhoodEnd: 18
  },

  /* Pořadí obrazovek. Odeber, co nechceš. */
  screens: ['day', 'weather', 'radar', 'photos', 'memento', 'news'],

  /* Automatické přepínání obrazovek (0 = vypnuto). */
  rotateSeconds: 0,

  /* Držet displej rozsvícený, když appka běží na popředí. */
  keepAwake: true
};
