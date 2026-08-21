// Neon preview bootstrap. No document.write and no Supabase network client.
// The inline init() in setup.html may run before the real setup logic is loaded,
// so keep it harmless until Neon + the unchanged tournament logic are ready.
window.init = function () {};

(function bootstrapNeonSetup() {
  const neon = document.createElement('script');
  neon.src = '/padel/neon-preview/padel-api.js?v=20260821-4';
  neon.async = false;
  neon.onload = function () {
    const app = document.createElement('script');
    app.src = '/padel/setup-functions.js?v=20260821-4';
    app.async = false;
    app.onload = function () {
      if (typeof window.init === 'function') {
        Promise.resolve(window.init()).catch(err => {
          console.error('[Neon setup] init failed', err);
          const sel = document.getElementById('tournamentSelect');
          if (sel && !document.getElementById('neonLoadError')) {
            const p = document.createElement('p');
            p.id = 'neonLoadError';
            p.style.cssText = 'margin:8px 0;color:#dc2626;font-size:11px;font-weight:700';
            p.textContent = 'Neon-Fehler: ' + (err?.message || String(err));
            sel.parentElement?.appendChild(p);
          }
        });
      }
    };
    app.onerror = () => console.error('[Neon setup] setup-functions.js konnte nicht geladen werden');
    document.head.appendChild(app);
  };
  neon.onerror = () => console.error('[Neon setup] padel-api.js konnte nicht geladen werden');
  document.head.appendChild(neon);
})();