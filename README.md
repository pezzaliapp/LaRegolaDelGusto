# Vàghezza

Un campo di luce che cambia volto a seconda di ciò di cui hai bisogno.

Le forme non cambiano mai. Cambia solo il tuo stato interno. Sposta il tuo stato fra
quattro bisogni e lo stesso campo si re-illumina: ciò che ti offre un beneficio diventa
luminoso, caldo, attraente, sonoro; il resto si spegne. Nulla viene aggiunto o tolto —
cambia soltanto ciò che ti appare bello.

La bellezza non descrive il mondo: indica dove andare. È una bussola.

## Esperienza

- **Campo generativo** a tutto schermo, diverso a ogni visita (seed), interamente
  sintetizzato a runtime: nessuna immagine esterna.
- **Quadrante dello stato**: trascina il punto (o usa le frecce) per spostarti fra i
  quattro bisogni. Il campo risponde in tempo reale.
- **Bussola del gusto**: un ago che punta verso la regione più bella per lo stato
  corrente e si riorienta quando il bisogno cambia.
- **Due sguardi**: la rivelazione affianca due osservatori con bisogni diversi davanti
  allo stesso campo — vedono bellezze diverse.
- **Firma sonora**: un coro generativo che muta col tuo stato (attivabile, sintetizzato
  via Web Audio).

## Tecnica

HTML/CSS/JS statico, zero build, zero framework. Canvas 2D con sprite pre-renderizzati
per restare fluido a 60fps. PWA installabile e offline-first (manifest + service worker).
Rispetta `prefers-reduced-motion`; controlli accessibili da tastiera con focus visibile.

```
LaRegolaDelGusto/
├── index.html
├── manifest.webmanifest
├── sw.js
├── css/style.css
├── js/app.js
└── icons/  (icon-192, icon-512, maskable-512, og-image)
```

## Avvio in locale

```bash
python3 -m http.server 8000
# poi apri http://localhost:8000
```

Servito da root su GitHub Pages: <https://pezzaliapp.github.io/LaRegolaDelGusto/>

— alessandropezzali
