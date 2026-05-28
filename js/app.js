// La Regola del Gusto — interazioni leggere

// 1) Rivelazione degli elementi allo scroll
const reveals = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.18 });
reveals.forEach((el) => io.observe(el));

// Mostra subito gli elementi già visibili al caricamento (hero)
window.addEventListener('load', () => {
  document.querySelectorAll('.hero .reveal').forEach((el) => el.classList.add('in'));
});

// 2) Barra di avanzamento lettura
const bar = document.getElementById('progressBar');
const onScroll = () => {
  const h = document.documentElement;
  const scrolled = h.scrollTop / (h.scrollHeight - h.clientHeight || 1);
  bar.style.width = Math.min(100, Math.max(0, scrolled * 100)) + '%';
};
document.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// 3) Toggle tema chiaro/scuro (rispetta prefers-color-scheme, ricorda in localStorage)
(function () {
  const root = document.documentElement;
  const btn = document.getElementById('themeToggle');
  if (!btn) return;

  const mql = window.matchMedia('(prefers-color-scheme: light)');
  const meta = {
    dark: '#0f0d0a',
    light: '#f7f2e8'
  };

  // Tema effettivo: scelta esplicita salvata, altrimenti preferenza di sistema
  const effective = () => root.getAttribute('data-theme') || (mql.matches ? 'light' : 'dark');

  const sync = () => {
    const theme = effective();
    const isLight = theme === 'light';
    btn.setAttribute('aria-pressed', String(isLight));
    btn.setAttribute('aria-label', isLight ? 'Attiva il tema scuro' : 'Attiva il tema chiaro');
    btn.setAttribute('title', isLight ? 'Tema scuro' : 'Tema chiaro');
  };

  btn.addEventListener('click', () => {
    const next = effective() === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    sync();
  });

  // Se l'utente non ha scelto manualmente, segui i cambi di sistema
  mql.addEventListener('change', () => {
    if (!root.hasAttribute('data-theme')) sync();
  });

  sync();
})();

// 4) Service worker (PWA offline)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('SW non registrato:', err);
    });
  });
}

// 5) Prompt di installazione PWA
let deferredPrompt = null;
const installNote = document.getElementById('installNote');
const installBtn = document.getElementById('installBtn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installNote) installNote.hidden = false;
});

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installNote.hidden = true;
  });
}

window.addEventListener('appinstalled', () => {
  if (installNote) installNote.hidden = true;
});
