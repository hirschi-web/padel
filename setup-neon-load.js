(() => {
  'use strict';

  async function loadTournamentListFromNeon() {
    const sel = document.getElementById('tournamentSelect');
    if (!sel) return;
    try {
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
      console.info(`[Neon] ${window.tournamentsList.length} Turniere geladen.`);
    } catch (e) {
      console.error('[Neon] Turnierliste konnte nicht geladen werden.', e);
      if (!document.getElementById('neonLoadError')) {
        const p = document.createElement('p');
        p.id = 'neonLoadError';
        p.style.cssText = 'margin:8px 0;color:#dc2626;font-size:11px;font-weight:700;';
        p.textContent = 'Turnierliste konnte nicht aus Neon geladen werden.';
        sel.parentElement?.appendChild(p);
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(loadTournamentListFromNeon, 0), { once: true });
  else setTimeout(loadTournamentListFromNeon, 0);
})();