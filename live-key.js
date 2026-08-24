(() => {
  'use strict';
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const liveKey = (hashParams.get('key') || '').trim();
  const originalLoadTournament = window.loadTournament;

  function applyLiveScores(liveData) {
    const scores = liveData && typeof liveData === 'object' ? liveData.roundrobin_scores : null;
    if (!scores || typeof tournamentData === 'undefined' || !tournamentData?.s_new) return;
    for (const [k, score] of Object.entries(scores)) {
      const [r, m] = k.split('-').map(Number);
      if (!Number.isInteger(r) || !Number.isInteger(m)) continue;
      const match = tournamentData.s_new?.[r]?.matches?.[m];
      if (!match || !Array.isArray(score) || score.length < 2) continue;
      match.score = [String(score[0] ?? ''), String(score[1] ?? '')];
    }
  }

  async function refreshLiveScores() {
    const { data, error } = await supabaseClient.from('tournaments').select('live_data').eq('id', tournamentId);
    if (error) throw error;
    applyLiveScores(data?.[0]?.live_data || {});
  }

  window.loadTournament = async function () {
    await originalLoadTournament();
    if (typeof tournamentData === 'undefined' || !tournamentData) return;
    try {
      await refreshLiveScores();
      if (typeof renderAll === 'function') renderAll();
    } catch (e) {
      console.warn('[Neon Live] live_data konnte nicht geladen werden', e);
    }
    const btn = document.getElementById('editToggle');
    if (!btn) return;
    isEditing = false;
    if (liveKey) {
      btn.disabled = false;
      btn.innerText = '🔒 Bearbeiten';
      btn.title = 'Bearbeiten mit Turnier-Key';
    } else {
      btn.disabled = true;
      btn.innerText = '👁 Nur ansehen';
      btn.title = 'Dieser Link ist nur zum Ansehen';
    }
  };

  window.toggleEdit = function () {
    if (!liveKey) {
      isEditing = false;
      showToast('👁 Dieser Link ist nur zum Ansehen', 'info');
      return;
    }
    isEditing = !isEditing;
    const btn = document.getElementById('editToggle');
    if (btn) btn.innerText = isEditing ? '✏️ Bearbeiten' : '🔒 Bearbeiten';
    renderAll();
  };

  async function saveScore(item) {
    const c = await window.phNeon.getClient();
    const r = await c.rpc('save_tournament_live_score', {
      input_tournament_id: tournamentId,
      input_live_key: liveKey,
      input_round_index: item.rIdx,
      input_match_index: item.mIdx,
      input_score1: item.s0,
      input_score2: item.s1
    });
    if (r?.error) throw new Error(r.error.message || 'Live-Score konnte nicht gespeichert werden.');
    if (r?.data == null) throw new Error('Live-Key ungültig oder Match nicht zulässig.');
    return r.data;
  }

  window.saveAllDirty = async function () {
    if (dirtyMatches.size === 0) return;
    if (!liveKey) { showToast('🔒 Kein Bearbeiten-Key vorhanden', 'error'); return; }
    isSaving = true;
    const jobs = [];
    for (const key of Array.from(dirtyMatches)) {
      const [rIdx, mIdx] = key.split('-').map(Number);
      const v0 = document.getElementById(`s-${rIdx}-${mIdx}-0`).value.trim();
      const v1 = document.getElementById(`s-${rIdx}-${mIdx}-1`).value.trim();
      let s0 = null, s1 = null;
      if (!v0 && !v1) {
        tournamentData.s_new[rIdx].matches[mIdx].score = ['', ''];
      } else {
        s0 = parseInt(v0) || 0; s1 = parseInt(v1) || 0;
        tournamentData.s_new[rIdx].matches[mIdx].score = [String(s0), String(s1)];
      }
      jobs.push({ rIdx, mIdx, s0, s1 });
    }
    localStorage.setItem('backup_' + tournamentId, JSON.stringify({ data: tournamentData, timestamp: Date.now() }));
    try {
      for (const job of jobs) await saveScore(job);
      dirtyMatches.clear();
      updateFloatingButton();
      renderAll();
      showToast('💾 Alle Ergebnisse gespeichert', 'success');
    } catch (e) {
      const invalid = (e.message || '').includes('ungültig');
      if (!invalid) {
        for (const job of jobs) pendingSaves.push({ ...job, retries: 0 });
        startRetryQueue();
      }
      showToast(invalid ? '❌ Ungültiger Bearbeiten-Key' : '⚠️ Offline - wird synchronisiert', invalid ? 'error' : 'warning');
    } finally { isSaving = false; }
  };

  window.startRetryQueue = function () {
    if (retryInterval || !liveKey) return;
    retryInterval = setInterval(async () => {
      if (pendingSaves.length === 0) { clearInterval(retryInterval); retryInterval = null; return; }
      const save = pendingSaves[0];
      try {
        await saveScore(save);
        pendingSaves.shift();
        showToast('✅ Synchronisiert', 'success');
      } catch (e) {
        save.retries++;
        if ((e.message || '').includes('ungültig')) {
          pendingSaves.shift();
          showToast('❌ Ungültiger Bearbeiten-Key', 'error');
        } else if (save.retries > 5) {
          pendingSaves.shift();
          showToast('❌ Sync fehlgeschlagen - Backup gespeichert', 'error');
        }
      }
    }, 10000);
  };

  window.setupRealtime = function () {
    realtimeConnected = false;
    startPolling();
  };

  window.initKnockout = function (record) {
    const suffix = liveKey ? '#key=' + encodeURIComponent(liveKey) : '';
    window.location.href = `liveturnier.html?id=${encodeURIComponent(record.id)}${suffix}`;
  };

  if (typeof window.__padelLegacyInit === 'function') window.__padelLegacyInit();
})();