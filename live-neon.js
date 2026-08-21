// Neon-specific live page bridge.
// Public viewing reads directly from the Neon Data API; editing remains admin-only.
(() => {
  'use strict';
  const DATA_API_URL = 'https://ep-rough-fog-awwpb54i.apirest.c-12.us-east-1.aws.neon.tech/neondb/rest/v1';

  // Replace the legacy Supabase read path before legacy init() runs.
  loadTournament = async function loadTournamentFromNeon() {
    try {
      const encodedId = encodeURIComponent(tournamentId);
      const res = await fetch(`${DATA_API_URL}/tournaments?select=*&id=eq.${encodedId}&limit=1`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'omit',
        cache: 'no-store'
      });
      if (!res.ok) throw new Error(`Neon Data API ${res.status}`);
      const rows = await res.json();
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) {
        showToast('Turnier nicht gefunden', 'error');
        document.getElementById('tournamentTitle').innerText = 'Turnier nicht gefunden';
        return;
      }

      if (row.expiry_date && new Date(row.expiry_date) < new Date()) {
        document.getElementById('matchesArea').innerHTML = '<div style="text-align:center;padding:60px 20px"><div style="font-size:48px;margin-bottom:16px">⏰</div><div style="font-size:18px;font-weight:700;margin-bottom:8px">Turnier abgelaufen</div><div style="color:var(--text-muted)">Dieses Turnier ist nicht mehr verfügbar</div></div>';
        return;
      }

      const tournamentType = row.tournament_type || row.data?.tournamentType || row.data?.tournament_type || 'roundrobin';
      if (tournamentType === 'knockout' || tournamentType === 'ko') {
        initKnockout(row);
        return;
      }

      tournamentData = row.data;
      document.getElementById('tournamentTitle').innerText = String(row.id).toUpperCase();
      document.getElementById('offlineWarning').style.display = 'none';
      isEditing = false;
      document.getElementById('editToggle').innerText = '🔒 Bearbeiten';
      renderAll();
      try { localStorage.setItem('backup_' + tournamentId, JSON.stringify({ data: tournamentData, savedAt: Date.now() })); } catch (_) {}
      console.info(`[Neon] Live-Turnier ${row.id} geladen.`);
    } catch (e) {
      console.error('[Neon] Live-Turnier konnte nicht geladen werden.', e);
      const backup = localStorage.getItem('backup_' + tournamentId);
      if (backup) {
        const cached = JSON.parse(backup);
        tournamentData = cached.data;
        document.getElementById('tournamentTitle').innerText = 'OFFLINE';
        document.getElementById('offlineWarning').style.display = 'block';
        renderAll();
      } else {
        document.getElementById('tournamentTitle').innerText = 'Fehler beim Laden';
        showToast('❌ Neon-Verbindung fehlgeschlagen', 'error');
      }
    }
  };

  window.toggleEdit = async function toggleEditNeon() {
    if (!isEditing) {
      try {
        await window.phNeon.ensureAdmin();
        isEditing = true;
        sessionStorage.removeItem('isAdmin_' + tournamentId);
        document.getElementById('editToggle').innerText = '✏️ Bearbeiten';
        renderAll();
      } catch (e) {
        showToast('🔒 Bearbeiten nur für Admins', 'warning');
      }
    } else {
      isEditing = false;
      document.getElementById('editToggle').innerText = '🔒 Bearbeiten';
      renderAll();
    }
  };

  if (typeof window.__legacyLiveInit === 'function') window.__legacyLiveInit();
})();