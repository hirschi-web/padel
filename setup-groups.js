// ============================================================
// PADEL HIRSCH - GRUPPEN SYSTEM  v2.0
// Group Stage + Playoff Tournament (8 Teams, 2 Groups)
// ============================================================
// Nutzt supabaseClient aus setup-functions.js

// ── State ────────────────────────────────────────────────────
let grpTeams    = [];
let grpGroups   = { A: [], B: [] };
let grpSchedule = null;
let grpDragSrc  = null;

// ── Auto-name from players ────────────────────────────────────
function grpTeamName(t) {
    if (!t) return '?';
    const p1 = t.p1 || `Spieler ${(t.id||0)*2+1}`;
    const p2 = t.p2 || `Spieler ${(t.id||0)*2+2}`;
    return `${p1} / ${p2}`;
}

// ── Init ─────────────────────────────────────────────────────
function grpInit() {
    grpBuildTeamInputs();
    grpUpdateCourtNames();
    grpRecalc();
}

// ── Team Inputs (no team name field) ─────────────────────────
function grpBuildTeamInputs() {
    const list = document.getElementById('grpTeamList');
    if (!list) return;
    list.innerHTML = '';
    for (let i = 0; i < 8; i++) {
        const div = document.createElement('div');
        div.className = 'grp-team-row';
        div.style.cssText = 'display:grid; grid-template-columns:auto 1fr 1fr; gap:8px; align-items:center;';
        div.innerHTML = `
            <span class="badge badge-blue display" style="min-width:24px;text-align:center;font-size:12px;">${i+1}</span>
            <input type="text" id="grpTeam${i}P1"
                   placeholder="Spieler A"
                   value="${escHtml(grpTeams[i]?.p1||'')}"
                   style="margin:0;font-size:12px;" oninput="grpSyncTeams()">
            <input type="text" id="grpTeam${i}P2"
                   placeholder="Spieler B"
                   value="${escHtml(grpTeams[i]?.p2||'')}"
                   style="margin:0;font-size:12px;" oninput="grpSyncTeams()">`;
        list.appendChild(div);
    }
}

function grpSyncTeams() {
    grpTeams = [];
    for (let i = 0; i < 8; i++) {
        const p1 = (document.getElementById(`grpTeam${i}P1`)?.value || '').trim();
        const p2 = (document.getElementById(`grpTeam${i}P2`)?.value || '').trim();
        grpTeams.push({
            id:   i,
            p1:   p1 || `Spieler ${i*2+1}`,
            p2:   p2 || `Spieler ${i*2+2}`,
            name: p1 && p2 ? `${p1} / ${p2}` : (p1 || `Team ${i+1}`),
        });
    }
    grpRecalc();
}

// ── Court Names ───────────────────────────────────────────────
function grpUpdateCourtNames() {
    const n   = parseInt(document.getElementById('grpCourts')?.value) || 2;
    const sec = document.getElementById('grpCourtNamesSection');
    if (sec) sec.classList.toggle('hidden', n < 2);
}

function grpReadCourtNames() {
    return [
        document.getElementById('grpCourt1Name')?.value.trim() || '1',
        document.getElementById('grpCourt2Name')?.value.trim() || '2',
    ];
}

