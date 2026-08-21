(() => {
  'use strict';

  const DATA_API_URL = 'https://ep-rough-fog-awwpb54i.apirest.c-12.us-east-1.aws.neon.tech/neondb/rest/v1';

  async function loadTournamentListFromNeon() {
    const sel = document.getElementById('tournamentSelect');
    if (!sel) return;

    try {
      const res = await fetch(`${DATA_API_URL}/tournaments?select=id,data&order=id.asc`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'omit',
        cache: 'no-store'
      });
      if (!res.ok) throw new Error(`Neon Data API ${res.status}`);

      const rows = await res.json();
      window.tournamentsList = Array.isArray(rows) ? rows : [];
      try { tournamentsList = window.tournamentsList; } catch (_) {}

      while (sel.options.length > 1) sel.remove(1);
      window.tournamentsList
        .filter(t => t && t.id && t.id !== 'LIVE_CONFIG')
        .forEach(t => sel.add(new Option(t.id, t.id)));

      const raw = window.location.search.substring(1);
      if (raw && window.tournamentsList.some(t => t.id === raw)) {
        sel.value = raw;
        if (typeof window.loadTournament === 'function') await window.loadTournament(raw);
      }

      console.info(`[Neon] ${window.tournamentsList.length} Turniere geladen.`);
    } catch (e) {
      console.error('[Neon] Turnierliste konnte nicht geladen werden.', e);
      const old = document.getElementById('neonLoadError');
      if (!old) {
        const p = document.createElement('p');
        p.id = 'neonLoadError';
        p.style.cssText = 'margin:8px 0;color:#dc2626;font-size:11px;font-weight:700;';
        p.textContent = 'Turnierliste konnte nicht aus Neon geladen werden.';
        sel.parentElement?.appendChild(p);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(loadTournamentListFromNeon, 0), { once: true });
  } else {
    setTimeout(loadTournamentListFromNeon, 0);
  }
})();