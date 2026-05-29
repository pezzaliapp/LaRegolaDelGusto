/* ============================================================================
   Vàghezza — un campo di luce che cambia volto secondo il bisogno di chi guarda.

   L'idea, resa esperienza: le forme non cambiano mai. Cambia solo lo stato interno
   dell'osservatore. Le forme che offrono un beneficio per il bisogno attivo si
   illuminano (calde, attraenti, sonore); le altre si spengono. La bellezza non è
   nelle cose: è la percezione di un beneficio. È una bussola, non una descrizione.
   ========================================================================== */
(() => {
  'use strict';

  const canvas = document.getElementById('field');
  const ctx = canvas.getContext('2d', { alpha: false });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- generatore pseudo-casuale con seme (campo diverso a ogni visita) ---- */
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let seed, rnd;
  function setSeed(s) { seed = s; rnd = mulberry32(hashStr(String(s))); }

  /* ---------- i quattro bisogni (senza etichette pesanti: solo colore e segno) ----
     Ognuno ha una tinta. La forma che serve un bisogno, quando quel bisogno è
     attivo, brilla con la sua tinta. */
  const NEEDS = [
    { hue: 38  }, // calore / nutrimento — ambra
    { hue: 336 }, // legame — rosa
    { hue: 158 }, // riparo / sicurezza — verde
    { hue: 205 }  // esplorare / oltre — azzurro
  ];
  const N = NEEDS.length;
  // posizioni degli ancoraggi sul quadrante (in coordinate viewBox 0..200), in alto/dx/basso/sx
  const ANCHOR_ANGLE = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

  /* ---------- stato dell'osservatore: pesi sui bisogni, da posizione del puck ----- */
  // puck in coordinate normalizzate del quadrante (-1..1), centro = equilibrio
  let puck = { x: 0, y: 0 };
  let weights = new Array(N).fill(1 / N);

  function computeWeights() {
    // ancoraggi su un cerchio di raggio 1
    let sum = 0;
    const w = new Array(N);
    for (let i = 0; i < N; i++) {
      const ax = Math.cos(ANCHOR_ANGLE[i]);
      const ay = Math.sin(ANCHOR_ANGLE[i]);
      const dx = puck.x - ax, dy = puck.y - ay;
      const d2 = dx * dx + dy * dy;
      w[i] = 1 / (d2 + 0.28);     // vicino a un ancoraggio → quel bisogno domina
      sum += w[i];
    }
    for (let i = 0; i < N; i++) w[i] /= sum;
    weights = w;
  }
  computeWeights();

  /* ---------- il campo: forme astratte con affordance fisse ---------------------- */
  let motes = [];
  const FIELD_MARGIN = 0.06;

  function buildField() {
    const area = window.innerWidth * window.innerHeight;
    // densità misurata, con tetto per device modesti
    let count = Math.round(area / 17000);
    count = Math.max(40, Math.min(reduceMotion ? 70 : 110, count));

    motes = [];
    for (let i = 0; i < count; i++) {
      // affordance: ogni forma serve soprattutto uno o due bisogni
      const aff = new Array(N).fill(0);
      const primary = Math.floor(rnd() * N);
      aff[primary] = 0.7 + rnd() * 0.3;
      if (rnd() < 0.45) {
        const sec = (primary + 1 + Math.floor(rnd() * (N - 1))) % N;
        aff[sec] = 0.3 + rnd() * 0.4;
      }
      for (let k = 0; k < N; k++) aff[k] += rnd() * 0.12;

      motes.push({
        // posizione normalizzata 0..1 (mappata in qualunque viewport)
        bx: FIELD_MARGIN + rnd() * (1 - 2 * FIELD_MARGIN),
        by: FIELD_MARGIN + rnd() * (1 - 2 * FIELD_MARGIN),
        ox: 0, oy: 0,            // scostamento dinamico (deriva + puntatore)
        vx: 0, vy: 0,
        aff,
        primary,
        r: 0.7 + rnd() * 1.5,    // raggio base (scalato col displaySize)
        // identità stabile della forma: uno "scheletro" riconoscibile, sempre lo stesso
        sides: 3 + Math.floor(rnd() * 4),   // 3..6 raggi/petali
        rot: rnd() * Math.PI * 2,
        spin: (rnd() < 0.5 ? -1 : 1) * (0.05 + rnd() * 0.18),
        // parametri di deriva propri
        dphase: rnd() * Math.PI * 2,
        dspeed: 0.06 + rnd() * 0.16,
        damp: 0.012 + rnd() * 0.03,
        pulse: rnd() * Math.PI * 2,
        pulseSpd: 0.5 + rnd() * 1.1,
        b: 0, bSmooth: 0         // bellezza per lo stato corrente
      });
    }
  }

  /* ---------- pre-render delle "scintille" (glow) per tinta — veloce in drawImage - */
  const SPRITE = 128;
  let needSprites = [];   // glow colorato per ciascun bisogno
  let dimSprite = null;   // glow neutro e freddo (forma "spenta")
  let coreSprite = null;  // nucleo brillante

  function makeGlow(hue, sat, light, a0) {
    const c = document.createElement('canvas');
    c.width = c.height = SPRITE;
    const g = c.getContext('2d');
    const r = SPRITE / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0,   `hsla(${hue},${sat}%,${light}%,${a0})`);
    grad.addColorStop(0.28,`hsla(${hue},${sat}%,${light}%,${a0 * 0.42})`);
    grad.addColorStop(1,   `hsla(${hue},${sat}%,${light}%,0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, SPRITE, SPRITE);
    return c;
  }
  function buildSprites() {
    needSprites = NEEDS.map(n => makeGlow(n.hue, 92, 64, 1));
    dimSprite = makeGlow(225, 16, 46, 1);
    coreSprite = makeGlow(45, 30, 99, 1);
  }

  /* ---------- canvas / DPR / resize --------------------------------------------- */
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  /* ---------- puntatore (mouse / dito) ------------------------------------------- */
  const pointer = { x: -1, y: -1, active: false, vis: false };
  let ripples = [];
  let blooms = [];         // fioriture spontanee: una forma bella che sboccia
  let bloomTimer = 2.5;

  function smoothstep(a, b, x) {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  // campo di correnti: un flusso coerente e lento, così le forme vorticano insieme
  // invece di tremolare ciascuna nel proprio cerchietto (x, y normalizzati 0..1)
  function flowField(x, y, t) {
    const a = Math.sin(x * 6.1 + t * 0.16) + Math.cos(y * 5.0 - t * 0.12);
    const b = Math.cos(x * 4.6 - t * 0.10) + Math.sin(y * 5.7 + t * 0.14);
    return { x: Math.cos(a * 1.6 + b * 0.7), y: Math.sin(b * 1.4 - a * 0.5) };
  }

  /* ---------- calcolo della bellezza e disegno del campo ------------------------- */
  // disegna l'intero campo dentro un rettangolo, con uno stato (pesi) dato
  function renderField(rect, w, t, interactive) {
    const { x: rx, y: ry, w: rw, h: rh } = rect;
    const minSide = Math.min(rw, rh);
    const baseScale = minSide * (reduceMotion ? 0.052 : 0.058);

    let cxAcc = 0, cyAcc = 0, bAcc = 0;  // per la bussola (centroide pesato sulla bellezza)
    const bright = [];                   // luci accese, per tessere le costellazioni

    ctx.globalCompositeOperation = 'lighter';

    for (let m = 0; m < motes.length; m++) {
      const mo = motes[m];

      // bellezza = quanto la forma serve il bisogno attivo
      let beauty = 0;
      for (let i = 0; i < N; i++) beauty += mo.aff[i] * w[i];
      // contrasto: separa nettamente il bello dallo spento
      beauty = smoothstep(0.24, 0.62, beauty);

      // tinta dominante per lo stato corrente
      let dom = 0, domv = -1;
      for (let i = 0; i < N; i++) {
        const v = mo.aff[i] * w[i];
        if (v > domv) { domv = v; dom = i; }
      }

      // posizione su schermo
      const px = rx + (mo.bx) * rw + mo.ox * rw;
      const py = ry + (mo.by) * rh + mo.oy * rh;

      // attrazione locale del puntatore: il bello reagisce al tocco
      let localB = beauty;
      if (interactive && pointer.vis) {
        const ddx = px - pointer.x, ddy = py - pointer.y;
        const dist = Math.hypot(ddx, ddy);
        const near = 1 - smoothstep(0, minSide * 0.34, dist);
        localB = Math.min(1, beauty + near * beauty * 0.7);
      }

      // accumulo per la bussola
      const wgt = localB * localB;
      cxAcc += px * wgt; cyAcc += py * wgt; bAcc += wgt;

      const pulse = reduceMotion ? 1 : (1 + 0.10 * Math.sin(t * mo.pulseSpd + mo.pulse) * (0.4 + localB));
      const size = baseScale * mo.r * (0.7 + 0.5 * localB) * pulse;

      // la forma: stessa identità sempre, ma sboccia se serve il bisogno attivo
      drawForm(mo, px, py, size, localB, dom, t);

      // climax: chi serve il bisogno trovato si fa più caldo e luminoso (solo luce)
      if (climaxLevel > 0.01 && localB > 0.18 && mo.aff[climaxNeed] > 0.45) {
        const cg = climaxLevel * localB;
        drawSprite(needSprites[climaxNeed], px, py, size * (1.4 + cg * 0.6), cg * 0.7);
        drawSprite(coreSprite, px, py, size * 0.5, cg * 0.85);
      }

      if (localB > 0.5 && bright.length < 64) bright.push({ x: px, y: py, dom, b: localB });
    }

    // costellazioni: fili tenui fra luci vicine, si ricompongono a ogni stato
    if (bright.length > 1) {
      const maxD = minSide * 0.16;
      ctx.lineWidth = 0.8;
      for (let i = 0; i < bright.length; i++) {
        for (let j = i + 1; j < bright.length; j++) {
          const A = bright[i], B = bright[j];
          const d = Math.hypot(A.x - B.x, A.y - B.y);
          if (d >= maxD) continue;
          const a = (1 - d / maxD) * 0.20 * Math.min(A.b, B.b);
          if (a < 0.012) continue;
          ctx.globalAlpha = a;
          ctx.strokeStyle = `hsla(${NEEDS[A.dom].hue},80%,72%,1)`;
          ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    // fioriture spontanee (coordinate normalizzate → valide in ogni riquadro)
    if (interactive) {
      for (const bl of blooms) {
        const bx = rx + bl.nx * rw, by = ry + bl.ny * rh;
        const rr = Math.max(2, bl.t * minSide * 0.2);
        drawSprite(needSprites[bl.dom], bx, by, rr, Math.sin(bl.t * Math.PI) * 0.5);
      }
    }

    // increspature dal tocco
    if (interactive) {
      for (const rp of ripples) {
        const rr = rp.t * minSide * 0.5;
        const a = (1 - rp.t) * 0.5;
        if (a <= 0) continue;
        ctx.globalAlpha = a;
        drawSprite(needSprites[rp.dom], rp.x, rp.y, rr, 0.5);
      }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // ---- la bussola del gusto: punta verso la regione più bella ----
    if (bAcc > 0.0001) {
      const tx = cxAcc / bAcc, ty = cyAcc / bAcc;
      const ccx = rx + rw / 2, ccy = ry + rh / 2;
      drawCompass(ccx, ccy, tx, ty, minSide, rect);
    }
  }

  function drawSprite(sprite, x, y, size, alpha) {
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x - size, y - size, size * 2, size * 2);
  }

  // disegna una forma con identità STABILE: uno scheletro a raggi sempre riconoscibile.
  // Da spenta è un grigio chiuso e immobile; quando serve il bisogno attivo si apre,
  // si scalda, si illumina — la "stessa cosa" che diventa bella. b in 0..1.
  function drawForm(mo, px, py, size, b, dom, t) {
    const hue = NEEDS[dom].hue;
    const sides = mo.sides;
    const rot = mo.rot + (reduceMotion ? 0 : t * mo.spin * (0.15 + 0.55 * b));
    const R = size * (0.5 + 1.25 * b);           // chiuso da spento, aperto (sboccia) da bello

    // alone caldo della bellezza — contenuto, così non annega tutto in una nebbia
    if (b > 0.03) drawSprite(needSprites[dom], px, py, size * (0.8 + b * 0.4), b * b * 0.5);

    // raggi dello scheletro (un solo path, efficiente)
    ctx.globalAlpha = 1;
    ctx.lineWidth = 0.7 + b * 1.3;
    ctx.strokeStyle = b > 0.22
      ? `hsla(${hue},92%,72%,${(0.12 + b * 0.5).toFixed(3)})`
      : `rgba(150,160,188,${(0.10 + 0.08 * (1 - b)).toFixed(3)})`;
    ctx.beginPath();
    const sx = new Array(sides), sy = new Array(sides);
    for (let k = 0; k < sides; k++) {
      const a = rot + (k / sides) * Math.PI * 2;
      sx[k] = px + Math.cos(a) * R; sy[k] = py + Math.sin(a) * R;
      ctx.moveTo(px, py); ctx.lineTo(sx[k], sy[k]);
    }
    ctx.stroke();

    // anello che chiude i petali: appare solo quando la forma è sbocciata
    if (b > 0.4) {
      ctx.globalAlpha = (b - 0.4) * 0.6;
      ctx.beginPath();
      ctx.moveTo(sx[0], sy[0]);
      for (let k = 1; k < sides; k++) ctx.lineTo(sx[k], sy[k]);
      ctx.closePath(); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // satelliti: punti che si accendono in punta a ogni raggio
    for (let k = 0; k < sides; k++) {
      if (b > 0.06) drawSprite(needSprites[dom], sx[k], sy[k], size * (0.12 + b * 0.16), b * 0.7);
      else drawSprite(dimSprite, sx[k], sy[k], size * 0.12, 0.14);
    }

    // nucleo: nitido, è il cuore acceso della forma
    if (b > 0.04) drawSprite(coreSprite, px, py, size * (0.16 + b * 0.3), 0.15 + b * 0.8);
    else drawSprite(dimSprite, px, py, size * 0.18, 0.18);
  }

  // bussola: un ago sottile dal centro verso il centroide della bellezza
  const compassState = {};
  function drawCompass(ccx, ccy, tx, ty, minSide, rect) {
    const key = rect.id || 'main';
    const target = Math.atan2(ty - ccy, tx - ccx);
    let st = compassState[key];
    if (!st) st = compassState[key] = { ang: target };
    // riorientamento morbido (gestendo il wrap angolare)
    let d = target - st.ang;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    // nel climax l'ago si blocca: riorientamento più deciso
    st.ang += d * (reduceMotion ? 1 : 0.08 + climaxLevel * 0.5);

    const len = minSide * (0.12 + climaxLevel * 0.05);
    const ex = ccx + Math.cos(st.ang) * len;
    const ey = ccy + Math.sin(st.ang) * len;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // alone del perno
    ctx.globalAlpha = 0.9;
    drawSprite(coreSprite, ccx, ccy, minSide * (0.018 + climaxLevel * 0.02), 0.5 + climaxLevel * 0.4);
    // ago
    ctx.globalAlpha = 0.5 + climaxLevel * 0.45;
    ctx.strokeStyle = 'rgba(244,200,121,0.9)';
    ctx.lineWidth = 1.4 + climaxLevel * 1.2;
    ctx.beginPath();
    ctx.moveTo(ccx, ccy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    // punta
    drawSprite(coreSprite, ex, ey, minSide * (0.012 + climaxLevel * 0.012), 0.9);
    ctx.restore();
  }

  /* ---------- dinamica delle forme (deriva + attrazione del puntatore) ----------- */
  function stepDynamics(dt, t) {
    for (let m = 0; m < motes.length; m++) {
      const mo = motes[m];

      // deriva: corrente condivisa + un soffio proprio, così il moto è coerente ma vario
      let tx = 0, ty = 0;
      if (!reduceMotion) {
        const f = flowField(mo.bx + mo.ox, mo.by + mo.oy, t);
        const swirl = mo.damp * (2.0 + 1.2 * Math.sin(t * mo.dspeed + mo.dphase));
        tx = f.x * swirl;
        ty = f.y * swirl;
      }

      // attrazione verso il puntatore, proporzionale alla bellezza corrente
      if (pointer.vis && !reduceMotion) {
        const px = mo.bx + mo.ox, py = mo.by + mo.oy;
        const ndx = (pointer.x / W) - px;
        const ndy = (pointer.y / H) - py;
        const d = Math.hypot(ndx, ndy) + 1e-4;
        const pull = Math.max(0, 0.34 - d) * mo.bSmooth * 0.5;
        tx += (ndx / d) * pull;
        ty += (ndy / d) * pull;
      }

      // climax: le forme belle convergono dolcemente verso il centro (no in reduced-motion)
      if (climaxLevel > 0.01 && !reduceMotion) {
        tx += (0.5 - (mo.bx + mo.ox)) * climaxLevel * mo.bSmooth * 0.5;
        ty += (0.5 - (mo.by + mo.oy)) * climaxLevel * mo.bSmooth * 0.5;
      }

      mo.vx += (tx - mo.ox) * 0.04;
      mo.vy += (ty - mo.oy) * 0.04;
      mo.vx *= 0.9; mo.vy *= 0.9;
      mo.ox += mo.vx; mo.oy += mo.vy;

      // bellezza smussata per la fisica audio/attrazione (contrasto netto: bello o spento)
      let beauty = 0;
      for (let i = 0; i < N; i++) beauty += mo.aff[i] * weights[i];
      beauty = smoothstep(0.24, 0.62, beauty);
      mo.bSmooth += (beauty - mo.bSmooth) * 0.08;
    }

    // increspature
    for (const rp of ripples) rp.t += dt * 0.9;
    ripples = ripples.filter(r => r.t < 1);

    // fioriture spontanee: ogni tanto una forma con alta bellezza sboccia da sola
    bloomTimer -= dt;
    if (bloomTimer <= 0 && !reduceMotion) {
      bloomTimer = 2.2 + rnd() * 3.8;
      let pick = null;
      for (let tries = 0; tries < 8 && !pick; tries++) {
        const c = motes[Math.floor(rnd() * motes.length)];
        if (c && c.bSmooth > 0.45) pick = c;
      }
      if (pick) {
        let dom = 0, v = -1;
        for (let i = 0; i < N; i++) { const q = pick.aff[i] * weights[i]; if (q > v) { v = q; dom = i; } }
        blooms.push({ nx: pick.bx + pick.ox, ny: pick.by + pick.oy, t: 0, dom });
      }
    }
    for (const b of blooms) b.t += dt * 0.7;
    blooms = blooms.filter(b => b.t < 1);
  }

  /* ---------- loop ---------------------------------------------------------------- */
  let last = 0, tSec = 0, revealMix = 0;
  let revealOn = false;

  /* ---------- climax di allineamento -------------------------------------------------
     Quando lo stato è fortemente allineato a UN solo bisogno (vicino a un vertice,
     poca ambiguità) e lo mantieni per qualche istante, il campo entra in "pienezza":
     le forme belle convergono e si intensificano, la bussola si blocca decisa, la voce
     del bisogno emerge, lo sfondo satura. Raro e meritato: serve attesa + cooldown. */
  let climaxLevel = 0;     // 0..1, intensità eased (anche per reduced-motion)
  let climaxNeed = 0;      // bisogno "trovato"
  let climaxActive = false;
  let alignTimer = 0, climaxTimer = 0, climaxCooldown = 0;

  function updateClimax(dt) {
    const dom = dominantNeed();
    const w0 = weights[dom];
    let w1 = 0;
    for (let i = 0; i < N; i++) if (i !== dom && weights[i] > w1) w1 = weights[i];
    const aligned = w0 > 0.60 && (w0 - w1) > 0.34;   // vicino a un vertice, bassa ambiguità

    if (climaxCooldown > 0) climaxCooldown -= dt;

    if (!climaxActive) {
      if (aligned && climaxCooldown <= 0 && revealMix < 0.5) {
        alignTimer += dt;
        if (alignTimer >= 1.4) { climaxActive = true; climaxNeed = dom; climaxTimer = 0; playClimaxChord(dom); }
      } else {
        alignTimer = Math.max(0, alignTimer - dt * 2);  // l'attesa decade se vacilli
      }
    } else {
      climaxTimer += dt;
      if (!aligned || dom !== climaxNeed || climaxTimer > 5 || revealMix > 0.5) {
        climaxActive = false; climaxCooldown = 9; alignTimer = 0;
      }
    }

    // salita e discesa entrambe morbide: nessuna intensificazione brusca
    const target = climaxActive ? 1 : 0;
    climaxLevel += (target - climaxLevel) * (target > climaxLevel ? 0.022 : 0.016);
    if (climaxLevel < 0.001) climaxLevel = 0;
  }

  /* ---------- sussurro del bisogno: una parola che affiora quando uno stato domina --- */
  const WHISPER_WORDS = ['calore', 'legame', 'riparo', 'oltre'];
  let whisperNeed = -1;
  function updateWhisper() {
    const conc = Math.max(...weights);
    const op = smoothstep(0.34, 0.62, conc);          // affiora quando un bisogno prende il sopravvento
    const dom = dominantNeed();
    if (op > 0.05 && dom !== whisperNeed) {
      whisperNeed = dom;
      whisperEl.textContent = WHISPER_WORDS[dom];
      whisperEl.style.color = `hsl(${NEEDS[dom].hue}, 72%, 82%)`;
      playTone(dom, op);                              // un tono morbido quando entri nel bisogno
    } else if (op <= 0.05) {
      whisperNeed = -1;                                // tornando in equilibrio, riarmati per il prossimo
    }
    whisperEl.style.opacity = (revealMix > 0.5 ? 0 : op * 0.92).toFixed(3);
  }

  // attività dell'utente: se resta inattivo, lo stato deriva da solo (anti-noia + attract mode)
  let lastInteract = 0;            // 0 all'avvio → parte subito in deriva, finché non tocchi
  const IDLE_MS = 5200;
  function markActive() { lastInteract = performance.now(); }

  function frame(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    tSec += dt;

    // deriva in idle: lo stato vaga lento su una traiettoria di Lissajous
    if ((now - lastInteract) > IDLE_MS && !dragging && !reduceMotion && revealMix < 0.5) {
      const a = now * 0.00010;
      const tx = Math.sin(a) * 0.7;
      const ty = Math.sin(a * 1.37 + 1.1) * 0.7;
      applyPuck(puck.x + (tx - puck.x) * 0.012, puck.y + (ty - puck.y) * 0.012);
    }

    updateClimax(dt);
    updateWhisper();

    // sfondo: notte con un lieve respiro al centro
    paintBackground();

    if (!reduceMotion) stepDynamics(dt, tSec);
    else stepDynamics(0, tSec);

    revealMix += ((revealOn ? 1 : 0) - revealMix) * 0.08;

    if (revealMix < 0.001) {
      // vista singola, interattiva
      renderField({ x: 0, y: 0, w: W, h: H, id: 'main' }, weights, tSec, true);
    } else {
      // transizione/vista doppia: due osservatori, due stati, lo stesso campo
      renderSingleFade(1 - revealMix);
      renderSplit(revealMix);
    }

    drawCursor();
    requestAnimationFrame(frame);
  }

  // due stati contrastanti per la rivelazione (bisogni opposti sul quadrante)
  const STATE_A = (() => { const w = new Array(N).fill(0.06); w[0] = 0.82; return normalize(w); })();
  const STATE_B = (() => { const w = new Array(N).fill(0.06); w[3] = 0.82; return normalize(w); })();
  function normalize(w) { const s = w.reduce((a, b) => a + b, 0); return w.map(v => v / s); }

  function renderSingleFade(alpha) {
    if (alpha <= 0.001) return;
    ctx.save(); ctx.globalAlpha = alpha;
    renderField({ x: 0, y: 0, w: W, h: H, id: 'main' }, weights, tSec, true);
    ctx.restore();
  }
  function renderSplit(alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const gap = 1;
    const half = (W - gap) / 2;
    renderField({ x: 0, y: 0, w: half, h: H, id: 'A' }, STATE_A, tSec, false);
    renderField({ x: half + gap, y: 0, w: half, h: H, id: 'B' }, STATE_B, tSec, false);
    // linea di mezzeria
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = 'rgba(244,200,121,0.4)';
    ctx.fillRect(W / 2 - 0.5, H * 0.12, 1, H * 0.76);
    ctx.restore();
  }

  let bgHue = 225, bgSat = 16;
  function paintBackground() {
    // la notte si tinge appena della tinta del bisogno prevalente
    const dom = dominantNeed();
    const conc = Math.max(...weights);            // 0.25 (equilibrio) .. 1 (deciso)
    let dh = NEEDS[dom].hue - bgHue;
    while (dh > 180) dh -= 360; while (dh < -180) dh += 360;
    bgHue = (bgHue + dh * 0.04 + 360) % 360;
    // la notte si tinge appena; nel climax un filo di più (mai un lavaggio pieno)
    const targetSat = 10 + (conc - 0.25) * 30 + climaxLevel * 26;
    bgSat += (targetSat - bgSat) * 0.04;
    const h = bgHue | 0, s = Math.min(70, bgSat) | 0;

    const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, Math.max(W, H) * 0.75);
    g.addColorStop(0, `hsl(${h},${s}%,7%)`);
    g.addColorStop(0.5, `hsl(${h},${Math.round(s * 0.5)}%,4.5%)`);
    g.addColorStop(1, '#05050a');
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    drawGrain();
  }

  // grana fotografica leggera, pre-renderizzata una volta
  let grainTile = null;
  function buildGrain() {
    const s = 140;
    const c = document.createElement('canvas'); c.width = c.height = s;
    const g = c.getContext('2d');
    const img = g.createImageData(s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 120 + Math.floor(rnd() * 135);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 12;
    }
    g.putImageData(img, 0, 0);
    grainTile = c;
  }
  function drawGrain() {
    if (!grainTile) return;
    const pat = ctx.createPattern(grainTile, 'repeat');
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------- cursore disegnato (firma visiva su desktop) ------------------------ */
  function drawCursor() {
    if (!pointer.vis || revealMix > 0.5) return;
    if (window.matchMedia('(hover: none)').matches) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawSprite(coreSprite, pointer.x, pointer.y, 26, 0.5);
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = 'rgba(244,200,121,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /* ============================================================================
     FIRMA SENSORIALE — il campo non ronza: SUONA quando qualcosa diventa bello.
     Silenzio a riposo. Ogni volta che una forma sboccia (perché il tuo bisogno è
     cambiato), una breve campana, intonata al bisogno servito. Nessun drone, nessun
     loop: il suono è l'eco della bellezza che appare. Tutto sintetizzato a runtime.
     ========================================================================== */
  const audio = { ctx: null, on: false, master: null, lastBell: 0 };
  // una radice consonante per bisogno + una pentatonica maggiore
  const NEED_ROOT = [220.0, 261.63, 174.61, 329.63];   // A3, C4, F3, E4

  function initAudio() {
    if (audio.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    audio.ctx = ac;

    const master = ac.createGain();
    master.gain.value = 0.0;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.5;
    // un eco lieve per dare spazio alle campane
    const delay = ac.createDelay(); delay.delayTime.value = 0.34;
    const fb = ac.createGain(); fb.gain.value = 0.30;
    const wet = ac.createGain(); wet.gain.value = 0.30;
    master.connect(lp); lp.connect(ac.destination);
    lp.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(ac.destination);
    audio.master = master;
  }

  // una voce morbida, auto-inviluppata: triangle filtrato, attacco dolce, lunga coda.
  // Si crea, suona e si autodistrugge — niente oscillatori sempre attivi (niente drone).
  function voice(freq, peak, when, dur) {
    const ac = audio.ctx;
    const osc = ac.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.2;
    const g = ac.createGain();
    osc.connect(lp); lp.connect(g); g.connect(audio.master);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + 0.07);          // attacco morbido (no click)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.start(when); osc.stop(when + dur + 0.05);
  }

  // un tono caldo per il bisogno: fondamentale + quinta. Raro e consonante.
  function playTone(need, vel) {
    if (!audio.on || !audio.ctx) return;
    const now = audio.ctx.currentTime;
    if (now - audio.lastBell < 0.3) return;                     // mai affollato → fluido
    audio.lastBell = now;
    const root = NEED_ROOT[need];
    const v = 0.08 + (vel || 0) * 0.06;
    voice(root, v, now, 2.8);
    voice(root * 1.5, v * 0.5, now + 0.05, 2.4);                // la quinta, più tenue
  }

  // al climax una breve fioritura armonica (fondamentale, quinta, ottava), morbida
  function playClimaxChord(need) {
    if (!audio.on || !audio.ctx) return;
    const now = audio.ctx.currentTime;
    const root = NEED_ROOT[need];
    voice(root, 0.10, now, 3.4);
    voice(root * 1.5, 0.06, now + 0.18, 3.0);
    voice(root * 2, 0.05, now + 0.40, 2.6);
  }

  function toggleSound() {
    initAudio();
    if (!audio.ctx) return;
    audio.on = !audio.on;
    const now = audio.ctx.currentTime;
    if (audio.on) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      audio.master.gain.setTargetAtTime(0.8, now, 0.1);
      playTone(dominantNeed(), 0.6);             // un tocco di conferma all'accensione
    } else {
      audio.master.gain.setTargetAtTime(0, now, 0.2);
    }
    soundBtn.setAttribute('aria-pressed', String(audio.on));
    soundBtn.setAttribute('aria-label', audio.on ? 'Disattiva il suono' : 'Attiva il suono');
  }

  /* ---------- interazione: puntatore sul campo ----------------------------------- */
  function dominantNeed() {
    let dom = 0, v = -1;
    for (let i = 0; i < N; i++) if (weights[i] > v) { v = weights[i]; dom = i; }
    return dom;
  }
  function onPointerMove(e) {
    pointer.x = e.clientX; pointer.y = e.clientY;
    pointer.vis = true;
    markActive();
    dismissOnboard();
  }
  function onPointerDown(e) {
    if (e.target.closest('.ui button') || e.target.closest('.dial')) return;
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.vis = true; pointer.active = true;
    ripples.push({ x: e.clientX, y: e.clientY, t: 0, dom: dominantNeed() });
    markActive();
    dismissOnboard();
  }
  function onPointerUp() { pointer.active = false; }
  function onPointerLeave() { pointer.vis = false; }

  canvas.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  canvas.addEventListener('pointerleave', onPointerLeave, { passive: true });

  /* ---------- interazione: il quadrante (puck) ----------------------------------- */
  const dial = document.getElementById('dial');
  const puckEl = document.getElementById('puck');
  const tetherEl = document.getElementById('tether');
  const anchorsG = document.getElementById('anchors');

  // disegna gli ancoraggi colorati sul quadrante
  (function drawAnchors() {
    const C = 100, R = 86;
    for (let i = 0; i < N; i++) {
      const ax = C + Math.cos(ANCHOR_ANGLE[i]) * R;
      const ay = C + Math.sin(ANCHOR_ANGLE[i]) * R;
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('class', 'anchor');
      c.setAttribute('cx', ax); c.setAttribute('cy', ay); c.setAttribute('r', 5);
      c.setAttribute('fill', `hsl(${NEEDS[i].hue}, 80%, 62%)`);
      c.setAttribute('opacity', '0.85');
      anchorsG.appendChild(c);
    }
  })();

  function setPuckFromClient(clientX, clientY) {
    const rect = dial.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((clientY - rect.top) / rect.height) * 2 - 1;
    setPuck(nx, ny);
  }
  // applica una posizione del puck senza congedare l'hint (usata anche dalla deriva in idle)
  function applyPuck(nx, ny) {
    const len = Math.hypot(nx, ny);
    const max = 0.96;
    if (len > max) { nx = nx / len * max; ny = ny / len * max; }
    puck.x = nx; puck.y = ny;
    computeWeights();
    // posizione su viewBox (centro 100, raggio 86)
    const vx = 100 + nx * 86, vy = 100 + ny * 86;
    puckEl.setAttribute('cx', vx); puckEl.setAttribute('cy', vy);
    tetherEl.setAttribute('x2', vx); tetherEl.setAttribute('y2', vy);
    puckEl.setAttribute('fill', `hsl(${NEEDS[dominantNeed()].hue}, 70%, 70%)`);
    // testo accessibile
    const labels = ['calore', 'legame', 'riparo', 'oltre'];
    dial.setAttribute('aria-valuetext',
      Math.max(...weights) < 0.34 ? 'stato in equilibrio'
      : `bisogno prevalente: ${labels[dominantNeed()]}`);
  }
  function setPuck(nx, ny) { applyPuck(nx, ny); dismissOnboard(); }

  let dragging = false;
  dial.addEventListener('pointerdown', (e) => {
    dragging = true; dial.setPointerCapture(e.pointerId);
    markActive(); setPuckFromClient(e.clientX, e.clientY); e.preventDefault();
  });
  dial.addEventListener('pointermove', (e) => { if (dragging) { markActive(); setPuckFromClient(e.clientX, e.clientY); } });
  dial.addEventListener('pointerup', () => { dragging = false; });
  dial.addEventListener('pointercancel', () => { dragging = false; });

  // tastiera: frecce muovono lo stato
  dial.addEventListener('keydown', (e) => {
    const step = 0.16;
    let used = true;
    markActive();
    switch (e.key) {
      case 'ArrowUp': setPuck(puck.x, puck.y - step); break;
      case 'ArrowDown': setPuck(puck.x, puck.y + step); break;
      case 'ArrowLeft': setPuck(puck.x - step, puck.y); break;
      case 'ArrowRight': setPuck(puck.x + step, puck.y); break;
      case 'Enter': case ' ': toggleReveal(); break;
      case 'Home': setPuck(0, 0); break;
      default: used = false;
    }
    if (used) e.preventDefault();
  });

  /* ---------- controlli ----------------------------------------------------------- */
  const soundBtn = document.getElementById('soundBtn');
  const revealBtn = document.getElementById('revealBtn');
  const seedBtn = document.getElementById('seedBtn');
  const coda = document.getElementById('coda');
  const intro = document.getElementById('intro');
  const whisperEl = document.getElementById('whisper');
  const brandEl = document.querySelector('.brand');

  let onboardGone = false;
  function dismissOnboard() {
    if (onboardGone) return;
    onboardGone = true;
    intro.classList.add('gone');
    if (brandEl) brandEl.classList.add('gone');   // via il titolo fisso: parla l'esperienza
  }

  function toggleReveal() {
    revealOn = !revealOn;
    revealBtn.setAttribute('aria-pressed', String(revealOn));
    if (revealOn) {
      coda.hidden = false;
      requestAnimationFrame(() => coda.classList.add('show'));
    } else {
      coda.classList.remove('show');
      setTimeout(() => { if (!revealOn) coda.hidden = true; }, 1400);
    }
  }

  soundBtn.addEventListener('click', toggleSound);
  revealBtn.addEventListener('click', toggleReveal);
  seedBtn.addEventListener('click', () => {
    setSeed(Math.floor((performance.now() * 1000) % 1e9) ^ (motes.length * 2654435761));
    buildField(); buildGrain();
  });

  /* ---------- avvio --------------------------------------------------------------- */
  setSeed(
    (location.hash && location.hash.length > 1)
      ? location.hash.slice(1)
      : String(Math.floor(performance.now()) ^ 0x9e3779b9)
  );
  resize();
  buildSprites();
  buildGrain();
  buildField();
  applyPuck(0, 0);

  let resizeRaf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => { resize(); buildField(); });
  });

  requestAnimationFrame(frame);

  /* ---------- PWA: service worker + installazione -------------------------------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW:', err));
    });
  }
  let deferredPrompt = null;
  const installBtn = document.getElementById('installBtn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e; installBtn.hidden = false;
  });
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt(); await deferredPrompt.userChoice;
    deferredPrompt = null; installBtn.hidden = true;
  });
  window.addEventListener('appinstalled', () => { installBtn.hidden = true; });
})();
