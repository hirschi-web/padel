// ============================================================
// PADEL HIRSCH - GRUPPEN SYSTEM
// Group Stage + Playoff Tournament (8 Teams, 2 Groups)
// ============================================================
// Nutzt supabaseClient aus setup-functions.js (bereits geladen)

// ── State ────────────────────────────────────────────────────
let grpTeams   = [];
let grpGroups  = { A: [], B: [] };
let grpSchedule = null;
let grpDragSrc = null;

// ── Init (called from switchMode) ────────────────────────────
function grpInit() {
    grpBuildTeamInputs();
    grpUpdateCourtNames();
    grpRecalc();
}

// ── Team Inputs ──────────────────────────────────────────────
function grpBuildTeamInputs() {
    const list = document.getElementById('grpTeamList');
    if (!list) return;
    list.innerHTML = '';
    for (let i = 0; i < 8; i++) {
        const div = document.createElement('div');
        div.className = 'grp-team-row';
        div.style.cssText = 'display:grid; grid-template-columns:auto 1fr 1fr 1fr; gap:8px; align-items:center;';
        div.innerHTML = `
            <span class="badge badge-blue display" style="min-width:24px;text-align:center;font-size:12px;">${i+1}</span>
            <input type="text" id="grpTeam${i}Name" placeholder="Team ${i+1}"
                   value="${escHtml(grpTeams[i]?.name||'')}"
                   style="margin:0;font-size:12px;" oninput="grpSyncTeams()">
            <input type="text" id="grpTeam${i}P1" placeholder="Spieler A"
                   value="${escHtml(grpTeams[i]?.p1||'')}"
                   style="margin:0;font-size:12px;" oninput="grpSyncTeams()">
            <input type="text" id="grpTeam${i}P2" placeholder="Spieler B"
                   value="${escHtml(grpTeams[i]?.p2||'')}"
                   style="margin:0;font-size:12px;" oninput="grpSyncTeams()">`;
        list.appendChild(div);
    }
}

function grpSyncTeams() {
    grpTeams = [];
    for (let i = 0; i < 8; i++) {
        grpTeams.push({
            id: i,
            name: (document.getElementById(`grpTeam${i}Name`)?.value || `Team ${i+1}`).trim(),
            p1:   (document.getElementById(`grpTeam${i}P1`)?.value   || '').trim(),
            p2:   (document.getElementById(`grpTeam${i}P2`)?.value   || '').trim(),
        });
    }
    grpRecalc();
}

// ── Court Names ───────────────────────────────────────────────
function grpUpdateCourtNames() {
    const n = parseInt(document.getElementById('grpCourts')?.value) || 2;
    const sec = document.getElementById('grpCourtNamesSection');
    if (!sec) return;
    sec.classList.toggle('hidden', n < 2);
}

function grpReadCourtNames() {
    return [
        document.getElementById('grpCourt1Name')?.value.trim() || '1',
        document.getElementById('grpCourt2Name')?.value.trim() || '2',
    ];
}

