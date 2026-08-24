window.init = function () {};
(async function () {
  'use strict';
  async function load(src) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(src + ' konnte nicht geladen werden'));
      document.head.appendChild(s);
    });
  }
  async function boot() {
    await load('/padel/padel-api-prod.js?v=20260824-1');
    const client = await window.phNeon.getClient();
    const direct = await client.from('tournaments').select('id,data').order('id', { ascending: true });
    if (direct?.error) throw new Error(direct.error.message || 'Turniere konnten nicht geladen werden');
    const sel = document.getElementById('tournamentSelect');
    if (!sel) throw new Error('tournamentSelect fehlt');
    while (sel.options.length > 1) sel.remove(1);
    (direct.data || []).filter(t => t.id !== 'LIVE_CONFIG').forEach(t => sel.add(new Option(t.id, t.id)));
    await load('/padel/setup-functions.js?v=20260824-1');
    await window.init();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot().catch(console.error), { once: true });
  else boot().catch(console.error);
})();