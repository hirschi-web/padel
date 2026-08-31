(() => {
  'use strict';

  const CHECKBOX_ID = 'rwCourt2Fairness';

  function isEnabled() {
    return !!document.getElementById(CHECKBOX_ID)?.checked;
  }

  function injectCheckbox() {
    if (document.getElementById(CHECKBOX_ID)) return;
    const section = document.getElementById('courtNamesSection');
    if (!section) return;

    const row = document.createElement('label');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:10px;font-size:11px;font-weight:600;color:#475569;cursor:pointer;';
    row.innerHTML = `<input type="checkbox" id="${CHECKBOX_ID}" style="width:14px;height:14px;accent-color:#2563eb;"> <span>RW Court 2 berücksichtigen</span>`;
    section.appendChild(row);
  }

  function realPlayers(match, numPlayers) {
    return [...(match.team1 || []), ...(match.team2 || [])]
      .filter(p => typeof p === 'number' && p >= 0 && p < numPlayers);
  }

  function getCourtCounts(schedule, numPlayers) {
    const counts = Array.from({ length: numPlayers }, () => [0, 0, 0]);
    schedule.forEach(round => {
      (round.matches || []).forEach(match => {
        const ci = Number(match.court) - 1;
        if (ci < 0 || ci > 2) return;
        realPlayers(match, numPlayers).forEach(p => counts[p][ci]++);
      });
    });
    return counts;
  }

  function courtScore(schedule, numPlayers) {
    const counts = getCourtCounts(schedule, numPlayers);
    let score = 0;

    counts.forEach(c => {
      const total = c[0] + c[1] + c[2];
      if (!total) return;

      const avg = total / 3;
      score += c.reduce((sum, n) => sum + Math.pow(n - avg, 2), 0) * 25;

      const low = Math.floor(total / 3);
      const high = Math.ceil(total / 3);
      if (c[1] < low) score += Math.pow(low - c[1], 2) * 180;
      if (c[1] > high) score += Math.pow(c[1] - high, 2) * 260;

      if (c[1] === 1 && total >= 6) score += 220;
      if (c[1] === 4) score += 900;
      if (c[1] >= 5) score += 5000 + (c[1] - 5) * 5000;

      const spread = Math.max(...c) - Math.min(...c);
      if (spread > 1) score += Math.pow(spread - 1, 2) * 120;
    });

    return score;
  }

  function permutations(values) {
    if (values.length <= 1) return [values.slice()];
    const out = [];
    values.forEach((v, i) => {
      const rest = values.slice(0, i).concat(values.slice(i + 1));
      permutations(rest).forEach(p => out.push([v, ...p]));
    });
    return out;
  }

  function applyCourtPermutation(round, courts) {
    round.matches.forEach((match, i) => { match.court = courts[i]; });
  }

  function optimizeCourtAssignments(schedule, numPlayers) {
    if (!isEnabled() || !Array.isArray(schedule) || numPlayers < 1) return schedule;

    // Bewusst leichtgewichtig: Die Americano-Engine erzeugt selbst 500 Varianten.
    // Deshalb pro Variante nur ein Greedy-Durchlauf über die fertigen Matches.
    schedule.forEach(round => {
      const matches = round.matches || [];
      if (matches.length < 2 || matches.length > 3) return;

      const originalCourts = matches.map(m => Number(m.court));
      if (new Set(originalCourts).size !== originalCourts.length) return;
      if (originalCourts.some(c => c < 1 || c > 3)) return;

      let bestCourts = originalCourts.slice();
      let bestScore = courtScore(schedule, numPlayers);

      permutations(originalCourts).forEach(perm => {
        applyCourtPermutation(round, perm);
        const score = courtScore(schedule, numPlayers);
        if (score < bestScore) {
          bestScore = score;
          bestCourts = perm.slice();
        }
      });

      applyCourtPermutation(round, bestCourts);
    });

    return schedule;
  }

  async function readStoredSetting(id) {
    if (!id || id === 'new' || !window.phNeon?.getClient) return false;
    try {
      const client = await window.phNeon.getClient();
      const res = await client.from('tournaments').select('id,data').eq('id', id);
      const row = Array.isArray(res?.data) ? res.data[0] : res?.data;
      return !!row?.data?.rwCourt2Fairness;
    } catch (e) {
      console.warn('RW Court 2 Einstellung konnte nicht geladen werden.', e);
      return false;
    }
  }

  async function storeSetting(id, enabled) {
    if (!id || !window.phNeon?.getClient) return;
    try {
      const client = await window.phNeon.getClient();
      const res = await client.from('tournaments').select('id,data').eq('id', id);
      const row = Array.isArray(res?.data) ? res.data[0] : res?.data;
      if (!row?.data) return;
      await client.from('tournaments').upsert({
        id,
        data: { ...row.data, rwCourt2Fairness: !!enabled }
      });
    } catch (e) {
      console.warn('RW Court 2 Einstellung konnte nicht gespeichert werden.', e);
    }
  }

  function installHooks() {
    injectCheckbox();

    if (typeof window.generateVariant === 'function' && !window.generateVariant.__rwCourtFairnessWrapped) {
      const originalGenerateVariant = window.generateVariant;
      const wrapped = function(inputs) {
        const schedule = originalGenerateVariant.apply(this, arguments);
        return optimizeCourtAssignments(schedule, Number(inputs?.count) || 0);
      };
      wrapped.__rwCourtFairnessWrapped = true;
      window.generateVariant = wrapped;
    }

    if (typeof window.loadTournament === 'function' && !window.loadTournament.__rwCourtFairnessWrapped) {
      const originalLoadTournament = window.loadTournament;
      const wrapped = async function(id) {
        const result = await originalLoadTournament.apply(this, arguments);
        injectCheckbox();
        const checkbox = document.getElementById(CHECKBOX_ID);
        if (checkbox) checkbox.checked = await readStoredSetting(id);
        return result;
      };
      wrapped.__rwCourtFairnessWrapped = true;
      window.loadTournament = wrapped;
    }

    if (typeof window.saveFinal === 'function' && !window.saveFinal.__rwCourtFairnessWrapped) {
      const originalSaveFinal = window.saveFinal;
      const wrapped = async function() {
        const id = document.getElementById('tName')?.value?.trim();
        const enabled = isEnabled();
        const result = await originalSaveFinal.apply(this, arguments);
        await storeSetting(id, enabled);
        return result;
      };
      wrapped.__rwCourtFairnessWrapped = true;
      window.saveFinal = wrapped;
    }
  }

  const timer = setInterval(() => {
    injectCheckbox();
    installHooks();
    if (typeof window.generateVariant === 'function' && typeof window.loadTournament === 'function' && typeof window.saveFinal === 'function') {
      clearInterval(timer);
    }
  }, 100);

  setTimeout(() => clearInterval(timer), 15000);
})();