// ── Live Recalc / Time Proposal ───────────────────────────────
function grpRecalc() {
    grpUpdateCourtNames();
    const matchMin  = parseInt(document.getElementById('grpMatchTime')?.value)   || 16;
    const pauseMin  = parseInt(document.getElementById('grpPause')?.value)        || 3;
    const startStr  = document.getElementById('grpStartTime')?.value             || '14:30';
    const courtHrs  = parseFloat(document.getElementById('grpCourtHours')?.value) || 5;
    const slotMin   = matchMin + pauseMin;
    const totalAvail= courtHrs * 60;

    // Phase 1: 2 Gruppen à 4 Teams = 6 Runden (2 Matches parallel)
    const p1Rounds  = 6;
    const p1Min     = p1Rounds * slotMin - pauseMin;
    // Phase 2: Halbfinale – 4 Matches, 2 Courts → 2 Runden
    const p2Min     = 2 * slotMin - pauseMin;
    // Phase 3: Finals – 4 Matches, 2 Courts → 2 Runden
    const p3Min     = 2 * slotMin - pauseMin;
    const phasePause = 5;
    const totalMin  = p1Min + phasePause + p2Min + phasePause + p3Min;

    const [sh, sm]  = startStr.split(':').map(Number);
    const startMins = sh * 60 + sm;

    function toTime(m) {
        return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
    }

    const p1End    = startMins + p1Min;
    const p2Start  = p1End + phasePause;
    const p2End    = p2Start + p2Min;
    const p3Start  = p2End + phasePause;
    const p3End    = p3Start + p3Min;
    const fits     = totalMin <= totalAvail;
    const buffer   = totalAvail - totalMin;

    const box = document.getElementById('grpTimeProposal');
    if (!box) return;

    box.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px;" class="two-col-preview">
            <div class="stat-card">
                <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:4px;">Phase 1 · Gruppenphase</div>
                <div class="display" style="font-size:28px;font-weight:900;color:var(--blue);line-height:1;">${p1Rounds}</div>
                <div style="font-size:9px;color:var(--muted);">Runden · 12 Matches</div>
                <div style="font-size:11px;font-weight:700;margin-top:4px;">${toTime(startMins)} → ${toTime(p1End)}</div>
                <div style="font-size:9px;color:var(--muted);">~${p1Min} Min</div>
            </div>
            <div class="stat-card">
                <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:4px;">Phase 2 · Halbfinale</div>
                <div class="display" style="font-size:28px;font-weight:900;color:#7c3aed;line-height:1;">2</div>
                <div style="font-size:9px;color:var(--muted);">Runden · 4 Matches</div>
                <div style="font-size:11px;font-weight:700;margin-top:4px;">${toTime(p2Start)} → ${toTime(p2End)}</div>
                <div style="font-size:9px;color:var(--muted);">~${p2Min} Min</div>
            </div>
            <div class="stat-card">
                <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:4px;">Phase 3 · Finals</div>
                <div class="display" style="font-size:28px;font-weight:900;color:var(--green);line-height:1;">2</div>
                <div style="font-size:9px;color:var(--muted);">Runden · 4 Matches</div>
                <div style="font-size:11px;font-weight:700;margin-top:4px;">${toTime(p3Start)} → ${toTime(p3End)}</div>
                <div style="font-size:9px;color:var(--muted);">~${p3Min} Min</div>
            </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;
                    padding:12px 14px;border-radius:12px;
                    background:${fits?'#f0fdf4':'#fef2f2'};
                    border:1.5px solid ${fits?'#bbf7d0':'#fecaca'};">
            <div>
                <span style="font-size:11px;font-weight:700;color:${fits?'var(--green)':'var(--red)'};">
                    ${fits?'✅ Passt in Buchungszeit':'⚠️ Überschreitung!'}
                </span>
                <span style="font-size:11px;color:var(--muted);margin-left:10px;">
                    Ende: <strong>${toTime(p3End)}</strong> ·
                    Buchung bis: <strong>${toTime(startMins+totalAvail)}</strong>
                </span>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <span class="badge badge-slate">Gesamt ${totalMin} Min</span>
                <span class="badge ${fits?'badge-green':'badge-red'}">Puffer ${buffer} Min</span>
                <span class="badge badge-blue">5 Spiele/Team</span>
                <span class="badge badge-purple">${matchMin} Min + ${pauseMin} Min Pause</span>
            </div>
        </div>`;
}

// ── Generate (button click) ───────────────────────────────────
function grpGenerate() {
    grpSyncTeams();
    const missing = grpTeams.filter(t => !t.name).length;
    const errBox  = document.getElementById('grpInputError');
    if (missing > 0) {
        errBox.textContent = 'Bitte alle 8 Team-Namen ausfüllen.';
        errBox.classList.remove('hidden');
        return;
    }
    errBox.classList.add('hidden');

    // Random draw
    const idx = [0,1,2,3,4,5,6,7];
    for (let i = idx.length-1; i > 0; i--) {
        const j = Math.floor(Math.random()*(i+1));
        [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    grpGroups = { A: idx.slice(0,4), B: idx.slice(4,8) };

    grpRenderGroupDraw();
    grpBuildSchedule();
    document.getElementById('grpBracketArea').classList.remove('hidden');
    document.getElementById('grpBracketArea').scrollIntoView({ behavior:'smooth', block:'start' });
}

// ── Group Draw Render + Drag & Drop ──────────────────────────
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
                transition:box-shadow .15s,opacity .15s;`;
            div.innerHTML = `
                <span class="badge badge-${g==='A'?'blue':'purple'}" style="min-width:24px;text-align:center;">${g}${pos+1}</span>
                <span style="flex:1;">${escHtml(t.name)}</span>
                <span style="font-size:10px;color:var(--muted);">${escHtml(t.p1)}${t.p2?' / '+escHtml(t.p2):''}</span>
                <span style="font-size:14px;color:#cbd5e1;cursor:grab;">⠿</span>`;
            div.addEventListener('dragstart', e => {
                grpDragSrc = { tidx, group: g };
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => div.style.opacity = '.4', 0);
            });
            div.addEventListener('dragend', () => { div.style.opacity = '1'; });
            el.appendChild(div);
        });

        el.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.style.background = '#f0f4ff'; });
        el.addEventListener('dragleave', () => { el.style.background = ''; });
        el.addEventListener('drop', e => {
            e.preventDefault();
            el.style.background = '';
            if (!grpDragSrc || grpDragSrc.group === g) return;
            const srcG   = grpDragSrc.group;
            const srcIdx = grpGroups[srcG].indexOf(grpDragSrc.tidx);
            // Swap with first slot in target
            const tgtTidx = grpGroups[g][0];
            grpGroups[srcG][srcIdx] = tgtTidx;
            grpGroups[g][0]         = grpDragSrc.tidx;
            grpDragSrc = null;
            grpRenderGroupDraw();
            grpBuildSchedule();
        });
    });
}

