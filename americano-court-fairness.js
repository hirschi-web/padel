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
      // Alle drei Courts grundsätzlich möglichst gleichmäßig verteilen.
      score += c.reduce((sum, n) => sum + Math.pow(n - avg, 2), 0) * 25;

      // Court 2: bei 7–8 Spielen sind 2–3 Einsätze ideal.
      const low = Math.floor(total / 3);
      const high = Math.ceil(total / 3);
      if (c[1] < low) score += Math.pow(low - c[1], 2) * 180;
      if (c[1] > high) score += Math.pow(c[1] - high, 2) * 260;

      // Harte Ausreißer auf dem eingeschränkten Court deutlich unattraktiv machen.
      if (c[1] === 1 && total >= 6) score += 220;
      if (c[1] === 4) score += 900;
      if (c[1] >= 5) score += 5000 + (c[1] - 5) * 5000;

      // Auch Court 1/3 sollen nicht extrem einseitig werden.
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

  function cloneSchedule(schedule) {
    return schedule.map(round => ({
      ...round,
      pause: Array.isArray(round.pause) ? [...round.pause] : round.pause,
      matches: (round.matches || []).map(match => ({
        ...match,
        team1: Array.isArray(match.team1) ? [...match.team1] : match.team1,
        team2: Array.isArray(match.team2) ? [...match.team2] : match.team2
      }))
    }));
  }

  function optimizeCourtAssignments(schedule, numPlayers) {
    if (!isEnabled() || !Array.isArray(schedule) || numPlayers < 1) return schedule;

    const eligible = [];
    schedule.forEach((round, ri) => {
      const matches = round.matches || [];
      if (matches.length < 2 || matches.length > 3) return;
      const courts = matches.map(m => Number(m.court));
      if (new Set(courts).size !== courts.length) return;
      if (courts.some(c => c < 1 || c > 3)) return;
      eligible.push({ ri, perms: permutations(courts) });
    });
    if (!eligible.length) return schedule;

    let best = cloneSchedule(schedule);
    let bestScore = courtScore(best, numPlayers);

    // Mehrere Starts verhindern, dass eine lokal gute frühe Runde den Rest blockiert.
    for (let restart = 0; restart < 24; restart++) {
      const candidate = cloneSchedule(schedule);

      if (restart > 0) {
        eligible.forEach(({ ri, perms }) => {
          applyCourtPermutation(candidate[ri], perms[Math.floor(Math.random() * perms.length)]);
        });
      }

      let improved = true;
      let passes = 0;
      while (improved && passes < 8) {
        improved = false;
        passes++;

        // Reihenfolge pro Durchlauf variieren, damit nicht immer dieselben Runden bevorzugt werden.
        const order = [...eligible].sort(() => Math.random() - 0.5);
        order.forEach(({ ri, perms }) => {
          const round = candidate[ri];
          const original = round.matches.map(m => Number(m.court));
          let localBest = original;
          let localScore = courtScore(candidate, numPlayers);

          perms.forEach(perm => {
            applyCourtPermutation(round, perm);
            const s = courtScore(candidate, numPlayers);
            if (s < localScore) {
              localScore = s;
              localBest = perm.slice();
            }
          });

          applyCourtPermutation(round, localBest);
          if (localBest.some((c, i) => c !== original[i])) improved = true;
        });
      }

      const score = courtScore(candidate, numPlayers);
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    return best;
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