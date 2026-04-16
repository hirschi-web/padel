// ============================================================
// SETUP-GROUPS.JS  –  Gruppen-System (8 Teams, 2 Gruppen)
// Padel Hirsch · v1.0
// ============================================================

// ── State ────────────────────────────────────────────────────
let grpTeams     = [];   // [{name, p1, p2}, ...]
let grpGroups    = {A:[], B:[]};  // indices into grpTeams
let grpSchedule  = null; // computed schedule
let grpDragSrc   = null; // drag source for manual group swap

// ── Init called from switchMode('groups') ───────────────────
function grpInit() {
    grpBuildTeamInputs();
    grpUpdateCourtNames();
    grpBindInputs();
    grpRecalc();
}

function grpBindInputs() {
    ['grpTName','grpMatchTime','grpPause','grpStartTime',
     'grpCourts','grpCourtHours'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', grpRecalc);
    });
}

// ── Team Inputs ──────────────────────────────────────────────
function grpBuildTeamInputs() {
    const list = document.getElementById('grpTeamList');
    if (!list) return;
    list.innerHTML = '';
    for (let i = 0; i < 8; i++) {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex;gap:6px;align-items:center;';
        div.innerHTML = `
            <span class="badge badge-blue display" style="min-width:28px;text-align:center;font-size:12px;">${i+1}</span>
            <input type="text" id="grpTeam${i}Name" placeholder="Team ${i+1}" value="${grpTeams[i]?.name||''}" 
                   style="flex:1.2" onchange="grpSyncTeams()" oninput="grpSyncTeams()">
            <input type="text" id="grpTeam${i}P1" placeholder="Spieler 1" value="${grpTeams[i]?.p1||''}" 
                   style="flex:1" onchange="grpSyncTeams()" oninput="grpSyncTeams()">
            <input type="text" id="grpTeam${i}P2" placeholder="Spieler 2" value="${grpTeams[i]?.p2||''}" 
                   style="flex:1" onchange="grpSyncTeams()" oninput="grpSyncTeams()">`;
        list.appendChild(div);
    }
}

function grpSyncTeams() {
    grpTeams = [];
    for (let i = 0; i < 8; i++) {
        grpTeams.push({
            name: (document.getElementById(`grpTeam${i}Name`)?.value || `Team ${i+1}`).trim(),
            p1:   (document.getElementById(`grpTeam${i}P1`)?.value   || '').trim(),
            p2:   (document.getElementById(`grpTeam${i}P2`)?.value   || '').trim(),
        });
    }
    grpRecalc();
}

// ── Court name visibility ─────────────────────────────────────
function grpUpdateCourtNames() {
    const n = parseInt(document.getElementById('grpCourts')?.value) || 2;
    const sec = document.getElementById('grpCourtNamesSection');
    if (!sec) return;
    if (n >= 2) {
        sec.classList.remove('hidden');
    } else {
        sec.classList.add('hidden');
    }
}