// ── Schedule Builder ─────────────────────────────────────────
function grpBuildSchedule() {
    const matchMin  = parseInt(document.getElementById('grpMatchTime')?.value)   || 16;
    const pauseMin  = parseInt(document.getElementById('grpPause')?.value)        || 3;
    const startStr  = document.getElementById('grpStartTime')?.value             || '14:30';
    const [sh, sm]  = startStr.split(':').map(Number);
    let cursor      = sh * 60 + sm;
    const slotMin   = matchMin + pauseMin;
    const cNames    = grpReadCourtNames();

    function toTime(m) {
        return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
    }

    grpSchedule = { matches: [], phases: [] };

    // ── Phase 1: Round-Robin ──────────────────────────────────
    function rrPairs(arr) {
        const p = [];
        for (let i=0;i<arr.length;i++)
            for (let j=i+1;j<arr.length;j++)
                p.push([arr[i],arr[j]]);
        return p;
    }
    const pairsA = rrPairs(grpGroups.A);
    const pairsB = rrPairs(grpGroups.B);
    const p1Start = cursor;
    const p1Matches = [];
    for (let r=0;r<6;r++) {
        const tStart = cursor;
        const tEnd   = cursor + matchMin;
        [['A',pairsA[r],0],['B',pairsB[r],1]].forEach(([grp,pair,ci]) => {
            p1Matches.push({
                id: `G-${grp}-${r+1}`, phase:1, round:r+1, group:grp,
                t1idx: pair[0], t2idx: pair[1],
                t1name: grpTeams[pair[0]]?.name || '?',
                t2name: grpTeams[pair[1]]?.name || '?',
                court: cNames[ci],
                startTime: toTime(tStart), endTime: toTime(tEnd),
                score: null
            });
        });
        cursor += slotMin;
    }
    cursor -= pauseMin;
    grpSchedule.phases.push({ phase:1, name:'Gruppenphase', matches:p1Matches, startTime:toTime(p1Start), endTime:toTime(cursor) });
    grpSchedule.matches.push(...p1Matches);

    cursor += 5; // phase break

    // ── Phase 2: Halbfinale ───────────────────────────────────
    // SF1: A1 vs B2, SF2: B1 vs A2 (round 1)
    // SF3: A3 vs B4, SF4: B3 vs A4 (round 2)
    const sfDefs = [
        {id:'SF1', ga:'A',ra:1, gb:'B',rb:2},
        {id:'SF2', ga:'B',ra:1, gb:'A',rb:2},
        {id:'SF3', ga:'A',ra:3, gb:'B',rb:4},
        {id:'SF4', ga:'B',ra:3, gb:'A',rb:4},
    ];
    const p2Start = cursor;
    const p2Matches = [];
    [[0,1],[2,3]].forEach(([ia,ib], ri) => {
        const tStart = cursor;
        const tEnd   = cursor + matchMin;
        [sfDefs[ia], sfDefs[ib]].forEach((sf, ci) => {
            p2Matches.push({
                id: sf.id, phase:2, round:ri+1,
                sfRef: { ga:sf.ga, ra:sf.ra, gb:sf.gb, rb:sf.rb },
                label: sf.id,
                court: cNames[ci],
                startTime: toTime(tStart), endTime: toTime(tEnd),
                score: null
            });
        });
        cursor += slotMin;
    });
    cursor -= pauseMin;
    grpSchedule.phases.push({ phase:2, name:'Halbfinale', matches:p2Matches, startTime:toTime(p2Start), endTime:toTime(cursor) });
    grpSchedule.matches.push(...p2Matches);

    cursor += 5;

    // ── Phase 3: Finals ───────────────────────────────────────
    // Round 1: Finale (W SF1 vs W SF2), Spiel 3/4 (L SF1 vs L SF2)
    // Round 2: Spiel 5/6 (W SF3 vs W SF4), Spiel 7/8 (L SF3 vs L SF4)
    const finalDefs = [
        {id:'F12',  label:'🏆 Finale (Platz 1–2)',  fromW:['SF1','SF2'], fromL:null},
        {id:'F34',  label:'Spiel um Platz 3–4',     fromW:null, fromL:['SF1','SF2']},
        {id:'F56',  label:'Spiel um Platz 5–6',     fromW:['SF3','SF4'], fromL:null},
        {id:'F78',  label:'Spiel um Platz 7–8',     fromW:null, fromL:['SF3','SF4']},
    ];
    const p3Start = cursor;
    const p3Matches = [];
    [[0,2],[1,3]].forEach(([ia,ib], ri) => {
        const tStart = cursor;
        const tEnd   = cursor + matchMin;
        [finalDefs[ia], finalDefs[ib]].forEach((f, ci) => {
            p3Matches.push({
                id: f.id, phase:3, round:ri+1,
                label: f.label,
                fromW: f.fromW, fromL: f.fromL,
                court: cNames[ci],
                startTime: toTime(tStart), endTime: toTime(tEnd),
                score: null
            });
        });
        cursor += slotMin;
    });
    cursor -= pauseMin;
    grpSchedule.phases.push({ phase:3, name:'Finalrunde', matches:p3Matches, startTime:toTime(p3Start), endTime:toTime(cursor) });
    grpSchedule.matches.push(...p3Matches);

    grpRenderSchedule();
}

