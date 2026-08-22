// Neon preview diagnostics + compatibility bootstrap.
// This file intentionally logs every startup step visibly on the page.
window.init = function () {};

(function () {
  'use strict';
  const entries = [];
  let box;
  function ensureBox() {
    if (box) return box;
    box = document.createElement('div');
    box.id = 'neonDebugLog';
    box.style.cssText = 'margin:24px auto 0;max-width:900px;background:#0f172a;color:#e2e8f0;border-radius:12px;padding:14px;font:12px/1.5 monospace;white-space:pre-wrap;overflow:auto';
    box.innerHTML = '<b style="color:#fff">Neon Debug Log</b>\n';
    (document.body || document.documentElement).appendChild(box);
    return box;
  }
  function log(step, detail) {
    const msg = `[${new Date().toLocaleTimeString()}] ${step}${detail !== undefined ? ': ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`;
    entries.push(msg); console.log('[Neon debug]', step, detail ?? '');
    if (document.body) ensureBox().append(document.createTextNode(msg + '\n'));
  }
  function fail(step, err) {
    const msg = err?.message || String(err);
    log('ERROR ' + step, msg); console.error('[Neon debug]', step, err);
  }
  window.neonDebugLog = entries;
  window.addEventListener('error', e => fail('window.error', e.error || e.message));
  window.addEventListener('unhandledrejection', e => fail('unhandledrejection', e.reason));

  async function boot() {
    log('1 bootstrap started', location.href);
    log('2 loading padel-api.js');
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = '/padel/neon-preview/padel-api.js?v=20260822-admin2';
      s.onload = resolve; s.onerror = () => reject(new Error('padel-api.js konnte nicht geladen werden'));
      document.head.appendChild(s);
    });
    log('3 padel-api loaded', { phNeon: !!window.phNeon, supabaseCompat: !!window.supabase });

    if (!window.phNeon?.getClient) throw new Error('phNeon.getClient fehlt');
    log('4 creating Neon client');
    const client = await window.phNeon.getClient();
    log('5 Neon client created');

    if (window.phNeon.sessionStatus) {
      try { log('5a auth status', await window.phNeon.sessionStatus()); }
      catch (e) { log('5a auth status unavailable', e?.message || String(e)); }
    }

    log('6 SELECT tournaments');
    const direct = await client.from('tournaments').select('id,data').order('id', { ascending: true });
    if (direct?.error) throw new Error('Neon SELECT: ' + (direct.error.message || JSON.stringify(direct.error)));
    log('7 SELECT successful', { rows: direct?.data?.length || 0, ids: (direct?.data || []).map(x => x.id) });

    const sel = document.getElementById('tournamentSelect');
    if (!sel) throw new Error('tournamentSelect nicht im DOM gefunden');
    while (sel.options.length > 1) sel.remove(1);
    (direct.data || []).filter(t => t.id !== 'LIVE_CONFIG').forEach(t => sel.add(new Option(t.id, t.id)));
    log('8 dropdown populated', { options: sel.options.length });

    log('9 loading existing setup application logic');
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = '/padel/setup-functions.js?v=20260822-admin2';
      s.onload = resolve; s.onerror = () => reject(new Error('setup-functions.js konnte nicht geladen werden'));
      document.head.appendChild(s);
    });
    log('10 setup-functions loaded');
    log('11 running application init');
    await window.init();
    log('12 application init completed');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { ensureBox(); boot().catch(e => fail('BOOT', e)); }, { once: true });
  } else {
    ensureBox(); boot().catch(e => fail('BOOT', e));
  }
})();