// ── Recalc time proposal ──────────────────────────────────────
function grpRecalc() {
    grpUpdateCourtNames();
    const matchMin  = parseInt(document.getElementById('grpMatchTime')?.value)  || 16;
    const pauseMin  = parseInt(document.getElementById('grpPause')?.value)       || 3;
    const courts    = parseInt(document.getElementById('grpCourts')?.value)      || 2;
    const startStr  = document.getElementById('grpStartTime')?.value             || '14:30';
    const courtHrs  = parseFloat(document.getElementById('grpCourtHours')?.value)|| 5;

    const slotMin   = matchMin + pauseMin;
    const totalAvail= courtHrs * 60;

    // Phase 1: Gruppenphase – jeder gegen jeden in 2 Gruppen à 4
    // 4-team RR = 6 matches per group, 12 total
    // With 2 courts: 6 rounds (2 matches parallel)
    const p1Rounds  = 6;
    const p1Min     = p1Rounds * slotMin - pauseMin; // no pause after last

    // Phase 2: Playoffs – 4 matches (SF1..4), 2 parallel → 2 rounds
    const p2Rounds  = 2;
    const p2Min     = p2Rounds * slotMin - pauseMin;

    // Phase 3: Finals – 4 matches (F,3rd,5th,7th), 2 parallel → 2 rounds
    const p3Rounds  = 2;
    const p3Min     = p3Rounds * slotMin - pauseMin;

    // Extra pause between phases (5 min)
    const phasePause = 5;
    const totalMin   = p1Min + phasePause + p2Min + phasePause + p3Min;

    const [sh, sm] = startStr.split(':').map(Number);
    const startMins = sh * 60 + sm;

    function addMins(base, add) {
        const t = base + add;
        return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
    }

    const p1End = startMins + p1Min;
    const p2Start = p1End + phasePause;
    const p2End   = p2Start + p2Min;
    const p3Start = p2End + phasePause;
    const p3End   = p3Start + p3Min;
    const endTime = addMins(startMins, totalMin);
    const bookingEnd = addMins(startMins, totalAvail);
    const buffer  = totalAvail - totalMin;

    const fits    = totalMin <= totalAvail;

    const box = document.getElementById('grpTimeProposal');
    if (!box) return;

    box.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px;">
            <div class="stat-card">
                <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:4px;">Phase 1 · Gruppe</div>
                <div class="display" style="font-size:26px;font-weight:900;color:var(--blue);line-height:1;">${p1Rounds}</div>
                <div style="font-size:9px;color:var(--muted);">Runden</div>
                <div style="font-size:11px;font-weight:700;margin-top:4px;">${addMins(startMins,0)} → ${addMins(startMins,p1Min)}</div>
                <div style="font-size:9px;color:var(--muted);">~${p1Min} Min · 12 Matches</div>
            </div>
            <div class="stat-card">
                <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:4px;">Phase 2 · Halbfinale</div>
                <div class="display" style="font-size:26px;font-weight:900;color:#7c3aed;line-height:1;">${p2Rounds}</div>
                <div style="font-size:9px;color:var(--muted);">Runden</div>
                <div style="font-size:11px;font-weight:700;margin-top:4px;">${addMins(p2Start,0)} → ${addMins(p2Start,p2Min)}</div>
                <div style="font-size:9px;color:var(--muted);">~${p2Min} Min · 4 Matches</div>
            </div>
            <div class="stat-card">
                <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:4px;">Phase 3 · Finals</div>
                <div class="display" style="font-size:26px;font-weight:900;color:var(--green);line-height:1;">${p3Rounds}</div>
                <div style="font-size:9px;color:var(--muted);">Runden</div>
                <div style="font-size:11px;font-weight:700;margin-top:4px;">${addMins(p3Start,0)} → ${addMins(p3Start,p3Min)}</div>
                <div style="font-size:9px;color:var(--muted);">~${p3Min} Min · 4 Matches</div>
            </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:12px 14px;border-radius:12px;background:${fits?'#f0fdf4':'#fef2f2'};border:1.5px solid ${fits?'#bbf7d0':'#fecaca'};">
            <div>
                <span style="font-size:11px;font-weight:700;color:${fits?'var(--green)':'var(--red)'};">${fits?'✅ Passt in Buchungszeit':'⚠️ Überschreitung!'}</span>
                <span style="font-size:11px;color:var(--muted);margin-left:10px;">Ende: <strong>${endTime}</strong> · Buchung bis: <strong>${bookingEnd}</strong></span>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <span class="badge badge-slate">Gesamt ${totalMin} Min</span>
                <span class="badge ${fits?'badge-green':'badge-red'}">Puffer ${buffer} Min</span>
                <span class="badge badge-blue">Jedes Team: 5 Spiele</span>
                <span class="badge badge-purple">Match: ${matchMin} Min + ${pauseMin} Min Pause</span>
            </div>
        </div>`;
}

// ── Generate / Draw Groups ────────────────────────────────────
function grpGenerate() {
    grpSyncTeams();

    // validate names
    const missing = grpTeams.filter(t => !t.name).length;
    if (missing > 0) {
        document.getElementById('grpInputError').textContent = 'Bitte alle Team-Namen ausfüllen.';
        document.getElementById('grpInputError').classList.remove('hidden');
        return;
    }
    document.getElementById('grpInputError').classList.add('hidden');

    // random draw
    const idx = [0,1,2,3,4,5,6,7];
    for (let i = idx.length-1; i > 0; i--) {
        const j = Math.floor(Math.random()*(i+1));
        [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    grpGroups = { A: idx.slice(0,4), B: idx.slice(4,8) };

    grpRenderGroupDraw();
    grpBuildSchedule();
    document.getElementById('grpBracketArea').classList.remove('hidden');
}

function grpRenderGroupDraw() {
    ['A','B'].forEach(g => {
        const el = document.getElementById(`grpGroup${g}Teams`);
        if (!el) return;
        el.innerHTML = '';
        grpGroups[g].forEach((tidx, pos) => {
            const t = grpTeams[tidx];
            const div = document.createElement('div');
            div.draggable = true;
            div.dataset.tidx = tidx;
            div.dataset.group = g;
            div.style.cssText = `
                display:flex;align-items:center;gap:8px;
                padding:8px 10px;background:white;
                border:1.5px solid #e2e8f0;border-radius:8px;
                cursor:grab;user-select:none;font-size:12px;font-weight:600;
                transition:box-shadow .15s;`;
            div.innerHTML = `
                <span class="badge badge-${g==='A'?'blue':'purple'}" style="min-width:22px;text-align:center;">${g}${pos+1}</span>
                <span style="flex:1;">${t.name}</span>
                <span style="font-size:10px;color:var(--muted);">${t.p1}${t.p2?' / '+t.p2:''}</span>
                <span style="font-size:11px;color:#cbd5e1;">⠿</span>`;
            div.addEventListener('dragstart', e => {
                grpDragSrc = {tidx, group:g};
                e.dataTransfer.effectAllowed = 'move';
                div.style.opacity = '.5';
            });
            div.addEventListener('dragend', () => { div.style.opacity='1'; });
            el.appendChild(div);
        });

        // drop zone
        el.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect='move'; });
        el.addEventListener('drop', e => {
            e.preventDefault();
            if (!grpDragSrc || grpDragSrc.group === g) return;
            const srcG = grpDragSrc.group;
            const tgtG = g;
            const srcIdx = grpGroups[srcG].indexOf(grpDragSrc.tidx);
            // swap first element of target group with dragged
            const tgtIdx = 0; // swap with first available
            const tgtTidx = grpGroups[tgtG][tgtIdx];
            grpGroups[srcG][srcIdx] = tgtTidx;
            grpGroups[tgtG][tgtIdx] = grpDragSrc.tidx;
            grpDragSrc = null;
            grpRenderGroupDraw();
            grpBuildSchedule();
        });
    });
}

// ── Schedule Builder ─────────────────────────────────────────
function grpBuildSchedule() {
    const matchMin  = parseInt(document.getElementById('grpMatchTime')?.value)  || 16;
    const pauseMin  = parseInt(document.getElementById('grpPause')?.value)       || 3;
    const courts    = Math.min(parseInt(document.getElementById('grpCourts')?.value)||2, 2);
    const startStr  = document.getElementById('grpStartTime')?.value || '14:30';
    const [sh, sm]  = startStr.split(':').map(Number);
    let cursor      = sh * 60 + sm;
    const slotMin   = matchMin + pauseMin;

    function toTime(mins) {
        return `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`;
    }

    const courtNames = [
        document.getElementById('grpCourt1Name')?.value || '1',
        document.getElementById('grpCourt2Name')?.value || '2',
    ];

    grpSchedule = { matches:[], phases:[] };

    // ── Phase 1: Round-robin in groups ───────────────────────
    // Generate all 6 matches for each group
    function rrPairs(arr) {
        const pairs = [];
        for (let i=0;i<arr.length;i++)
            for (let j=i+1;j<arr.length;j++)
                pairs.push([arr[i],arr[j]]);
        return pairs;
    }

    const pairsA = rrPairs(grpGroups.A);
    const pairsB = rrPairs(grpGroups.B);

    // Interleave A and B matches across 2 courts, 6 rounds
    let p1Matches = [];
    for (let r=0;r<6;r++) {
        const mA = pairsA[r];
        const mB = pairsB[r];
        const tStart = cursor;
        const tEnd   = cursor + matchMin;
        p1Matches.push({
            id: `G-A-${r+1}`, phase:1, round:r+1, group:'A',
            t1: grpTeams[mA[0]], t2: grpTeams[mA[1]],
            t1idx: mA[0], t2idx: mA[1],
            court: courtNames[0],
            startTime: toTime(tStart), endTime: toTime(tEnd),
            score: null
        });
        p1Matches.push({
            id: `G-B-${r+1}`, phase:1, round:r+1, group:'B',
            t1: grpTeams[mB[0]], t2: grpTeams[mB[1]],
            t1idx: mB[0], t2idx: mB[1],
            court: courtNames[1],
            startTime: toTime(tStart), endTime: toTime(tEnd),
            score: null
        });
        cursor += slotMin;
    }
    // Remove last pause
    cursor -= pauseMin;

    grpSchedule.phases.push({ name:'Gruppenphase', matches: p1Matches, startTime: toTime(sh*60+sm), endTime: toTime(cursor) });
    grpSchedule.matches.push(...p1Matches);

    // Phase break
    cursor += 5;

    // ── Phase 2: Playoffs ────────────────────────────────────
    // SF1: A1 vs B2, SF2: B1 vs A2, SF3: A3 vs B4, SF4: B3 vs A4
    const sfPairs = [
        {label:'SF1', ga:'A', ra:1, gb:'B', rb:2},
        {label:'SF2', ga:'B', ra:1, gb:'A', rb:2},
        {label:'SF3', ga:'A', ra:3, gb:'B', rb:4},
        {label:'SF4', ga:'B', ra:3, gb:'A', rb:4},
    ];

    let p2Matches = [];
    // Round 1 of SF: SF1 + SF2 parallel
    // Round 2 of SF: SF3 + SF4 parallel
    [[0,1],[2,3]].forEach((pair, ri) => {
        const tStart = cursor;
        const tEnd   = cursor + matchMin;
        pair.forEach((sfi, ci) => {
            const sf = sfPairs[sfi];
            p2Matches.push({
                id: sf.label, phase:2, round:ri+1,
                sfRef: { ga: sf.ga, ra: sf.ra, gb: sf.gb, rb: sf.rb },
                t1: null, t2: null, // filled after phase 1
                court: courtNames[ci],
                startTime: toTime(tStart), endTime: toTime(tEnd),
                score: null, label: sf.label
            });
        });
        cursor += slotMin;
    });
    cursor -= pauseMin;

    grpSchedule.phases.push({ name:'Halbfinale', matches: p2Matches, startTime: toTime(cursor - p2Matches.length/2 * slotMin + pauseMin), endTime: toTime(cursor) });
    grpSchedule.matches.push(...p2Matches);

    cursor += 5;

    // ── Phase 3: Finals ──────────────────────────────────────
    const finalLabels = [
        {id:'F1',  label:'Finale (Platz 1–2)',   sfW:['SF1','SF2'], sfL:null},
        {id:'F3',  label:'Spiel Platz 3–4',       sfW:null, sfL:['SF1','SF2']},
        {id:'F5',  label:'Spiel Platz 5–6',       sfW:['SF3','SF4'], sfL:null},
        {id:'F7',  label:'Spiel Platz 7–8',       sfW:null, sfL:['SF3','SF4']},
    ];

    let p3Matches = [];
    [[0,2],[1,3]].forEach((pair, ri) => {
        const tStart = cursor;
        const tEnd   = cursor + matchMin;
        pair.forEach((fi, ci) => {
            const f = finalLabels[fi];
            p3Matches.push({
                id: f.id, phase:3, round:ri+1,
                t1: null, t2: null,
                court: courtNames[ci],
                startTime: toTime(tStart), endTime: toTime(tEnd),
                score: null, label: f.label,
                fromW: f.sfW, fromL: f.sfL
            });
        });
        cursor += slotMin;
    });
    cursor -= pauseMin;

    grpSchedule.phases.push({ name:'Finalrunde', matches: p3Matches, startTime: toTime(cursor - p3Matches.length/2 * slotMin + pauseMin), endTime: toTime(cursor) });
    grpSchedule.matches.push(...p3Matches);

    grpRenderSchedule();
}

// ── Render Schedule ───────────────────────────────────────────
function grpRenderSchedule() {
    const container = document.getElementById('grpScheduleContainer');
    if (!container) return;
    container.innerHTML = '';

    grpSchedule.phases.forEach((phase, pi) => {
        const colors = ['var(--blue)','#7c3aed','var(--green)'];
        const badgeC = ['badge-blue','badge-purple','badge-green'];

        const phaseDiv = document.createElement('div');
        phaseDiv.style.marginBottom = '20px';

        // Group matches by round
        const rounds = {};
        phase.matches.forEach(m => {
            if (!rounds[m.round]) rounds[m.round] = [];
            rounds[m.round].push(m);
        });

        let html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <span class="display" style="font-size:16px;font-weight:900;color:${colors[pi]};">Phase ${pi+1}: ${phase.name}</span>
            <span style="font-size:11px;color:var(--muted);">${phase.startTime} – ${phase.endTime}</span>
        </div>`;

        Object.entries(rounds).forEach(([rnum, matches]) => {
            html += `<div style="margin-bottom:8px;">
                <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:5px;">
                    Runde ${rnum} · ${matches[0].startTime}
                </div>
                <div style="display:flex;flex-direction:column;gap:5px;">`;

            matches.forEach(m => {
                const t1n = m.t1?.name || (m.sfRef ? `Platz ${m.sfRef.ga}${m.sfRef.ra}` : m.fromW?.[0]||m.fromL?.[0]||'?');
                const t2n = m.t2?.name || (m.sfRef ? `Platz ${m.sfRef.gb}${m.sfRef.rb}` : m.fromW?.[1]||m.fromL?.[1]||'?');
                const isPlaceholder = !m.t1 && !m.t2 && pi > 0;

                html += `<div class="match-row c${parseInt(m.court)||1}" style="border-left-color:${colors[pi]};">
                    <span class="court-tag">Court ${m.court}</span>
                    <span style="font-size:10px;color:var(--muted);min-width:70px;">${m.startTime}–${m.endTime}</span>
                    ${m.group ? `<span class="badge ${badgeC[pi]}" style="font-size:9px;">Gr. ${m.group}</span>` : ''}
                    ${m.label ? `<span class="badge ${badgeC[pi]}" style="font-size:9px;">${m.label}</span>` : ''}
                    <span class="match-names ${isPlaceholder?'virt':''}">
                        ${t1n} <span class="vs-tag">VS</span> ${t2n}
                    </span>
                </div>`;
            });

            html += `</div></div>`;
        });

        phaseDiv.innerHTML = html;
        container.appendChild(phaseDiv);
    });
}

