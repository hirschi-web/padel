(() => {
  'use strict';

  async function loadTournamentListFromNeon() {
    const sel = document.getElementById('tournamentSelect');
    if (!sel) return;
    try {
      if (!window.phNeon?.getClient) throw new Error('padel-api.js nicht initialisiert');
      const client = await window.phNeon.getClient();
      const { data: rows, error } = await client.from('tournaments').select('id,data').order('id', { ascending: true });
      if (error) throw error;
      window.tournamentsList = Array.isArray(rows) ? rows : [];
      try { tournamentsList = window.tournamentsList; } catch (_) {}
      while (sel.options.length > 1) sel.remove(1);
      window.tournamentsList.filter(t => t && t.id && t.id !== 'LIVE_CONFIG').forEach(t => sel.add(new Option(t.id, t.id)));
      const raw = window.location.search.substring(1);
      if (raw && window.tournamentsList.some(t => t.id === raw)) {
        sel.value = raw;
        if (typeof window.loadTournament === 'function') await window.loadTournament(raw);
      }
      const old = document.getElementById('neonLoadError'); if (old) old.remove();
      console.info(`[Neon] ${window.tournamentsList.length} Turniere geladen.`);
    } catch (e) {
      console.error('[Neon] Turnierliste konnte nicht geladen werden.', e);
      let p = document.getElementById('neonLoadError');
      if (!p) {
        p = document.createElement('p'); p.id='neonLoadError';
        p.style.cssText='margin:8px 0;color:#dc2626;font-size:11px;font-weight:700;white-space:pre-wrap;';
        sel.parentElement?.appendChild(p);
      }
      const msg = e?.message || e?.error_description || String(e);
      p.textContent = 'Neon-Fehler: ' + msg;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(loadTournamentListFromNeon, 100), { once: true });
  else setTimeout(loadTournamentListFromNeon, 100);
})();