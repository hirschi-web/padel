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

  function addCourtPenalty(result, schedule, numPlayers) {
    if (!isEnabled() || numPlayers < 1) return result;

    const courtCounts = Array.from({ length: numPlayers }, () => [0, 0, 0]);
    schedule.forEach(round => {
      (round.matches || []).forEach(match => {
        const ci = Number(match.court) - 1;
        if (ci < 0 || ci > 2) return;
        [...(match.team1 || []), ...(match.team2 || [])].forEach(player => {
          if (typeof player === 'number' && player >= 0 && player < numPlayers) {
            courtCounts[player][ci]++;
          }
        });
      });
    });

    const court2Average = courtCounts.reduce((sum, c) => sum + c[1], 0) / numPlayers;
    let extraPenalty = 0;

    courtCounts.forEach(counts => {
      const total = counts[0] + counts[1] + counts[2];
      if (!total) return;
      const playerAverage = total / 3;

      // Alle Courts möglichst gleichmäßig verteilen.
      extraPenalty += counts.reduce((sum, n) => sum + Math.pow(n - playerAverage, 2), 0) * 35;
      // Court 2 ist in der Racketworld der eingeschränkte Court: starke Ausreißer zusätzlich vermeiden.
      extraPenalty += Math.pow(counts[1] - court2Average, 2) * 90;
    });

    return { ...result, penalty: result.penalty + extraPenalty };
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

    if (typeof window.calcPenalty === 'function' && !window.calcPenalty.__rwCourtFairnessWrapped) {
      const originalCalcPenalty = window.calcPenalty;
      const wrapped = function(schedule, numPlayers) {
        return addCourtPenalty(originalCalcPenalty(schedule, numPlayers), schedule, numPlayers);
      };
      wrapped.__rwCourtFairnessWrapped = true;
      window.calcPenalty = wrapped;
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
    if (typeof window.calcPenalty === 'function' && typeof window.loadTournament === 'function' && typeof window.saveFinal === 'function') {
      clearInterval(timer);
    }
  }, 100);

  setTimeout(() => clearInterval(timer), 15000);
})();