// ── Save Tournament ───────────────────────────────────────────
async function grpSaveTournament() {
    const name = document.getElementById('grpTName')?.value?.trim();
    if (!name) { alert('Bitte Turniernamen eingeben.'); return; }
    if (!grpSchedule) { alert('Bitte erst Bracket generieren.'); return; }

    const pw       = document.getElementById('grpTPassword')?.value || '';
    const expEl    = document.getElementById('grpExpiryEnabled');
    const expDate  = expEl?.checked ? document.getElementById('grpExpiryDate')?.value : null;
    const matchMin = parseInt(document.getElementById('grpMatchTime')?.value) || 16;
    const pauseMin = parseInt(document.getElementById('grpPause')?.value) || 3;

    const btn = document.querySelector('#grpSaveBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Speichern...'; }

    try {
        const data = {
            name,
            format: 'groups',
            password: pw,
            expires_at: expDate || null,
            settings: {
                matchTime: matchMin, pauseTime: pauseMin,
                courts: parseInt(document.getElementById('grpCourts')?.value)||2,
                startTime: document.getElementById('grpStartTime')?.value,
                court1Name: document.getElementById('grpCourt1Name')?.value||'1',
                court2Name: document.getElementById('grpCourt2Name')?.value||'2',
            },
            teams: grpTeams,
            groups: grpGroups,
            schedule: grpSchedule,
            created_at: new Date().toISOString()
        };

        // Check if updating existing
        const sel = document.getElementById('tournamentSelect');
        const existing = sel?.value !== 'new' ? sel.value : null;

        let result;
        if (existing) {
            result = await supabase.from('tournaments').update(data).eq('id', existing);
        } else {
            result = await supabase.from('tournaments').insert(data).select();
        }

        if (result.error) throw result.error;

        const savedId = existing || result.data?.[0]?.id;
        alert(`✅ Turnier "${name}" gespeichert!\n\nLive-Link:\nlive-groups.html?id=${savedId}`);

        document.getElementById('lastActionTime').textContent =
            `Gespeichert: ${new Date().toLocaleString('de-AT')}`;

        loadTournamentList();

    } catch(err) {
        alert('Fehler: ' + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '✅ Gruppen-Turnier speichern'; }
    }
}

// ── Toggle PW visibility ──────────────────────────────────────
function grpTogglePw() {
    const el = document.getElementById('grpTPassword');
    if (!el) return;
    el.type = el.type === 'password' ? 'text' : 'password';
}

function grpToggleExpiry() {
    const enabled = document.getElementById('grpExpiryEnabled')?.checked;
    document.getElementById('grpExpiryDateSection')?.classList.toggle('hidden', !enabled);
}
