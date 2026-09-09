(() => {
  'use strict';
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const liveKey = (hashParams.get('key') || '').trim();
  const originalLoadTournament = window.loadTournament;
  const originalSafeRefresh = window.safeRefresh;

  function applyLiveScores(liveData, preserveDirty = true) {
    const scores = liveData && typeof liveData === 'object' ? liveData.roundrobin_scores : null;
    if (!scores || typeof tournamentData === 'undefined' || !tournamentData?.s_new) return;
    for (const [k, score] of Object.entries(scores)) {
      if (preserveDirty && typeof dirtyMatches !== 'undefined' && dirtyMatches?.has(k)) continue;
      const [r, m] = k.split('-').map(Number);
      if (!Number.isInteger(r) || !Number.isInteger(m)) continue;
      const match = tournamentData.s_new?.[r]?.matches?.[m];
      if (!match || !Array.isArray(score) || score.length < 2) continue;
      match.score = [String(score[0] ?? ''), String(score[1] ?? '')];
    }
  }

  window.__padelApplyLiveScores = applyLiveScores;

  function editStateKey() {
    return 'liveEditEnabled_' + (typeof tournamentId !== 'undefined' && tournamentId ? tournamentId : 'unknown');
  }

  function jobKey(job) {
    return `${job.rIdx}-${job.mIdx}`;
  }

  function readJob(rIdx, mIdx) {
    const el0 = document.getElementById(`s-${rIdx}-${mIdx}-0`);
    const el1 = document.getElementById(`s-${rIdx}-${mIdx}-1`);
    if (!el0 || !el1) return null;
    const v0 = el0.value.trim();
    const v1 = el1.value.trim();
    let s0 = null, s1 = null;
    if (v0 || v1) {
      s0 = parseInt(v0, 10) || 0;
      s1 = parseInt(v1, 10) || 0;
    }
    return { rIdx, mIdx, s0, s1 };
  }

  function sameScore(a, b) {
    return !!a && !!b && a.rIdx === b.rIdx && a.mIdx === b.mIdx && a.s0 === b.s0 && a.s1 === b.s1;
  }

  function isJobCurrent(job) {
    const key = jobKey(job);
    if (!dirtyMatches.has(key)) return false;
    return sameScore(job, readJob(job.rIdx, job.mIdx));
  }

  function markJobSaved(job) {
    const key = jobKey(job);
    if (isJobCurrent(job)) dirtyMatches.delete(key);
    for (let i = pendingSaves.length - 1; i >= 0; i--) {
      if (jobKey(pendingSaves[i]) === key && sameScore(pendingSaves[i], job)) pendingSaves.splice(i, 1);
    }
    updateFloatingButton();
  }

  function enqueueRetry(job) {
    const key = jobKey(job);
    for (let i = pendingSaves.length - 1; i >= 0; i--) {
      if (jobKey(pendingSaves[i]) === key) pendingSaves.splice(i, 1);
    }
    pendingSaves.push({ ...job, retries: 0 });
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
    } catch (e) {
      console.warn('[Neon Live] live_data konnte nicht geladen werden', e);
    }

    const btn = document.getElementById('editToggle');
    if (!btn) {
      if (typeof renderAll === 'function') renderAll();
      return;
    }

    if (liveKey) {
      const shouldEdit = sessionStorage.getItem(editStateKey()) === 'true';
      isEditing = shouldEdit;
      btn.disabled = false;
      btn.innerText = shouldEdit ? '✏️ Bearbeiten' : '🔒 Bearbeiten';
      btn.title = 'Bearbeiten mit Turnier-Key';
    } else {
      isEditing = false;
      btn.disabled = true;
      btn.innerText = '👁 Nur ansehen';
      btn.title = 'Dieser Link ist nur zum Ansehen';
    }

    if (typeof renderAll === 'function') renderAll();
  };

  window.toggleEdit = function () {
    if (!liveKey) {
      isEditing = false;
      showToast('👁 Dieser Link ist nur zum Ansehen', 'info');
      return;
    }
    isEditing = !isEditing;
    if (isEditing) sessionStorage.setItem(editStateKey(), 'true');
    else sessionStorage.removeItem(editStateKey());
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
    if (dirtyMatches.size === 0 || isSaving) return;
    if (!liveKey) { showToast('🔒 Kein Bearbeiten-Key vorhanden', 'error'); return; }

    const jobs = [];
    for (const key of Array.from(dirtyMatches)) {
      const [rIdx, mIdx] = key.split('-').map(Number);
      const job = readJob(rIdx, mIdx);
      if (!job) continue;
      if (job.s0 == null && job.s1 == null) tournamentData.s_new[rIdx].matches[mIdx].score = ['', ''];
      else tournamentData.s_new[rIdx].matches[mIdx].score = [String(job.s0), String(job.s1)];
      jobs.push(job);
    }
    if (jobs.length === 0) return;

    isSaving = true;
    localStorage.setItem('backup_' + tournamentId, JSON.stringify({ data: tournamentData, timestamp: Date.now() }));

    let saved = 0;
    let failed = 0;
    let invalidKey = false;
    try {
      for (const job of jobs) {
        if (!isJobCurrent(job)) continue;
        try {
          const latestLiveData = await saveScore(job);
          markJobSaved(job);
          applyLiveScores(latestLiveData);
          saved++;
        } catch (e) {
          if ((e.message || '').includes('ungültig')) {
            invalidKey = true;
            break;
          }
          enqueueRetry(job);
          failed++;
        }
      }

      updateFloatingButton();
      if (dirtyMatches.size === 0 && typeof renderAll === 'function') renderAll();

      if (invalidKey) {
        showToast('❌ Ungültiger Bearbeiten-Key', 'error');
      } else if (failed > 0) {
        startRetryQueue();
        showToast(`⚠️ ${saved} gespeichert · ${failed} wird synchronisiert`, 'warning');
      } else if (saved > 0) {
        showToast(saved === jobs.length ? '💾 Alle Ergebnisse gespeichert' : `💾 ${saved} Ergebnisse gespeichert`, 'success');
      }
    } finally {
      isSaving = false;
    }
  };

  window.startRetryQueue = function () {
    if (retryInterval || !liveKey) return;
    retryInterval = setInterval(async () => {
      if (isSaving) return;
      if (pendingSaves.length === 0) {
        clearInterval(retryInterval);
        retryInterval = null;
        return;
      }

      const save = pendingSaves[0];
      if (!isJobCurrent(save)) {
        pendingSaves.shift();
        return;
      }

      try {
        isSaving = true;
        const latestLiveData = await saveScore(save);
        pendingSaves.shift();
        markJobSaved(save);
        applyLiveScores(latestLiveData);
        if (dirtyMatches.size === 0 && typeof renderAll === 'function') renderAll();
        showToast('✅ Synchronisiert', 'success');
      } catch (e) {
        save.retries++;
        if ((e.message || '').includes('ungültig')) {
          pendingSaves.shift();
          showToast('❌ Ungültiger Bearbeiten-Key', 'error');
        } else if (save.retries > 5) {
          pendingSaves.shift();
          showToast('❌ Sync fehlgeschlagen - Eingabe bleibt ungespeichert', 'error');
        }
      } finally {
        isSaving = false;
        updateFloatingButton();
      }
    }, 10000);
  };

  if (typeof originalSafeRefresh === 'function') {
    window.safeRefresh = async function (source) {
      if (isSaving || dirtyMatches.size > 0) {
        console.log(`[${source}] Blocked - unsaved/saving`);
        return false;
      }
      return originalSafeRefresh(source);
    };
  }

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