// ── Render Schedule Preview ───────────────────────────────────
function grpRenderSchedule() {
    const container = document.getElementById('grpScheduleContainer');
    if (!container || !grpSchedule) return;
    container.innerHTML = '';
    const phaseColors = ['var(--blue)','#7c3aed','var(--green)'];
    const badgeCls    = ['badge-blue','badge-purple','badge-green'];
    const leftColors  = ['var(--blue)','#7c3aed','var(--green)'];

    grpSchedule.phases.forEach((phase, pi) => {
        const rounds = {};
        phase.matches.forEach(m => {
            if (!rounds[m.round]) rounds[m.round] = [];
            rounds[m.round].push(m);
        });

        const wrap = document.createElement('div');
        wrap.style.marginBottom = '20px';

        let html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <span class="display" style="font-size:16px;font-weight:900;color:${phaseColors[pi]};">Phase ${pi+1}: ${phase.name}</span>
            <span style="font-size:11px;color:var(--muted);">${phase.startTime} – ${phase.endTime}</span>
        </div>`;

        Object.entries(rounds).forEach(([rnum, matches]) => {
            html += `<div style="margin-bottom:8px;">
                <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:5px;">
                    Runde ${rnum} · ${matches[0].startTime}
                </div>`;
            matches.forEach(m => {
                const t1n = m.t1name || (m.sfRef ? `${m.sfRef.ga}${m.sfRef.ra}` : (m.fromW?.[0]||m.fromL?.[0]||'?'));
                const t2n = m.t2name || (m.sfRef ? `${m.sfRef.gb}${m.sfRef.rb}` : (m.fromW?.[1]||m.fromL?.[1]||'?'));
                const isPlaceholder = (pi > 0);
                html += `<div class="match-row" style="border-left:3px solid ${leftColors[pi]};margin-bottom:5px;">
                    <span class="court-tag">C${m.court}</span>
                    <span style="font-size:10px;color:var(--muted);min-width:70px;">${m.startTime}–${m.endTime}</span>
                    ${m.group  ? `<span class="badge ${badgeCls[pi]}" style="font-size:9px;">Gr. ${m.group}</span>` : ''}
                    ${m.label  ? `<span class="badge ${badgeCls[pi]}" style="font-size:9px;">${m.label}</span>` : ''}
                    <span class="match-names ${isPlaceholder?'virt':''}">
                        ${escHtml(t1n)} <span class="vs-tag">VS</span> ${escHtml(t2n)}
                    </span>
                </div>`;
            });
            html += `</div>`;
        });

        wrap.innerHTML = html;
        container.appendChild(wrap);
    });
}

// ── Save Tournament ───────────────────────────────────────────
async function grpSaveTournament() {
    const name = document.getElementById('grpTName')?.value.trim();
    if (!name) { alert('Bitte Turniernamen eingeben.'); return; }
    if (!grpSchedule) { alert('Bitte erst Bracket generieren.'); return; }

    const btn = document.getElementById('grpSaveBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Speichern...'; }

    const pw      = document.getElementById('grpTPassword')?.value.trim() || '';
    const expEl   = document.getElementById('grpExpiryEnabled');
    const expDate = expEl?.checked ? (document.getElementById('grpExpiryDate')?.value ? new Date(document.getElementById('grpExpiryDate').value).toISOString() : null) : null;

    const payload = {
        tournament_type: 'groups',
        password: pw || null,
        expiry_date: expDate,
        settings: {
            matchTime:   parseInt(document.getElementById('grpMatchTime')?.value) || 16,
            pauseTime:   parseInt(document.getElementById('grpPause')?.value) || 3,
            courts:      parseInt(document.getElementById('grpCourts')?.value) || 2,
            startTime:   document.getElementById('grpStartTime')?.value || '14:30',
            courtHours:  parseFloat(document.getElementById('grpCourtHours')?.value) || 5,
            court1Name:  document.getElementById('grpCourt1Name')?.value || '1',
            court2Name:  document.getElementById('grpCourt2Name')?.value || '2',
        },
        teams: grpTeams,
        groups: grpGroups,
        schedule: grpSchedule,
    };

    try {
        const { error } = await supabaseClient.from('tournaments').upsert({
            id: name,
            data: payload,
            tournament_type: 'groups',
            expiry_date: expDate
        });
        if (error) throw error;

        document.getElementById('lastActionTime').textContent =
            `Gespeichert: ${new Date().toLocaleTimeString('de-DE')}`;

        const liveUrl = `live-groups.html?id=${encodeURIComponent(name)}`;
        alert(`✅ "${name}" gespeichert!\n\nLive-Link:\n${liveUrl}`);

        // Reload tournament list
        if (typeof init === 'function') init();

    } catch(e) {
        alert('Fehler beim Speichern: ' + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '✅ Gruppen-Turnier speichern'; }
    }
}

// ── Load Gruppen-Turnier (from loadTournament) ────────────────
function grpLoadTournament(d, id) {
    // Switch to groups mode
    switchMode('groups');
    document.getElementById('grpTName').value = id;
    document.getElementById('grpTPassword').value = d.password || '';

    // Settings
    if (d.settings) {
        const s = d.settings;
        if (s.matchTime)  document.getElementById('grpMatchTime').value  = s.matchTime;
        if (s.pauseTime)  document.getElementById('grpPause').value      = s.pauseTime;
        if (s.courts)     document.getElementById('grpCourts').value     = s.courts;
        if (s.startTime)  document.getElementById('grpStartTime').value  = s.startTime;
        if (s.courtHours) document.getElementById('grpCourtHours').value = s.courtHours;
        if (s.court1Name) document.getElementById('grpCourt1Name').value = s.court1Name;
        if (s.court2Name) document.getElementById('grpCourt2Name').value = s.court2Name;
    }

    // Expiry
    if (d.expiry_date) {
        document.getElementById('grpExpiryEnabled').checked = true;
        grpToggleExpiry();
        const dateObj = new Date(d.expiry_date);
        const localISO = new Date(dateObj.getTime() - dateObj.getTimezoneOffset()*60000).toISOString().slice(0,16);
        document.getElementById('grpExpiryDate').value = localISO;
    }

    // Teams
    if (d.teams?.length) {
        grpTeams = d.teams;
        grpBuildTeamInputs();
    }

    // Groups + Schedule
    if (d.groups) grpGroups = d.groups;
    if (d.schedule) {
        grpSchedule = d.schedule;
        grpRenderGroupDraw();
        grpRenderSchedule();
        document.getElementById('grpBracketArea').classList.remove('hidden');
    }

    grpRecalc();
}

// ── Toggle helpers ────────────────────────────────────────────
function grpTogglePw() {
    const el = document.getElementById('grpTPassword');
    if (!el) return;
    el.type = el.type === 'password' ? 'text' : 'password';
}

function grpToggleExpiry() {
    const enabled = document.getElementById('grpExpiryEnabled')?.checked;
    document.getElementById('grpExpiryDateSection')?.classList.toggle('hidden', !enabled);
}