// ── Time Proposal (live recalc) ───────────────────────────────
function grpRecalc() {
    grpUpdateCourtNames();
    const matchMin  = parseInt(document.getElementById('grpMatchTime')?.value)    || 16;
    const pauseMin  = parseInt(document.getElementById('grpPause')?.value)         || 3;
    const startStr  = document.getElementById('grpStartTime')?.value              || '14:30';
    const courtHrs  = parseFloat(document.getElementById('grpCourtHours')?.value)  || 5;
    const slotMin   = matchMin + pauseMin;
    const totalAvail= courtHrs * 60;

    const p1Min      = 6 * slotMin - pauseMin;
    const p2Min      = 2 * slotMin - pauseMin;
    const p3Min      = 2 * slotMin - pauseMin;
    const phasePause = 5;
    const totalMin   = p1Min + phasePause + p2Min + phasePause + p3Min;

    const [sh, sm] = startStr.split(':').map(Number);
    const s0 = sh*60+sm;

    function tt(m) {
        return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
    }

    const p1End   = s0 + p1Min;
    const p2Start = p1End + phasePause;
    const p2End   = p2Start + p2Min;
    const p3Start = p2End + phasePause;
    const p3End   = p3Start + p3Min;
    const fits    = totalMin <= totalAvail;
    const buffer  = totalAvail - totalMin;

    const box = document.getElementById('grpTimeProposal');
    if (!box) return;

    box.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px;">
            <div class="stat-card">
                <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:4px;">Phase 1 · Gruppenphase</div>
                <div class="display" style="font-size:28px;font-weight:900;color:var(--blue);line-height:1;">6</div>
                <div style="font-size:9px;color:var(--muted);">Runden · 12 Matches</div>
                <div style="font-size:11px;font-weight:700;margin-top:6px;">${tt(s0)} → ${tt(p1End)}</div>
                <div style="font-size:9px;color:var(--muted);">~${p1Min} Min</div>
            </div>
            <div class="stat-card">
                <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:4px;">Phase 2 · Halbfinale</div>
                <div class="display" style="font-size:28px;font-weight:900;color:#7c3aed;line-height:1;">2</div>
                <div style="font-size:9px;color:var(--muted);">Runden · 4 Matches</div>
                <div style="font-size:11px;font-weight:700;margin-top:6px;">${tt(p2Start)} → ${tt(p2End)}</div>
                <div style="font-size:9px;color:var(--muted);">~${p2Min} Min</div>
            </div>
            <div class="stat-card">
                <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:4px;">Phase 3 · Finals</div>
                <div class="display" style="font-size:28px;font-weight:900;color:var(--green);line-height:1;">2</div>
                <div style="font-size:9px;color:var(--muted);">Runden · je 2 parallel</div>
                <div style="font-size:11px;font-weight:700;margin-top:6px;">${tt(p3Start)} → ${tt(p3End)}</div>
                <div style="font-size:9px;color:var(--muted);">~${p3Min} Min</div>
            </div>
        </div>
        <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:10px;padding:9px 14px;font-size:11px;font-weight:600;color:#92400e;margin-bottom:10px;">
            🏆 <strong>Letzter Slot:</strong> Finale (Pl. 1/2) + Kleines Finale (Pl. 3/4) gleichzeitig · davor: Pl. 5/6 + 7/8 parallel
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;
                    padding:12px 14px;border-radius:12px;
                    background:${fits?'#f0fdf4':'#fef2f2'};border:1.5px solid ${fits?'#bbf7d0':'#fecaca'};">
            <div>
                <span style="font-size:11px;font-weight:700;color:${fits?'var(--green)':'var(--red)'};">
                    ${fits?'✅ Passt in Buchungszeit':'⚠️ Überschreitung!'}
                </span>
                <span style="font-size:11px;color:var(--muted);margin-left:10px;">
                    Ende: <strong>${tt(p3End)}</strong> · Buchung bis: <strong>${tt(s0+totalAvail)}</strong>
                </span>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <span class="badge badge-slate">Gesamt ${totalMin} Min</span>
                <span class="badge ${fits?'badge-green':'badge-red'}">Puffer ${buffer} Min</span>
                <span class="badge badge-blue">5 Spiele/Team</span>
                <span class="badge badge-purple">${matchMin}+${pauseMin} Min</span>
            </div>
        </div>`;
}

// ── Generate ──────────────────────────────────────────────────
function grpGenerate() {
    grpSyncTeams();
    const errBox  = document.getElementById('grpInputError');
    const missing = grpTeams.filter(t => !t.p1 && !t.p2).length;
    if (missing > 0) {
        errBox.textContent = 'Bitte mindestens Spieler A für alle 8 Teams eintragen.';
        errBox.classList.remove('hidden');
        return;
    }
    errBox.classList.add('hidden');

    const idx = [0,1,2,3,4,5,6,7];
    for (let i = idx.length-1; i > 0; i--) {
        const j = Math.floor(Math.random()*(i+1));
        [idx[i],idx[j]] = [idx[j],idx[i]];
    }
    grpGroups = { A: idx.slice(0,4), B: idx.slice(4,8) };

    grpRenderGroupDraw();
    grpBuildSchedule();
    document.getElementById('grpBracketArea').classList.remove('hidden');
    document.getElementById('grpBracketArea').scrollIntoView({ behavior:'smooth', block:'start' });
}

// ── Group Draw + Drag & Drop ──────────────────────────────────
function grpRenderGroupDraw() {
    ['A','B'].forEach(g => {
        const el = document.getElementById(`grpGroup${g}Teams`);
        if (!el) return;
        el.innerHTML = '';

        grpGroups[g].forEach((tidx, pos) => {
            const t   = grpTeams[tidx];
            const div = document.createElement('div');
            div.draggable     = true;
            div.dataset.tidx  = tidx;
            div.dataset.group = g;
            div.style.cssText = `
                display:flex;align-items:center;gap:8px;padding:8px 10px;background:white;
                border:1.5px solid #e2e8f0;border-radius:8px;cursor:grab;user-select:none;
                font-size:12px;font-weight:600;transition:box-shadow .15s,opacity .15s;`;
            div.innerHTML = `
                <span class="badge badge-${g==='A'?'blue':'purple'}" style="min-width:24px;text-align:center;">${g}${pos+1}</span>
                <span style="flex:1;">${escHtml(grpTeamName(t))}</span>
                <span style="font-size:14px;color:#cbd5e1;">⠿</span>`;

            div.addEventListener('dragstart', e => {
                grpDragSrc = { tidx, group: g };
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => div.style.opacity = '.4', 0);
            });
            div.addEventListener('dragend', () => { div.style.opacity = '1'; });
            el.appendChild(div);
        });

        el.addEventListener('dragover',  e => { e.preventDefault(); el.style.background = g==='A'?'#eff6ff':'#f5f3ff'; });
        el.addEventListener('dragleave', () => { el.style.background = ''; });
        el.addEventListener('drop', e => {
            e.preventDefault();
            el.style.background = '';
            if (!grpDragSrc || grpDragSrc.group === g) return;
            const srcG    = grpDragSrc.group;
            const srcIdx  = grpGroups[srcG].indexOf(grpDragSrc.tidx);
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
// Phase 3 layout:
//   Runde 1 (vorletzter Slot): Pl. 5/6 + Pl. 7/8  (aus SF3 / SF4)
//   Runde 2 (letzter Slot):    Pl. 3/4 + 🏆 Finale (aus SF1 / SF2)
function grpBuildSchedule() {
    const matchMin = parseInt(document.getElementById('grpMatchTime')?.value) || 16;
    const pauseMin = parseInt(document.getElementById('grpPause')?.value)     || 3;
    const startStr = document.getElementById('grpStartTime')?.value           || '14:30';
    const [sh, sm] = startStr.split(':').map(Number);
    let cursor     = sh*60+sm;
    const slotMin  = matchMin + pauseMin;
    const cNames   = grpReadCourtNames();

    function tt(m) {
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
    const pairsA   = rrPairs(grpGroups.A);
    const pairsB   = rrPairs(grpGroups.B);
    const p1Start  = cursor;
    const p1Matches = [];

    for (let r=0; r<6; r++) {
        const tStart = cursor;
        const tEnd   = cursor + matchMin;
        [['A',pairsA[r],0],['B',pairsB[r],1]].forEach(([grp,pair,ci]) => {
            p1Matches.push({
                id:`G-${grp}-${r+1}`, phase:1, round:r+1, group:grp,
                t1idx:  pair[0], t2idx:  pair[1],
                t1name: grpTeamName(grpTeams[pair[0]]),
                t2name: grpTeamName(grpTeams[pair[1]]),
                court:  cNames[ci],
                startTime: tt(tStart), endTime: tt(tEnd),
                score: null
            });
        });
        cursor += slotMin;
    }
    cursor -= pauseMin;
    grpSchedule.phases.push({ phase:1, name:'Gruppenphase', matches:p1Matches, startTime:tt(p1Start), endTime:tt(cursor) });
    grpSchedule.matches.push(...p1Matches);
    cursor += 5;

    // ── Phase 2: Halbfinale ───────────────────────────────────
    // R1: SF1 (A1 vs B2)  +  SF2 (B1 vs A2)
    // R2: SF3 (A3 vs B4)  +  SF4 (B3 vs A4)
    const sfDefs = [
        {id:'SF1', ga:'A',ra:1, gb:'B',rb:2},
        {id:'SF2', ga:'B',ra:1, gb:'A',rb:2},
        {id:'SF3', ga:'A',ra:3, gb:'B',rb:4},
        {id:'SF4', ga:'B',ra:3, gb:'A',rb:4},
    ];
    const p2Start   = cursor;
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
                startTime: tt(tStart), endTime: tt(tEnd),
                score: null
            });
        });
        cursor += slotMin;
    });
    cursor -= pauseMin;
    grpSchedule.phases.push({ phase:2, name:'Halbfinale', matches:p2Matches, startTime:tt(p2Start), endTime:tt(cursor) });
    grpSchedule.matches.push(...p2Matches);
    cursor += 5;

    // ── Phase 3: Finals ───────────────────────────────────────
    const p3Start   = cursor;
    const p3Matches = [];

    // Runde 1: Pl. 5/6 (W SF3 vs W SF4) + Pl. 7/8 (L SF3 vs L SF4)
    const ts1 = cursor, te1 = cursor + matchMin;
    p3Matches.push({
        id:'F56', phase:3, round:1, label:'Spiel um Platz 5–6',
        fromW:['SF3','SF4'], fromL:null,
        court:cNames[0], startTime:tt(ts1), endTime:tt(te1), score:null
    });
    p3Matches.push({
        id:'F78', phase:3, round:1, label:'Spiel um Platz 7–8',
        fromW:null, fromL:['SF3','SF4'],
        court:cNames[1], startTime:tt(ts1), endTime:tt(te1), score:null
    });
    cursor += slotMin;

    // Runde 2 (LETZTER SLOT): Pl. 3/4 + 🏆 Finale
    const ts2 = cursor, te2 = cursor + matchMin;
    p3Matches.push({
        id:'F34', phase:3, round:2, label:'Spiel um Platz 3–4',
        fromW:null, fromL:['SF1','SF2'],
        court:cNames[1], startTime:tt(ts2), endTime:tt(te2), score:null
    });
    p3Matches.push({
        id:'F12', phase:3, round:2, label:'🏆 Finale (Platz 1–2)',
        fromW:['SF1','SF2'], fromL:null, isFinale:true,
        court:cNames[0], startTime:tt(ts2), endTime:tt(te2), score:null
    });
    cursor = te2;

    grpSchedule.phases.push({ phase:3, name:'Finalrunde', matches:p3Matches, startTime:tt(p3Start), endTime:tt(cursor) });
    grpSchedule.matches.push(...p3Matches);

    grpRenderSchedule();
    grpRenderFairnessStats();
}

// ── Render Schedule ───────────────────────────────────────────
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
            const isLastSlot = (pi===2 && parseInt(rnum)===2);
            html += `<div style="margin-bottom:8px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                    <span style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);">
                        Runde ${rnum} · ${matches[0].startTime}
                    </span>
                    ${isLastSlot?'<span class="badge badge-amber">⏱️ Letzter Slot · Finale</span>':''}
                </div>`;

            matches.forEach(m => {
                const t1n = m.t1name
                    || (m.sfRef ? `${m.sfRef.ga}${m.sfRef.ra}` : (m.fromW?.[0]||m.fromL?.[0]||'?'));
                const t2n = m.t2name
                    || (m.sfRef ? `${m.sfRef.gb}${m.sfRef.rb}` : (m.fromW?.[1]||m.fromL?.[1]||'?'));
                const isPlaceholder = (pi > 0);
                const isFinale      = !!m.isFinale;
                const rowBg         = isFinale ? 'background:#fffbeb;' : '';
                const borderColor   = isFinale ? 'var(--amber)' : leftColors[pi];

                html += `<div class="match-row" style="border-left:3px solid ${borderColor};${rowBg}margin-bottom:5px;">
                    <span class="court-tag">C${m.court}</span>
                    <span style="font-size:10px;color:var(--muted);min-width:70px;">${m.startTime}–${m.endTime}</span>
                    ${m.group ? `<span class="badge ${badgeCls[pi]}" style="font-size:9px;">Gr. ${m.group}</span>` : ''}
                    ${m.label ? `<span class="badge ${isFinale?'badge-amber':badgeCls[pi]}" style="font-size:9px;">${m.label}</span>` : ''}
                    <span class="match-names ${isPlaceholder&&!m.t1name?'virt':''}">
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

// ── Fairness Stats ────────────────────────────────────────────
function grpRenderFairnessStats() {
    const container = document.getElementById('grpFairnessContainer');
    if (!container || !grpSchedule) return;

    const n        = 8;
    const p1m      = grpSchedule.matches.filter(m => m.phase === 1);
    const plays    = new Array(n).fill(0);
    const opponents = Array.from({length:n}, () => new Array(n).fill(0));

    p1m.forEach(m => {
        plays[m.t1idx]++;
        plays[m.t2idx]++;
        opponents[m.t1idx][m.t2idx]++;
        opponents[m.t2idx][m.t1idx]++;
    });

    const allSame = plays.every(p => p === plays[0]);

    // ── Plays per team cards ──────────────────────────────────
    const playsHtml = grpTeams.map((t,i) => {
        const g = grpGroups.A.includes(i) ? 'A' : 'B';
        return `<div class="stat-card" style="text-align:center;">
            <div style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;
                        letter-spacing:.04em;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;
                        white-space:nowrap;" title="${escHtml(grpTeamName(t))}">${escHtml(grpTeamName(t).substring(0,18))}</div>
            <div class="display" style="font-size:24px;font-weight:900;color:var(--blue);line-height:1;">${plays[i]}<span style="font-size:11px;color:var(--muted);"> GP</span></div>
            <div style="font-size:10px;color:var(--muted);margin-top:2px;">+2 K.O. = <strong>5</strong> total</div>
            <span class="badge badge-${g==='A'?'blue':'purple'}" style="margin-top:5px;font-size:8px;">Gruppe ${g}</span>
        </div>`;
    }).join('');

    // ── Opponent matrix ───────────────────────────────────────
    let hasDouble = false;
    let matrixHtml = `<div style="overflow-x:auto;"><table style="border-collapse:collapse;font-size:9px;width:100%;">
        <thead><tr>
            <th style="padding:4px 6px;min-width:72px;"></th>
            ${grpTeams.map((t,i) => {
                const g     = grpGroups.A.includes(i) ? 'A' : 'B';
                const short = grpTeamName(t).split('/')[0].trim().substring(0,6);
                return `<th style="padding:4px 5px;min-width:34px;font-weight:800;color:var(--muted);font-size:8px;text-align:center;" title="${escHtml(grpTeamName(t))}">${escHtml(short)}<br><span style="color:${g==='A'?'var(--blue)':'#7c3aed'};">${g}</span></th>`;
            }).join('')}
        </tr></thead><tbody>`;

    grpTeams.forEach((t, i) => {
        const gi    = grpGroups.A.includes(i) ? 'A' : 'B';
        const short = grpTeamName(t).split('/')[0].trim().substring(0,9);
        matrixHtml += `<tr>
            <td style="padding:4px 6px;font-weight:800;color:var(--slate);font-size:8px;text-align:right;padding-right:8px;white-space:nowrap;">
                ${escHtml(short)} <span style="color:${gi==='A'?'var(--blue)':'#7c3aed'};">${gi}</span>
            </td>`;

        grpTeams.forEach((_, j) => {
            if (i === j) {
                matrixHtml += `<td style="padding:4px;text-align:center;background:#f1f5f9;color:#cbd5e1;border-radius:4px;">—</td>`;
                return;
            }
            const sameGrp = (grpGroups.A.includes(i) && grpGroups.A.includes(j))
                         || (grpGroups.B.includes(i) && grpGroups.B.includes(j));
            const cnt = opponents[i][j];

            let bg, color, label, title;
            if (!sameGrp) {
                bg='#f8fafc'; color='#cbd5e1';
                label='—'; title='Andere Gruppe – treffen sich ggf. in K.O.';
            } else if (cnt === 1) {
                bg='#f0fdf4'; color='var(--green)';
                label='1×'; title='1× Gegner ✅';
            } else if (cnt > 1) {
                bg='#fef2f2'; color='var(--red)';
                label=`${cnt}×`; title=`${cnt}× Gegner ⚠️`;
                hasDouble = true;
            } else {
                bg='#fff7ed'; color='var(--amber)';
                label='0'; title='Kein Gruppenspiel?';
            }
            matrixHtml += `<td style="padding:4px;text-align:center;background:${bg};color:${color};border-radius:4px;font-weight:700;font-size:9px;" title="${title}">${label}</td>`;
        });
        matrixHtml += `</tr>`;
    });

    matrixHtml += `</tbody></table>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;font-size:9px;font-weight:700;color:var(--muted);">
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#f0fdf4;border:1px solid #bbf7d0;margin-right:3px;"></span>1× Gegner ✅</span>
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#fef2f2;border:1px solid #fecaca;margin-right:3px;"></span>2×+ Überschneidung ⚠️</span>
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#f8fafc;border:1px solid #e2e8f0;margin-right:3px;"></span>— Andere Gruppe</span>
        </div></div>`;

    // ── Summary checks ────────────────────────────────────────
    const checks = [
        {
            ok: allSame,
            text: allSame
                ? `Alle Teams spielen genau ${plays[0]}× in der Gruppenphase`
                : `⚠️ Ungleiche Spielanzahl: ${[...new Set(plays)].join(', ')}×`
        },
        {
            ok: !hasDouble,
            text: !hasDouble
                ? 'Jedes Team trifft jeden Gruppengegner genau 1×'
                : 'Mind. 1 Team trifft einen Gegner 2× in der Gruppe – Auslosung neu generieren'
        },
        {
            ok: true,
            text: 'Jedes Team spielt garantiert 5 Matches (3 Gruppe + 1 Halbfinale + 1 Finalrunde)',
            always: true
        },
        {
            ok: true,
            text: 'Letzter Slot: 🏆 Finale + Spiel Pl. 3/4 gleichzeitig auf beiden Courts',
            always: true
        },
    ];

    const checksHtml = checks.map(c => `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 12px;border-radius:8px;
                    background:${c.ok?'#f0fdf4':'#fef2f2'};border:1.5px solid ${c.ok?'#bbf7d0':'#fecaca'};">
            <span style="font-size:13px;flex-shrink:0;">${c.ok?'✅':'⚠️'}</span>
            <span style="font-size:11px;font-weight:700;color:${c.ok?'var(--green)':'var(--red)'};">${c.text}</span>
        </div>`).join('');

    container.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:18px;">
            <p class="lbl" style="margin-bottom:8px;">✅ Fairness-Check</p>
            ${checksHtml}
        </div>
        <div style="margin-bottom:18px;">
            <p class="lbl" style="margin-bottom:10px;">🏃 Spiele pro Team (Gruppenphase)</p>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">${playsHtml}</div>
        </div>
        <div>
            <p class="lbl" style="margin-bottom:10px;">🤝 Gegner-Matrix Gruppenphase</p>
            <p style="font-size:10px;color:var(--muted);margin-bottom:8px;">Zeigt nur Gruppenphase – K.O. Paarungen folgen nach Gruppenrangliste.</p>
            <div style="background:white;border-radius:10px;padding:12px;">${matrixHtml}</div>
        </div>`;

    // Warn if double opponent
    if (hasDouble) {
        const warn = document.createElement('div');
        warn.className = 'alert alert-warn';
        warn.style.marginTop = '12px';
        warn.innerHTML = '⚠️ Überschneidung erkannt – klicke <strong>Gruppen auslosen</strong> nochmals für eine neue zufällige Auslosung.';
        container.appendChild(warn);
    }
}

// ── Save ──────────────────────────────────────────────────────
async function grpSaveTournament() {
    const name = document.getElementById('grpTName')?.value.trim();
    if (!name)        { alert('Bitte Turniernamen eingeben.'); return; }
    if (!grpSchedule) { alert('Bitte erst Bracket generieren.'); return; }

    const btn = document.getElementById('grpSaveBtn');
    if (btn) { btn.disabled=true; btn.textContent='Speichern...'; }

    const pw      = document.getElementById('grpTPassword')?.value.trim() || '';
    const expEl   = document.getElementById('grpExpiryEnabled');
    const expDate = expEl?.checked
        ? (document.getElementById('grpExpiryDate')?.value
            ? new Date(document.getElementById('grpExpiryDate').value).toISOString() : null)
        : null;

    const payload = {
        tournament_type: 'groups',
        password: pw || null,
        expiry_date: expDate,
        settings: {
            matchTime:  parseInt(document.getElementById('grpMatchTime')?.value)      || 16,
            pauseTime:  parseInt(document.getElementById('grpPause')?.value)          || 3,
            courts:     parseInt(document.getElementById('grpCourts')?.value)         || 2,
            startTime:  document.getElementById('grpStartTime')?.value               || '14:30',
            courtHours: parseFloat(document.getElementById('grpCourtHours')?.value)   || 5,
            court1Name: document.getElementById('grpCourt1Name')?.value              || '1',
            court2Name: document.getElementById('grpCourt2Name')?.value              || '2',
        },
        teams: grpTeams, groups: grpGroups, schedule: grpSchedule,
    };

    try {
        const { error } = await supabaseClient.from('tournaments').upsert({
            id: name, data: payload, tournament_type: 'groups', expiry_date: expDate
        });
        if (error) throw error;
        document.getElementById('lastActionTime').textContent =
            `Gespeichert: ${new Date().toLocaleTimeString('de-DE')}`;
        alert(`✅ "${name}" gespeichert!\n\nLive-Link:\nlive-groups.html?id=${encodeURIComponent(name)}`);
        if (typeof init === 'function') init();
    } catch(e) {
        alert('Fehler beim Speichern: ' + e.message);
    } finally {
        if (btn) { btn.disabled=false; btn.textContent='✅ Gruppen-Turnier speichern'; }
    }
}

// ── Load ──────────────────────────────────────────────────────
function grpLoadTournament(d, id) {
    switchMode('groups');
    document.getElementById('grpTName').value     = id;
    document.getElementById('grpTPassword').value = d.password || '';
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
    if (d.expiry_date) {
        document.getElementById('grpExpiryEnabled').checked = true;
        grpToggleExpiry();
        const dateObj  = new Date(d.expiry_date);
        const localISO = new Date(dateObj.getTime() - dateObj.getTimezoneOffset()*60000).toISOString().slice(0,16);
        document.getElementById('grpExpiryDate').value = localISO;
    }
    if (d.teams?.length) { grpTeams = d.teams; grpBuildTeamInputs(); }
    if (d.groups)   grpGroups   = d.groups;
    if (d.schedule) {
        grpSchedule = d.schedule;
        grpRenderGroupDraw();
        grpRenderSchedule();
        grpRenderFairnessStats();
        document.getElementById('grpBracketArea').classList.remove('hidden');
    }
    grpRecalc();
}

// ── Toggle helpers ────────────────────────────────────────────
function grpTogglePw() {
    const el = document.getElementById('grpTPassword');
    if (el) el.type = el.type === 'password' ? 'text' : 'password';
}
function grpToggleExpiry() {
    const enabled = document.getElementById('grpExpiryEnabled')?.checked;
    document.getElementById('grpExpiryDateSection')?.classList.toggle('hidden', !enabled);
}
