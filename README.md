# La Regola del Gusto

Un saggio interattivo sulla bellezza — da David Hume alla spiegazione evolutiva di Darwin.
PWA installabile, funzionante offline, ottimizzata per la lettura su mobile e desktop.

> «La bellezza non è una qualità delle cose: essa esiste soltanto nella mente che le contempla, e ogni mente percepisce una diversa bellezza.» — David Hume, *La regola del gusto*, 1757

## Caratteristiche

- **PWA completa**: manifest, service worker, installabile e fruibile offline.
- **Estetica editoriale**: tipografia serif (Cormorant Garamond + EB Garamond), palette calda oro/terracotta su fondo scuro.
- **Lettura immersiva**: rivelazioni allo scroll, barra di avanzamento, micro-interazioni.
- **Zero dipendenze e zero build**: solo HTML, CSS e JavaScript statici.

## Struttura

```
LaRegolaDelGusto/
├── index.html
├── manifest.webmanifest
├── sw.js
├── css/
│   └── style.css
├── js/
│   └── app.js
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── maskable-512.png
```

## Avvio in locale

Serve un server statico (il service worker non funziona aprendo il file direttamente):

```bash
python3 -m http.server 8000
# poi apri http://localhost:8000
```

## Pubblicazione su GitHub Pages

1. Fai push del contenuto sul branch `main`.
2. Vai su **Settings → Pages**.
3. In *Build and deployment*, seleziona **Source: Deploy from a branch**, branch `main`, cartella `/ (root)`.
4. L'app sarà disponibile su `https://pezzaliapp.github.io/LaRegolaDelGusto/`.

## Licenza

Testo e progetto © Alessandro Pezzali. Codice riutilizzabile liberamente per scopi personali.
