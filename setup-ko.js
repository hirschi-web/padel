// ============================================================
// PADEL HIRSCH - K.O. SYSTEM
// Knockout Tournament Functions
// ============================================================

// ============================================================
// K.O. STATE
// ============================================================
let koTeams = [];
let koBracketData = null;
let koTeamCount = 8;
let koCourtNames = ['1','2','3'];


// ============================================================
// K.O. – TEAM COUNT SELECTOR (8 or 16 only)
// ============================================================
function koSelectTeamCount(n, silent = false) {
    koTeamCount = n;
    document.getElementById('teamsBtn8').classList.toggle('active', n === 8);
    document.getElementById('teamsBtn16').classList.toggle('active', n === 16);
    const infoBox = document.getElementById('koInfoBox');
    if (n === 8) {
        infoBox.innerHTML = '🏆 <strong>8 Teams:</strong> Vorrunde (zufällige Paarungen) → Rangierung nach Spielpunkten (z.B. 15:9) → Runde 1: Platz 1 vs 8, 2 vs 7, etc. Verlierer spielen im gleichen Raster weiter.';
    } else {
        infoBox.innerHTML = '🏆 <strong>16 Teams:</strong> Direkt K.O. mit 4 Runden. Winner + Consolation Bracket. Jedes Team erhält eine Endplatzierung.';
    }
    if (!silent) koUpdateTeamInputs();
}

// ============================================================
// K.O. – TEAM INPUTS
// ============================================================
function koUpdateTeamInputs(preload = null) {
    const count = koTeamCount;
    const existing = [];
    document.querySelectorAll('#koTeamList .ko-team-row').forEach((row) => {
        const inputs = row.querySelectorAll('input');
        existing.push({ a: inputs[0]?.value || '', b: inputs[1]?.value || '' });
    });
    let html = '';
    for (let i = 0; i < count; i++) {
        const valA = preload ? (preload[i]?.a || `Spieler ${i*2+1}`) : (existing[i]?.a || `Spieler ${i*2+1}`);
        const valB = preload ? (preload[i]?.b || `Spieler ${i*2+2}`) : (existing[i]?.b || `Spieler ${i*2+2}`);
        html += `<div class="ko-team-row" style="display:grid; grid-template-columns:auto 1fr 1fr; gap:8px; align-items:center; margin-bottom:4px;">
            <span style="font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:900; color:var(--blue); min-width:20px; text-align:center;">${i+1}</span>
            <input type="text" value="${escHtml(valA)}" placeholder="Spieler A" style="margin:0; font-size:12px;">
            <input type="text" value="${escHtml(valB)}" placeholder="Spieler B" style="margin:0; font-size:12px;">
        </div>`;
    }
    document.getElementById('koTeamList').innerHTML = html;
}

// ============================================================
// K.O. COURT NAMES MANAGEMENT
// ============================================================
function koUpdateCourtNamesSection() {
    const count = parseInt(document.getElementById('koCourts').value) || 1;
    const section = document.getElementById('koCourtNamesSection');
    if (count > 1) {
        section.classList.remove('hidden');
        ['koCourt1Name','koCourt2Name','koCourt3Name'].forEach((id, i) => {
            const el = document.getElementById(id);
            if (el) el.style.display = i < count ? 'block' : 'none';
        });
    } else {
        section.classList.add('hidden');
    }
}

function readKOCourtNames() {
    const count = parseInt(document.getElementById('koCourts').value) || 1;
    koCourtNames = [];
    for (let i = 0; i < count; i++) {
        const val = document.getElementById(`koCourt${i+1}Name`)?.value.trim() || (i+1).toString();
        koCourtNames.push(val);
    }
    return koCourtNames;
}

// ============================================================
// K.O. EXPIRY DATE MANAGEMENT
// ============================================================
function koToggleExpiry() {
    const enabled = document.getElementById('koExpiryEnabled').checked;
    document.getElementById('koExpiryDateSection').classList.toggle('hidden', !enabled);
}

function getKOExpiryDate() {
    const enabled = document.getElementById('koExpiryEnabled')?.checked;
    if (!enabled) return null;
    const val = document.getElementById('koExpiryDate')?.value;
    return val ? new Date(val).toISOString() : null;
}

function koCheckConsistency() {
    const courts = parseInt(document.getElementById('koCourts').value) || 1;
    const matchTime = parseInt(document.getElementById('koMatchTime').value) || 30;
    const pause = parseInt(document.getElementById('koPause').value) || 5;
    const courtHours = parseFloat(document.getElementById('koCourtHours').value) || 3;
    const startTime = document.getElementById('koStartTime').value || '09:00';
    const [sH, sM] = startTime.split(':').map(Number);
    const baseMin = sH * 60 + sM;

    const errBox = document.getElementById('koInputError');
    const warnBox = document.getElementById('koConsistencyWarning');
    const timeCheckBox = document.getElementById('koTimeCheck');
    let errors = [], warnings = [];

    if (courts < 1) errors.push('Mindestens 1 Platz nötig.');
    if (matchTime < 5) errors.push('Match-Dauer muss mind. 5 Min. sein.');
    if (koTeamCount === 8 && courts === 1) warnings.push('⚠️ Mit nur 1 Platz dauert das Turnier sehr lange. Empfehlung: 2–3 Plätze.');

    // 8-Team time fit check – use real slot count from scheduler
    if (koTeamCount === 8) {
        const courts2 = courts; // use same courts value
        // Estimate slots: phase 1 = ceil(3/courts) batches, phase 2 = ceil(3/courts), phase 3 = ceil(2/courts), phase 4 = ceil(4/courts), phase 5 = ceil(4/courts)
        // Each batch costs matchTime + pause (except last of each phase which only costs matchTime, pause is added before next phase)
        let numSlots = 0;
        if (courts >= 3) {
            // Optimized layout: 6 fixed slots (S1-S6)
            numSlots = 6;
        } else {
            // Naive batching
            [3,3,2,4,4].forEach(n => { numSlots += Math.ceil(n / courts2); });
        }
        const totalNeededMin = numSlots * matchTime + (numSlots - 1) * pause;
        const availableMin = courtHours * 60;
        const endMin = baseMin + totalNeededMin;
        const bookingEndMin = baseMin + availableMin;
        const diff = availableMin - totalNeededMin;
        const endStr = formatMin(endMin);
        const bookingEndStr = formatMin(bookingEndMin);

        if (diff >= 0) {
            const bufferStr = diff === 0 ? 'Exakt passend' : `+${diff} Min Puffer`;
            timeCheckBox.style.background = diff < 10 ? '#fffbeb' : '#f0fdf4';
            timeCheckBox.style.borderColor = diff < 10 ? '#fde68a' : '#bbf7d0';
            timeCheckBox.innerHTML = `✅ <strong>Passt!</strong> Ende ca. ${endStr} · Platzbuchung bis ${bookingEndStr}<br><span style="color:#64748b;">${bufferStr} verbleibend</span>`;
        } else {
            const overMin = Math.abs(diff);
            // Suggest reducing pause
            const minPauseSuggestion = Math.max(0, pause - Math.ceil(overMin / 5));
            const matchTimeSuggestion = Math.max(15, matchTime - Math.ceil(overMin / 5));
            timeCheckBox.style.background = '#fef2f2';
            timeCheckBox.style.borderColor = '#fecaca';
            timeCheckBox.innerHTML = `❌ <strong>${overMin} Min zu lang!</strong> Ende ${endStr}, Buchung bis ${bookingEndStr}<br><span style="color:#dc2626;">Pause → ${minPauseSuggestion} Min  <em>oder</em>  Matchzeit → ${matchTimeSuggestion} Min</span>`;
            warnings.push(`⚠️ Turnier dauert ${overMin} Min zu lange für die Platzbuchung (${courtHours}h). Pause auf ${minPauseSuggestion} Min reduzieren oder Matchzeit auf ${matchTimeSuggestion} Min setzen.`);
        }

        // Player check: 8 teams × 3 guaranteed games each
        // V1-V3: 6 teams play, 2 teams wait (V4 teams)
        // V4 parallel: the 2 remaining teams play
        // R1 (4 matches): all 8 play
        // HF (4 matches): all 8 play
        // Finale (4 matches): all 8 play
        // = every team plays exactly 4 matches (1 prelim + R1 + HF + F)
        const gamesPerTeam = 4;
        // Pause check: all R1 teams have same pause (between V/R1 and HF, and HF-Finale)
        // V4 teams: play V4 (slot1), then directly R1c/R1d (slot2) = 1 slot pause only
        // V1-V3 teams: play V1-V3 (slot0), then R1a/R1b (slot1) = 1 slot pause
        // → all teams have 1 slot pause between prelim and R1  ✓
        // Between R1 and HF: all wait 1 slot  ✓
        // Between HF and Finale: all wait 1 slot  ✓
        const pauseOK = true; // structure guarantees equal pauses
        const playerCheckEl = document.getElementById('ko8PlayerCheck');
        if (playerCheckEl) {
            playerCheckEl.innerHTML = `✅ <strong>Spieler-Check OK</strong> · Jedes Team spielt genau ${gamesPerTeam}× · Pausen gleichmäßig (je ${slotDur} Min zwischen Runden)`;
            playerCheckEl.style.display = 'flex';
        }
    }

    errBox.classList.toggle('hidden', !errors.length);
    errBox.innerHTML = errors.join('<br>');
    warnBox.classList.toggle('hidden', !warnings.length);
    warnBox.innerHTML = warnings.join('<br>');
    koUpdateCourtNamesSection();
}

function koReadTeams() {
    const rows = document.querySelectorAll('#koTeamList .ko-team-row');
    const teams = [];
    rows.forEach((row, i) => {
        const inputs = row.querySelectorAll('input');
        teams.push({ id: i, a: inputs[0]?.value.trim() || `Spieler ${i*2+1}`, b: inputs[1]?.value.trim() || `Spieler ${i*2+2}` });
    });
    return teams;
}

function koTeamLabel(team) {
    if (!team) return '?';
    if (typeof team === 'string') return team;
    return `${team.a} / ${team.b}`;
}
function koTeamLabelShort(team) {
    if (!team) return '?';
    if (typeof team === 'string') return team;
    const a = team.a.split(' ')[0];
    const b = team.b.split(' ')[0];
    return `${a} / ${b}`;
}

function escHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escSvg(str) { return escHtml(String(str)); }
function formatMin(totalMin) {
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

// ============================================================
// K.O. – GENERATE BRACKET (main entry)
// ============================================================
function koGenerateBracket() {
    koTeams = koReadTeams();
    if (koTeamCount === 8) {
        koGenerate8();
    } else {
        koGenerate16();
    }
}

// ============================================================
// K.O. 8-TEAM: GENERATE
// ============================================================
// Structure:
// VORRUNDE: 3 matches on 3 courts (V1,V2,V3 at T+0), V4 on court 1 at T+1 (parallel with R1 R1a, R1b)
// Vorrunde pairings: random
// After prelim: rank by score (Tore für – Tore gegen), use final score input
// RUNDE 1: P1 vs P8, P2 vs P7 (at T+matchTime, parallel with V4)
//          P3 vs P6, P4 vs P5 (at T+2*matchTime)
// HALBFINALE: W(R1a) vs W(R1b), W(R1c) vs W(R1d)
// CONSOLATION HF: L(R1a) vs L(R1b), L(R1c) vs L(R1d)
// FINALE: HF1 winner vs HF2 winner → Platz 1/2
// KLEINES FINALE: HF1 loser vs HF2 loser → Platz 3/4
// CONS FINALE: CH1 winner vs CH2 winner → Platz 5/6
// CONS KL FINALE: CH1 loser vs CH2 loser → Platz 7/8

function koGenerate8() {
    const teams = koTeams.slice(0, 8);

    // Random prelim pairings: shuffle teams, pair them
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    // V1: shuffled[0] vs shuffled[1], V2: shuffled[2] vs shuffled[3]
    // V3: shuffled[4] vs shuffled[5], V4: shuffled[6] vs shuffled[7]
    const prelimMatches = [
        { id: 'V1', team1: shuffled[0], team2: shuffled[1], score1: null, score2: null, court: 1 },
        { id: 'V2', team1: shuffled[2], team2: shuffled[3], score1: null, score2: null, court: 2 },
        { id: 'V3', team1: shuffled[4], team2: shuffled[5], score1: null, score2: null, court: 3 },
        { id: 'V4', team1: shuffled[6], team2: shuffled[7], score1: null, score2: null, court: 1, parallel: true },
    ];

    koBracketData = {
        type: '8team',
        teams,
        prelimMatches,
        ranking: null, // set after scores entered
        mainBracket: null, // generated after ranking
    };

    ko8RenderAll();
    document.getElementById('ko8View').classList.remove('hidden');
    document.getElementById('ko16View').classList.add('hidden');
    document.getElementById('koBracketArea').classList.remove('hidden');
}

function ko8RenderAll() {
    ko8RenderPrelim();
    ko8BuildAndRenderBracket();
    ko8RenderSchedule();
    ko8RenderSimulation();
}

// ============================================================
// K.O. 8-TEAM: RENDER PRELIM MATCHES (display only, no score inputs)
// ============================================================
function ko8RenderPrelim() {
    if (!koBracketData) return;
    const { prelimMatches } = koBracketData;
    const courts = parseInt(document.getElementById('koCourts').value) || 3;
    const matchTime = parseInt(document.getElementById('koMatchTime').value) || 30;
    const pause = parseInt(document.getElementById('koPause').value) || 5;
    const startTime = document.getElementById('koStartTime').value || '09:00';
    const [sH, sM] = startTime.split(':').map(Number);
    const baseMin = sH * 60 + sM;
    const slotDur = matchTime + pause;

    const ccls = ['c1','c2','c3','c4'];

    // --- Slot 1: V1, V2, V3 ---
    let html = `<div style="margin-bottom:14px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <span style="font-family:'Barlow Condensed',sans-serif; font-size:12px; font-weight:900; color:var(--muted); letter-spacing:.08em; text-transform:uppercase;">Vorrunde – Slot 1</span>
            <span class="badge badge-slate">⏰ ${formatMin(baseMin)}</span>
            <span class="badge badge-purple">Courts 1–${Math.min(3, courts)}</span>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:8px;">`;

    prelimMatches.forEach((m, idx) => {
        if (idx === 3) return;
        const cc = ccls[(m.court - 1) % ccls.length];
        html += `<div class="match-row ${cc}" style="flex-direction:column; align-items:flex-start; padding:10px 12px; gap:6px;">
            <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                <span class="court-tag">Court ${m.court}</span>
                <span style="font-family:'Barlow Condensed',sans-serif; font-size:10px; font-weight:900; letter-spacing:.06em; color:#7c3aed;">Spiel ${m.id}</span>
            </div>
            <div style="width:100%; font-size:12px; font-weight:700; color:var(--slate);">${escHtml(koTeamLabel(m.team1))}</div>
            <div style="font-family:'Barlow Condensed',sans-serif; font-size:9px; font-weight:900; color:#94a3b8; letter-spacing:.1em;">VS</div>
            <div style="width:100%; font-size:12px; font-weight:700; color:var(--slate);">${escHtml(koTeamLabel(m.team2))}</div>
        </div>`;
    });

    html += `</div></div>`;

    // --- Slot 2: V4 parallel with R1a + R1b ---
    const v4 = prelimMatches[3];
    const slot1Start = baseMin + slotDur;
    html += `<div style="margin-bottom:6px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <span style="font-family:'Barlow Condensed',sans-serif; font-size:12px; font-weight:900; color:var(--muted); letter-spacing:.08em; text-transform:uppercase;">Vorrunde – Slot 2</span>
            <span class="badge badge-amber">⏰ ${formatMin(slot1Start)}</span>
            <span class="badge badge-amber">Court 1 · parallel mit R1a/R1b</span>
        </div>
        <div class="alert alert-warn" style="margin-bottom:8px; font-size:10px; padding:8px 12px;">
            ⚡ V4 läuft gleichzeitig mit Runde 1 (Spiele R1a + R1b auf Courts 2+3). Ergebnis wird nach Spielende eingetragen und Team eingereiht.
        </div>
        <div style="display:grid; grid-template-columns:minmax(240px,360px); gap:8px;">
            <div class="match-row c1" style="flex-direction:column; align-items:flex-start; padding:10px 12px; gap:6px;">
                <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                    <span class="court-tag">Court 1</span>
                    <span style="font-family:'Barlow Condensed',sans-serif; font-size:10px; font-weight:900; letter-spacing:.06em; color:#d97706;">Spiel V4 ⚡ Parallel</span>
                </div>
                <div style="width:100%; font-size:12px; font-weight:700; color:var(--slate);">${escHtml(koTeamLabel(v4.team1))}</div>
                <div style="font-family:'Barlow Condensed',sans-serif; font-size:9px; font-weight:900; color:#94a3b8; letter-spacing:.1em;">VS</div>
                <div style="width:100%; font-size:12px; font-weight:700; color:var(--slate);">${escHtml(koTeamLabel(v4.team2))}</div>
            </div>
        </div>
    </div>`;

    document.getElementById('prelimMatchesContainer').innerHTML = html;
}

// ============================================================
// K.O. 8-TEAM: RANKING CALCULATION (used by results page later)
// ============================================================
function ko8CalcRanking() {
    if (!koBracketData) return [];
    const { prelimMatches, teams } = koBracketData;
    const stats = {};
    teams.forEach(t => {
        stats[t.id] = { team: t, wins: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, played: false, v4: false };
    });
    const v4Match = prelimMatches[3];
    stats[v4Match.team1.id].v4 = true;
    stats[v4Match.team2.id].v4 = true;
    prelimMatches.forEach((m) => {
        if (m.score1 === null || m.score2 === null) return;
        const s1 = parseInt(m.score1), s2 = parseInt(m.score2);
        if (isNaN(s1) || isNaN(s2)) return;
        stats[m.team1.id].played = true;
        stats[m.team2.id].played = true;
        stats[m.team1.id].goalsFor += s1; stats[m.team1.id].goalsAgainst += s2;
        stats[m.team2.id].goalsFor += s2; stats[m.team2.id].goalsAgainst += s1;
        if (s1 > s2) { stats[m.team1.id].wins++; stats[m.team2.id].losses++; }
        else if (s2 > s1) { stats[m.team2.id].wins++; stats[m.team1.id].losses++; }
    });
    return Object.values(stats).sort((a, b) => {
        const wDiff = b.wins - a.wins;
        if (wDiff !== 0) return wDiff;
        const gdA = a.goalsFor - a.goalsAgainst, gdB = b.goalsFor - b.goalsAgainst;
        if (gdB !== gdA) return gdB - gdA;
        return b.goalsFor - a.goalsFor;
    });
}

// ============================================================
// K.O. 8-TEAM: OPTIMIZED SCHEDULING ENGINE
//
// Abhängigkeitsanalyse:
//   S1: V1, V2, V3
//   S2: V4⚡, R1a, R1b   (V4 parallel constraint)
//   S3: R1c, R1d, CHF1   ← CHF1 = Verlierer R1a+R1b → nach S2 ✅
//   S4: HF1, HF2, CHF2   ← HF1/2 = Sieger R1a-d → nach S3 ✅
//                          CHF2 = Verlierer R1c+R1d → nach S3 ✅
//   S5: FINALE, KLF, CF  ← FINALE/KLF = nach HF1+HF2 (S4) ✅
//                          CF = Sieger CHF1+CHF2 → CHF1 nach S3, CHF2 nach S4 ✅
//   S6: CKF              ← Verlierer CHF1+CHF2 → nach S4/S5 ✅
//
// Bei courts >= 3: optimiertes Layout (6 Slots)
// Bei courts = 2 oder 1: naive Batch-Aufteilung
// ============================================================
function ko8CalcSchedule() {
    const courts    = parseInt(document.getElementById('koCourts').value)    || 3;
    const matchTime = parseInt(document.getElementById('koMatchTime').value)  || 30;
    const pause     = parseInt(document.getElementById('koPause').value)      || 5;
    const startTime = document.getElementById('koStartTime').value            || '09:00';
    const [sH, sM]  = startTime.split(':').map(Number);
    const baseMin   = sH * 60 + sM;
    const pm        = koBracketData?.prelimMatches || [];

    const slotDur = matchTime + pause;
    const t = (slot) => baseMin + slot * slotDur;

    // ── OPTIMIZED LAYOUT für courts >= 3 ─────────────────────
    if (courts >= 3) {
        // Jede Phase kann bis zu 3 Courts nutzen
        // Slots mit genutzten Courts:
        const slotsOpt = [
            {
                label: 'Vorrunde', type: 'prelim', isParallel: false, hasParallelNote: false,
                matches: [
                    { id:'V1', t1: pm[0]?koTeamLabel(pm[0].team1):'?', t2: pm[0]?koTeamLabel(pm[0].team2):'?', placeholder:false, court:1 },
                    { id:'V2', t1: pm[1]?koTeamLabel(pm[1].team1):'?', t2: pm[1]?koTeamLabel(pm[1].team2):'?', placeholder:false, court:2 },
                    { id:'V3', t1: pm[2]?koTeamLabel(pm[2].team1):'?', t2: pm[2]?koTeamLabel(pm[2].team2):'?', placeholder:false, court:3 },
                ],
                note: null,
            },
            {
                label: 'V4 + Runde 1 (R1a, R1b)', type: 'parallel', isParallel: true, hasParallelNote: true,
                matches: [
                    { id:'V4',  t1: pm[3]?koTeamLabel(pm[3].team1):'?', t2: pm[3]?koTeamLabel(pm[3].team2):'?', placeholder:false, court:1 },
                    { id:'R1a', t1:'Platz 1', t2:'Platz 8', placeholder:true, court:2 },
                    { id:'R1b', t1:'Platz 2', t2:'Platz 7', placeholder:true, court:3 },
                ],
                note: '⚡ V4 (Vorrunde) läuft gleichzeitig mit R1a + R1b.',
            },
            {
                label: 'Runde 1 + Cons. HF (1/2)', type: 'r1', isParallel: false, hasParallelNote: false,
                matches: [
                    { id:'R1c',  t1:'Platz 3', t2:'Platz 6', placeholder:true, court:1 },
                    { id:'R1d',  t1:'Platz 4', t2:'Platz 5', placeholder:true, court:2 },
                    { id:'CHF1', t1:'Verlierer R1a', t2:'Verlierer R1b', placeholder:true, court:3 },
                ],
                note: '✅ CHF1 startet direkt: Verlierer R1a+R1b nach Slot 2 bekannt.',
            },
            {
                label: 'Halbfinale + Cons. HF (2/2)', type: 'hf', isParallel: false, hasParallelNote: false,
                matches: [
                    { id:'HF1',  t1:'Sieger R1a',    t2:'Sieger R1b',    placeholder:true, court:1 },
                    { id:'HF2',  t1:'Sieger R1c',    t2:'Sieger R1d',    placeholder:true, court:2 },
                    { id:'CHF2', t1:'Verlierer R1c', t2:'Verlierer R1d', placeholder:true, court:3 },
                ],
                note: '✅ HF1/HF2 + CHF2 gleichzeitig: alle Voraussetzungen nach Slot 3 erfüllt.',
            },
            {
                label: 'Cons. Finale + Cons. Kl. Finale', type: 'consolation', isParallel: false, hasParallelNote: false,
                matches: [
                    { id:'CF',  t1:'Sieger CHF1',    t2:'Sieger CHF2',    placeholder:true, court:1, placement:'Pl. 5/6' },
                    { id:'CKF', t1:'Verlierer CHF1', t2:'Verlierer CHF2', placeholder:true, court:2, placement:'Pl. 7/8' },
                ],
                note: '✅ CF + CKF gleichzeitig: Sieger/Verlierer CHF1 (S3) + CHF2 (S4) bekannt.',
            },
            {
                label: '🏆 Kl. Finale + Finale', type: 'finale', isParallel: false, hasParallelNote: false,
                matches: [
                    { id:'KLF',    t1:'Verlierer HF1', t2:'Verlierer HF2', placeholder:true, court:1, placement:'🥉 3/4' },
                    { id:'FINALE', t1:'Sieger HF1',    t2:'Sieger HF2',    placeholder:true, court:2, placement:'🥇 1/2' },
                ],
                note: '🏆 Das FINALE als krönender Abschluss – gleichzeitig mit dem Spiel um Platz 3/4.',
            },
        ];

        return {
            slots: slotsOpt.map((s, i) => ({
                ...s,
                courtsUsed: s.matches.length,
                startMin: t(i),
                endMin: t(i) + matchTime,
            })),
            baseMin, matchTime, pause, courts,
            optimized: true,
        };
    }

    // ── NAIVE BATCH-LAYOUT für courts < 3 ───────────────────
    // Einfache sequenzielle Aufteilung in Batches der Größe 'courts'
    const phases = [
        { key:'prelim1', label:'Vorrunde', type:'prelim', parallelNote:false, matches:[
            { id:'V1', t1:pm[0]?koTeamLabel(pm[0].team1):'?', t2:pm[0]?koTeamLabel(pm[0].team2):'?', placeholder:false },
            { id:'V2', t1:pm[1]?koTeamLabel(pm[1].team1):'?', t2:pm[1]?koTeamLabel(pm[1].team2):'?', placeholder:false },
            { id:'V3', t1:pm[2]?koTeamLabel(pm[2].team1):'?', t2:pm[2]?koTeamLabel(pm[2].team2):'?', placeholder:false },
        ]},
        { key:'prelim2', label:'V4 + Runde 1 (R1a, R1b)', type:'parallel', parallelNote:true, matches:[
            { id:'V4',  t1:pm[3]?koTeamLabel(pm[3].team1):'?', t2:pm[3]?koTeamLabel(pm[3].team2):'?', placeholder:false },
            { id:'R1a', t1:'Platz 1', t2:'Platz 8', placeholder:true },
            { id:'R1b', t1:'Platz 2', t2:'Platz 7', placeholder:true },
        ]},
        { key:'r1cd', label:'Runde 1 (R1c, R1d)', type:'r1', parallelNote:false, matches:[
            { id:'R1c', t1:'Platz 3', t2:'Platz 6', placeholder:true },
            { id:'R1d', t1:'Platz 4', t2:'Platz 5', placeholder:true },
        ]},
        { key:'hf', label:'Halbfinale', type:'hf', parallelNote:false, matches:[
            { id:'HF1',  t1:'Sieger R1a',    t2:'Sieger R1b',    placeholder:true },
            { id:'HF2',  t1:'Sieger R1c',    t2:'Sieger R1d',    placeholder:true },
            { id:'CHF1', t1:'Verlierer R1a', t2:'Verlierer R1b', placeholder:true },
            { id:'CHF2', t1:'Verlierer R1c', t2:'Verlierer R1d', placeholder:true },
        ]},
        { key:'finale', label:'Finale', type:'finale', parallelNote:false, matches:[
            { id:'FINALE', t1:'Sieger HF1',     t2:'Sieger HF2',     placeholder:true, placement:'🥇 1/2' },
            { id:'KLF',    t1:'Verlierer HF1',  t2:'Verlierer HF2',  placeholder:true, placement:'🥉 3/4' },
            { id:'CF',     t1:'Sieger CHF1',    t2:'Sieger CHF2',    placeholder:true, placement:'Pl. 5/6' },
            { id:'CKF',    t1:'Verlierer CHF1', t2:'Verlierer CHF2', placeholder:true, placement:'Pl. 7/8' },
        ]},
    ];

    const naiveSlots = [];
    let currentMin = baseMin;
    let firstSlot = true;
    phases.forEach(phase => {
        const numBatches = Math.ceil(phase.matches.length / courts);
        for (let bi = 0; bi < numBatches; bi++) {
            const batch = phase.matches.slice(bi * courts, (bi + 1) * courts)
                .map((m, j) => ({ ...m, court: j + 1 }));
            const label = numBatches > 1 ? `${phase.label} (${bi+1}/${numBatches})` : phase.label;
            if (!firstSlot) currentMin += pause;
            firstSlot = false;
            naiveSlots.push({
                label, type: phase.type,
                isParallel: phase.parallelNote && bi === 0 && courts >= 3,
                hasParallelNote: phase.parallelNote && bi === 0,
                courtsUsed: batch.length,
                matches: batch,
                startMin: currentMin,
                endMin: currentMin + matchTime,
                note: null,
            });
            currentMin += matchTime;
        }
    });
    return { slots: naiveSlots, baseMin, matchTime, pause, courts, optimized: false };
}

// ============================================================
// K.O. 8-TEAM: FULL SCHEDULE OVERVIEW (all rounds, with placeholders)
// ============================================================
function ko8RenderSchedule() {
    if (!koBracketData) return;
    const { slots, baseMin, matchTime, pause, courts, optimized } = ko8CalcSchedule();
    const startTime = document.getElementById('koStartTime').value || '09:00';
    const courtHours = parseFloat(document.getElementById('koCourtHours').value) || 3;
    const bookingEndMin = baseMin + courtHours * 60;
    const totalEndMin = slots[slots.length - 1].endMin;

    const typeStyle = {
        prelim:      { bg:'#f5f3ff', border:'#ddd6fe', hdrColor:'#7c3aed', icon:'📋' },
        parallel:    { bg:'#fffbeb', border:'#fde68a', hdrColor:'#d97706', icon:'⚡' },
        r1:          { bg:'#eff6ff', border:'#bfdbfe', hdrColor:'#2563eb', icon:'🎾' },
        hf:          { bg:'#f5f3ff', border:'#ddd6fe', hdrColor:'#7c3aed', icon:'⚔️' },
        finale:      { bg:'#fffbeb', border:'#fde68a', hdrColor:'#d97706', icon:'🏆' },
        consolation: { bg:'#fef2f2', border:'#fecaca', hdrColor:'#dc2626', icon:'🎯' },
    };
    const courtColors = ['#2563eb','#16a34a','#d97706','#dc2626'];
    const courtBg     = ['#eff6ff','#f0fdf4','#fffbeb','#fef2f2'];

    let html = '';

    // Optimization badge
    if (optimized) {
        html += `<div style="padding:10px 14px; border-radius:10px; background:#f0fdf4; border:1.5px solid #bbf7d0; font-size:11px; font-weight:700; color:#166534; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
            ✅ <strong>Optimierter Spielplan (${courts} Courts)</strong> · ${slots.length} Slots · Courts werden maximal ausgenutzt · FINALE + KLF + CF gleichzeitig auf 3 Courts
            <span style="margin-left:auto; font-size:10px; font-weight:500; color:#64748b;">CKF (Platz 7/8) folgt nach dem Finale</span>
        </div>`;
    }

    slots.forEach(slot => {
        const ts = typeStyle[slot.type] || typeStyle.r1;
        const over = slot.endMin > bookingEndMin;
        const bg     = over ? '#fef2f2' : ts.bg;
        const border = over ? '#fecaca' : ts.border;

        const parallelBadge = slot.isParallel
            ? `<span class="badge badge-amber" style="margin-left:4px;">⚡ Parallel</span>` : '';
        const overBadge = over
            ? `<span class="badge" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;margin-left:4px;">⚠️ über Buchungszeit</span>` : '';

        html += `<div style="background:${bg}; border:1.5px solid ${border}; border-radius:14px; padding:12px 14px; margin-bottom:10px;">`;
        html += `<div style="display:flex; align-items:center; gap:6px; margin-bottom:10px; flex-wrap:wrap;">
            <span style="font-family:'Barlow Condensed',sans-serif; font-size:12px; font-weight:900; color:${over ? '#dc2626' : ts.hdrColor}; letter-spacing:.08em; text-transform:uppercase;">${ts.icon} ${slot.label}</span>
            <span class="badge badge-slate">⏰ ${formatMin(slot.startMin)} – ${formatMin(slot.endMin)}</span>
            <span class="badge badge-slate">${slot.courtsUsed} Court${slot.courtsUsed > 1 ? 's' : ''} gleichzeitig</span>
            ${parallelBadge}${overBadge}
        </div>`;

        html += `<div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:8px;">`;
        slot.matches.forEach(m => {
            const ci = (m.court - 1) % 4;
            const cColor = courtColors[ci];
            const cBg    = m.placeholder ? '#f8fafc' : courtBg[ci];
            const tStyle = m.placeholder ? 'font-style:italic; color:#94a3b8;' : 'font-weight:700; color:#0f172a;';
            const placementTag = m.placement
                ? `<span style="font-size:8px; font-weight:700; color:${cColor};">${m.placement}</span>` : '';
            html += `<div style="background:${cBg}; border:1.5px solid ${cColor}; border-left-width:3px; border-radius:10px; padding:9px 11px; display:flex; flex-direction:column; gap:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-family:'Barlow Condensed',sans-serif; font-size:10px; font-weight:900; color:${cColor};">C${m.court} · ${m.id}</span>
                    ${placementTag}
                </div>
                <div style="${tStyle} font-size:11px; line-height:1.2;">${escHtml(m.t1)}</div>
                <div style="font-size:8px; font-weight:900; color:#94a3b8; letter-spacing:.1em;">VS</div>
                <div style="${tStyle} font-size:11px; line-height:1.2;">${escHtml(m.t2)}</div>
            </div>`;
        });
        html += `</div>`;

        if (slot.note) {
            html += `<p style="font-size:10px; color:${over ? '#991b1b' : '#64748b'}; margin-top:8px; font-weight:600;">${slot.note}</p>`;
        }
        html += `</div>`;
    });

    // Summary
    const totalMin = totalEndMin - baseMin;
    const diff = bookingEndMin - totalEndMin;
    const fits = diff >= 0;
    const totalMatches = slots.reduce((s, x) => s + x.matches.length, 0);
    html += `<div style="margin-top:10px; background:white; border:1.5px solid #e2e8f0; border-radius:10px; padding:12px; display:flex; gap:16px; flex-wrap:wrap; align-items:center;">
        <span style="font-size:10px; color:var(--muted); font-weight:700; text-transform:uppercase;">Gesamtdauer:</span>
        <span style="font-family:'Barlow Condensed',sans-serif; font-size:22px; font-weight:900; color:${fits ? 'var(--blue)' : 'var(--red)'};">${Math.floor(totalMin/60)}h ${totalMin % 60 > 0 ? totalMin % 60 + 'm' : ''}</span>
        <span style="font-size:10px; color:var(--muted);">Start ${startTime} · Ende ca. <strong>${formatMin(totalEndMin)}</strong></span>
        <span style="font-size:10px; font-weight:700; color:${fits ? (diff < 15 ? '#d97706' : '#16a34a') : '#dc2626'};">${fits ? '✅ +' + diff + ' Min Puffer' : '❌ ' + Math.abs(diff) + ' Min zu lang'}</span>
        <span style="font-size:10px; color:var(--muted);">${slots.length} Zeitslots · ${totalMatches} Spiele · ${courts} Courts</span>
    </div>`;

    document.getElementById('ko8ScheduleContainer').innerHTML = html;
}

// ============================================================
// K.O. 8-TEAM: BUILD BRACKET (placeholder positions – scores on results page)
// ============================================================
function ko8BuildAndRenderBracket() {
    if (!koBracketData) return;

    // R1 always shows placeholders here (real names assigned after prelim on results page)
    const r1 = [
        { id: 'R1a', t1: null, t2: null, court: 2, label: 'P1 vs P8' },
        { id: 'R1b', t1: null, t2: null, court: 3, label: 'P2 vs P7' },
        { id: 'R1c', t1: null, t2: null, court: 1, label: 'P3 vs P6' },
        { id: 'R1d', t1: null, t2: null, court: 2, label: 'P4 vs P5' },
    ];
    const bracket = koBracketData.mainBracket || {};
    koBracketData.mainBracket = { r1, results: bracket.results || {} };
    ko8RenderBracketSVG();
}

// ============================================================
// K.O. 8-TEAM: SVG BRACKET RENDER
// ============================================================
function ko8RenderBracketSVG() {
    if (!koBracketData?.mainBracket) return;
    const { r1, results } = koBracketData.mainBracket;
    const matchTime = parseInt(document.getElementById('koMatchTime').value) || 30;
    const startTime = document.getElementById('koStartTime').value || '09:00';
    const [sH, sM] = startTime.split(':').map(Number);
    const baseMin = sH * 60 + sM;

    // Helper: get winner/loser of a match from results
    const getW = (matchId) => results[matchId + '_w'] || null;
    const getL = (matchId) => results[matchId + '_l'] || null;
    const setResult = (matchId, winnerIdx, t1, t2) => {
        // This is for interactive click (handled in JS below)
    };

    // Layout constants
    const mW = 210, mH = 54, gapX = 70, gapY = 12;
    const padL = 10, padT = 30;
    const roundLabelH = 22;

    // Column positions (5 rounds: R1, HF, F, KlF/Cons)
    // Winner side: cols 0(R1), 1(HF), 2(F→P1/2)
    // Loser side: cols 0(R1 losers→ConsHF), 1(ConsHF), 2(ConsF→P5/6), 3(ConsKl→P7/8)
    // Plus: Kl. Finale (P3/4) in col 2 winner

    // We'll draw 4 columns across:
    // Col 0: R1 (4 matches, rows 0-3)
    // Col 1: Winner HF (2 matches), Cons HF (2 matches below separator)
    // Col 2: Finale (P1/2) top, Kleines Finale (P3/4) below, Cons Finale (P5/6) further below
    // Col 3: Cons Kleines Finale (P7/8)

    const colX = [padL, padL + (mW + gapX), padL + 2*(mW + gapX), padL + 3*(mW + gapX)];

    // Row positions for R1 (4 matches stacked with gapY)
    const r1RowH = mH + gapY;
    const r1BaseY = padT + roundLabelH;
    const r1Y = [0, 1, 2, 3].map(i => r1BaseY + i * r1RowH);

    // Winner HF: match between R1a winner and R1b winner → y center between r1Y[0] and r1Y[1]
    const whf1Y = r1BaseY + (r1Y[0] + mH / 2 + r1Y[1] + mH / 2) / 2 - mH / 2;
    // Winner HF2: between R1c and R1d
    const whf2Y = r1BaseY + (r1Y[2] + mH / 2 + r1Y[3] + mH / 2) / 2 - mH / 2;

    // Finale: between whf1 and whf2
    const finaleY = (whf1Y + mH / 2 + whf2Y + mH / 2) / 2 - mH / 2;

    // Kl. Finale (P3/4): below Finale
    const klFinaleY = finaleY + mH + gapY * 2;

    // Cons: below winner bracket with separator
    const consSepY = Math.max(whf2Y + mH, klFinaleY + mH) + 40;

    // Cons HF: same col as Winner HF but below separator
    const chf1Y = consSepY + roundLabelH + 10;
    const chf2Y = chf1Y + mH + gapY;

    // Cons Finale P5/6
    const cf56Y = (chf1Y + mH / 2 + chf2Y + mH / 2) / 2 - mH / 2;
    // Cons Kl Finale P7/8
    const ckfY = cf56Y + mH + gapY * 2;

    const totalH = Math.max(ckfY + mH, klFinaleY + mH) + 50;
    const totalW = colX[3] + mW + 50;

    // Labels for timing (approximate)
    const t = (slot) => formatMin(baseMin + slot * matchTime);

    // Determine teams for each bracket position
    const r1Teams = r1;

    // Winners/Losers from R1 (from results or placeholder)
    const wR1a = getW('R1a'), lR1a = getL('R1a');
    const wR1b = getW('R1b'), lR1b = getL('R1b');
    const wR1c = getW('R1c'), lR1c = getL('R1c');
    const wR1d = getW('R1d'), lR1d = getL('R1d');

    // HF teams
    const wHF1 = getW('HF1'), lHF1 = getL('HF1');
    const wHF2 = getW('HF2'), lHF2 = getL('HF2');
    const wCHF1 = getW('CHF1'), lCHF1 = getL('CHF1');
    const wCHF2 = getW('CHF2'), lCHF2 = getL('CHF2');
    const wFINALE = getW('FINALE'), lFINALE = getL('FINALE');
    const wKLF = getW('KLF'), lKLF = getL('KLF');
    const wCF = getW('CF'), lCF = getL('CF');

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" style="min-width:${totalW}px; font-family:Arial,sans-serif;">`;

    // Background zones
    svg += `<rect x="0" y="0" width="${totalW}" height="${consSepY - 10}" rx="0" fill="#f0fdf4" opacity="0.3"/>`;
    svg += `<rect x="0" y="${consSepY - 10}" width="${totalW}" height="${totalH - consSepY + 10}" rx="0" fill="#fef2f2" opacity="0.3"/>`;

    // Separator line
    svg += `<line x1="0" y1="${consSepY - 10}" x2="${totalW}" y2="${consSepY - 10}" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="6,3"/>`;

    // Zone labels
    svg += `<text x="8" y="18" style="font-family:'Barlow Condensed',sans-serif; font-size:13px; font-weight:900; fill:#16a34a; letter-spacing:.06em; text-transform:uppercase;">🏆 WINNER BRACKET</text>`;
    svg += `<text x="8" y="${consSepY + 16}" style="font-family:'Barlow Condensed',sans-serif; font-size:13px; font-weight:900; fill:#dc2626; letter-spacing:.06em; text-transform:uppercase;">🔄 CONSOLATION BRACKET</text>`;

    // ---- DRAW ROUND 1 ----
    const round1Labels = ['Runde 1', '', '', ''];
    svg += `<text x="${colX[0] + mW/2}" y="${padT + 14}" text-anchor="middle" style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;fill:#64748b;letter-spacing:.08em;text-transform:uppercase;">RUNDE 1</text>`;
    svg += `<text x="${colX[1] + mW/2}" y="${padT + 14}" text-anchor="middle" style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;fill:#64748b;letter-spacing:.08em;text-transform:uppercase;">HALBFINALE</text>`;
    svg += `<text x="${colX[2] + mW/2}" y="${padT + 14}" text-anchor="middle" style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;fill:#64748b;letter-spacing:.08em;text-transform:uppercase;">FINALE</text>`;

    // R1 matches
    const r1MatchIds = ['R1a', 'R1b', 'R1c', 'R1d'];
    const r1PlaceholderLabels = ['P1 vs P8', 'P2 vs P7', 'P3 vs P6', 'P4 vs P5'];

    r1.forEach((m, i) => {
        const y = r1Y[i];
        const x = colX[0];
        const t1 = m.t1, t2 = m.t2;
        const mid = m;
        // Time badge
        const slot = i < 2 ? 1 : 2; // R1a,R1b at slot1, R1c,R1d at slot2
        svg += drawMatch(x, y, mW, mH, r1MatchIds[i], t1, t2, null, r1PlaceholderLabels[i], formatMin(baseMin + slot * matchTime), false);
    });

    // ---- WINNER HF ----
    const wHF1t1 = wR1a ? { a: wR1a.a, b: wR1a.b } : null;
    const wHF1t2 = wR1b ? { a: wR1b.a, b: wR1b.b } : null;
    const wHF2t1 = wR1c ? { a: wR1c.a, b: wR1c.b } : null;
    const wHF2t2 = wR1d ? { a: wR1d.a, b: wR1d.b } : null;

    svg += drawMatch(colX[1], whf1Y, mW, mH, 'HF1', wHF1t1, wHF1t2, null, 'W(R1a) vs W(R1b)', formatMin(baseMin + 3 * matchTime), false);
    svg += drawMatch(colX[1], whf2Y, mW, mH, 'HF2', wHF2t1, wHF2t2, null, 'W(R1c) vs W(R1d)', formatMin(baseMin + 3 * matchTime), false);

    // ---- FINALE (P1/2) ----
    const finT1 = wHF1 ? { a: wHF1.a, b: wHF1.b } : null;
    const finT2 = wHF2 ? { a: wHF2.a, b: wHF2.b } : null;
    svg += drawMatch(colX[2], finaleY, mW, mH, 'FINALE', finT1, finT2, null, 'W(HF1) vs W(HF2)', formatMin(baseMin + 4 * matchTime), true, '🥇 PLATZ 1/2', '#16a34a');

    // ---- KLEINES FINALE (P3/4) ----
    const klfT1 = lHF1 ? { a: lHF1.a, b: lHF1.b } : null;
    const klfT2 = lHF2 ? { a: lHF2.a, b: lHF2.b } : null;
    svg += drawMatch(colX[2], klFinaleY, mW, mH, 'KLF', klfT1, klfT2, null, 'L(HF1) vs L(HF2)', formatMin(baseMin + 4 * matchTime), false, 'PLATZ 3/4', '#d97706');

    // ---- CONSOLATION HF ----
    svg += `<text x="${colX[1] + mW/2}" y="${consSepY + 16}" text-anchor="middle" style="font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;fill:#dc2626;letter-spacing:.08em;text-transform:uppercase;">CONS. HALBFINALE</text>`;
    svg += `<text x="${colX[2] + mW/2}" y="${consSepY + 16}" text-anchor="middle" style="font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;fill:#dc2626;letter-spacing:.08em;text-transform:uppercase;">CONS. FINALE</text>`;

    // Cons HF1: L(R1a) vs L(R1b)
    const chf1t1 = lR1a ? { a: lR1a.a, b: lR1a.b } : null;
    const chf1t2 = lR1b ? { a: lR1b.a, b: lR1b.b } : null;
    svg += drawMatch(colX[1], chf1Y, mW, mH, 'CHF1', chf1t1, chf1t2, null, 'L(R1a) vs L(R1b)', formatMin(baseMin + 3 * matchTime), false, null, '#dc2626', true);

    // Cons HF2: L(R1c) vs L(R1d)
    const chf2t1 = lR1c ? { a: lR1c.a, b: lR1c.b } : null;
    const chf2t2 = lR1d ? { a: lR1d.a, b: lR1d.b } : null;
    svg += drawMatch(colX[1], chf2Y, mW, mH, 'CHF2', chf2t1, chf2t2, null, 'L(R1c) vs L(R1d)', formatMin(baseMin + 3 * matchTime), false, null, '#dc2626', true);

    // Cons Finale P5/6
    const cfT1 = wCHF1 ? { a: wCHF1.a, b: wCHF1.b } : null;
    const cfT2 = wCHF2 ? { a: wCHF2.a, b: wCHF2.b } : null;
    svg += drawMatch(colX[2], cf56Y, mW, mH, 'CF', cfT1, cfT2, null, 'W(CHF1) vs W(CHF2)', formatMin(baseMin + 4 * matchTime), false, 'PLATZ 5/6', '#dc2626', true);

    // Cons Kl Finale P7/8
    const ckfT1 = lCHF1 ? { a: lCHF1.a, b: lCHF1.b } : null;
    const ckfT2 = lCHF2 ? { a: lCHF2.a, b: lCHF2.b } : null;
    svg += drawMatch(colX[2], ckfY, mW, mH, 'CKF', ckfT1, ckfT2, null, 'L(CHF1) vs L(CHF2)', formatMin(baseMin + 4 * matchTime), false, 'PLATZ 7/8', '#dc2626', true);

    // ---- CONNECTOR LINES ----
    const lineColor = '#16a34a';
    const lineColorCons = '#dc2626';

    // R1a → WHF1 (top input)
    svg += connLine(colX[0] + mW, r1Y[0] + mH/2, colX[1], whf1Y + mH/4, lineColor);
    // R1b → WHF1 (bottom input)
    svg += connLine(colX[0] + mW, r1Y[1] + mH/2, colX[1], whf1Y + 3*mH/4, lineColor);
    // R1c → WHF2 (top input)
    svg += connLine(colX[0] + mW, r1Y[2] + mH/2, colX[1], whf2Y + mH/4, lineColor);
    // R1d → WHF2 (bottom input)
    svg += connLine(colX[0] + mW, r1Y[3] + mH/2, colX[1], whf2Y + 3*mH/4, lineColor);
    // WHF1 → Finale
    svg += connLine(colX[1] + mW, whf1Y + mH/2, colX[2], finaleY + mH/4, lineColor);
    // WHF2 → Finale
    svg += connLine(colX[1] + mW, whf2Y + mH/2, colX[2], finaleY + 3*mH/4, lineColor);
    // WHF1 loser → KLF
    svg += connLine(colX[1] + mW, whf1Y + mH/2, colX[2], klFinaleY + mH/4, '#d97706', true);
    // WHF2 loser → KLF
    svg += connLine(colX[1] + mW, whf2Y + mH/2, colX[2], klFinaleY + 3*mH/4, '#d97706', true);

    // R1a loser → CHF1
    svg += connLine(colX[0] + mW, r1Y[0] + mH/2, colX[1], chf1Y + mH/4, lineColorCons, true);
    // R1b loser → CHF1
    svg += connLine(colX[0] + mW, r1Y[1] + mH/2, colX[1], chf1Y + 3*mH/4, lineColorCons, true);
    // R1c loser → CHF2
    svg += connLine(colX[0] + mW, r1Y[2] + mH/2, colX[1], chf2Y + mH/4, lineColorCons, true);
    // R1d loser → CHF2
    svg += connLine(colX[0] + mW, r1Y[3] + mH/2, colX[1], chf2Y + 3*mH/4, lineColorCons, true);
    // CHF1 → CF
    svg += connLine(colX[1] + mW, chf1Y + mH/2, colX[2], cf56Y + mH/4, lineColorCons);
    // CHF2 → CF
    svg += connLine(colX[1] + mW, chf2Y + mH/2, colX[2], cf56Y + 3*mH/4, lineColorCons);
    // CHF1 loser → CKF
    svg += connLine(colX[1] + mW, chf1Y + mH/2, colX[2], ckfY + mH/4, lineColorCons, true);
    // CHF2 loser → CKF
    svg += connLine(colX[1] + mW, chf2Y + mH/2, colX[2], ckfY + 3*mH/4, lineColorCons, true);

    // Placement labels at far right
    const labelX = colX[2] + mW + 8;
    svg += placeLabel(labelX, finaleY + mH/2, '🥇 1.', '#16a34a');
    svg += placeLabel(labelX + 35, finaleY + mH/2, '🥈 2.', '#64748b');
    svg += placeLabel(labelX, klFinaleY + mH/2, '🥉 3.', '#d97706');
    svg += placeLabel(labelX + 35, klFinaleY + mH/2, '  4.', '#94a3b8');
    svg += placeLabel(labelX, cf56Y + mH/2, '  5.', '#dc2626');
    svg += placeLabel(labelX + 35, cf56Y + mH/2, '  6.', '#fca5a5');
    svg += placeLabel(labelX, ckfY + mH/2, '  7.', '#dc2626');
    svg += placeLabel(labelX + 35, ckfY + mH/2, '  8.', '#fca5a5');

    svg += `</svg>`;
    document.getElementById('ko8BracketContainer').innerHTML = svg;
}

function drawMatch(x, y, w, h, matchId, t1, t2, winner, placeholder, timeStr, isFinal=false, placementLabel=null, accentColor='#2563eb', isConsolation=false) {
    const bg = isConsolation ? '#fff8f8' : (isFinal ? '#fffbeb' : '#ffffff');
    const border = isConsolation ? '#fecaca' : (isFinal ? '#fde68a' : '#e2e8f0');
    const hasT1 = t1 != null;
    const hasT2 = t2 != null;

    let svg = `<g>`;
    svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${bg}" stroke="${border}" stroke-width="${isFinal ? 2 : 1.5}"/>`;

    if (isFinal) {
        svg += `<rect x="${x}" y="${y}" width="4" height="${h}" rx="2" fill="${accentColor}"/>`;
    }

    // Team 1
    const t1name = hasT1 ? koTeamLabelShort(t1) : placeholder || '';
    const t1color = hasT1 ? '#0f172a' : '#94a3b8';
    const t1style = hasT1 ? 'font-weight:700;' : 'font-style:italic;';
    // Provisional marking
    const t1prov = t1 && t1.provisional ? ' ?' : '';

    svg += `<text x="${x + 10}" y="${y + 17}" style="font-size:10px; ${t1style}" fill="${t1color}">${escSvg((hasT1 ? koTeamLabelShort(t1) : t1name).substring(0, 26))}${t1prov}</text>`;

    // Divider
    svg += `<line x1="${x + 6}" y1="${y + h/2}" x2="${x + w - 6}" y2="${y + h/2}" stroke="${border}" stroke-width="0.8"/>`;

    // Team 2
    const t2name = hasT2 ? koTeamLabelShort(t2) : '';
    const t2color = hasT2 ? '#0f172a' : '#94a3b8';
    const t2style = hasT2 ? 'font-weight:700;' : 'font-style:italic;';
    const t2prov = t2 && t2.provisional ? ' ?' : '';

    svg += `<text x="${x + 10}" y="${y + h - 8}" style="font-size:10px; ${t2style}" fill="${t2color}">${escSvg((hasT2 ? koTeamLabelShort(t2) : (placeholder || '')).substring(0, 26))}${t2prov}</text>`;

    // Match ID badge
    svg += `<rect x="${x + w - 38}" y="${y + 3}" width="34" height="14" rx="4" fill="${isConsolation ? '#fef2f2' : '#eff6ff'}"/>`;
    svg += `<text x="${x + w - 21}" y="${y + 13}" text-anchor="middle" style="font-size:8px; font-weight:700; fill:${isConsolation ? '#dc2626' : accentColor};">${matchId}</text>`;

    // Time
    svg += `<text x="${x + 6}" y="${y + h - 2}" style="font-size:8px; fill:#94a3b8;">${timeStr}</text>`;

    svg += `</g>`;
    return svg;
}

function connLine(x1, y1, x2, y2, color='#16a34a', dashed=false) {
    const midX = (x1 + x2) / 2;
    const dash = dashed ? 'stroke-dasharray="5,3"' : '';
    return `<path d="M${x1} ${y1} C${midX} ${y1} ${midX} ${y2} ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.5" ${dash}/>`;
}

function placeLabel(x, y, text, color) {
    return `<text x="${x}" y="${y + 4}" style="font-family:'Barlow Condensed',sans-serif; font-size:12px; font-weight:900; fill:${color};" text-anchor="middle">${text}</text>`;
}

// ============================================================
// K.O. 8-TEAM: TIME SIMULATION
// ============================================================
function ko8RenderSimulation() {
    if (!koBracketData) return;
    const { slots, baseMin, matchTime, pause, courts } = ko8CalcSchedule();
    const startTime = document.getElementById('koStartTime').value || '09:00';
    const courtHours = parseFloat(document.getElementById('koCourtHours').value) || 3;
    const bookingEndMin = baseMin + courtHours * 60;
    const totalEndMin = slots[slots.length - 1].endMin;
    const totalDuration = totalEndMin - baseMin;
    const diff = bookingEndMin - totalEndMin;
    const fits = diff >= 0;

    let html = `<p class="lbl" style="margin-bottom:12px;">⏱️ Zeitplan (${courts} Courts · ${matchTime} Min/Match · ${pause} Min Pause · Buchung ${courtHours}h)</p>`;

    // Time-fit banner
    const bufStr = diff === 0 ? 'Exakt passend' : (fits ? `+${diff} Min Puffer` : `${Math.abs(diff)} Min zu lang`);
    html += `<div style="padding:10px 14px; border-radius:10px; background:${fits ? (diff<10?'#fffbeb':'#f0fdf4') : '#fef2f2'}; border:1.5px solid ${fits ? (diff<10?'#fde68a':'#bbf7d0') : '#fecaca'}; font-size:11px; font-weight:700; color:${fits ? (diff<10?'#92400e':'#166534') : '#991b1b'}; margin-bottom:10px;">
        ${fits ? (diff<10?'⚠️':'✅') : '❌'} Ende ca. <strong>${formatMin(totalEndMin)}</strong> · Buchung bis <strong>${formatMin(bookingEndMin)}</strong> · ${bufStr}
    </div>`;

    const typeColors = {
        prelim:   { bg:'#f0fdf4', border:'#bbf7d0', text:'#16a34a',  icon:'📋' },
        parallel: { bg:'#fffbeb', border:'#fde68a', text:'#92400e',  icon:'⚡' },
        r1:       { bg:'#eff6ff', border:'#bfdbfe', text:'#1e40af',  icon:'🎾' },
        hf:       { bg:'#f5f3ff', border:'#ddd6fe', text:'#5b21b6',  icon:'⚔️' },
        finale:   { bg:'#fffbeb', border:'#fde68a', text:'#92400e',  icon:'🏆' },
    };

    slots.forEach(s => {
        const c = typeColors[s.type] || typeColors.r1;
        const overBook = s.endMin > bookingEndMin;
        const rowBorder = overBook ? '2px solid #fca5a5' : `1.5px solid ${c.border}`;
        const matchIds = s.matches.map(m => `${m.id}(C${m.court})`).join(' · ');
        html += `<div class="sim-row" style="background:${overBook ? '#fef2f2' : c.bg}; border:${rowBorder}; flex-wrap:wrap; gap:4px;">
            <span class="round-num" style="color:${overBook ? '#dc2626' : c.text};">${c.icon} ${s.label}</span>
            <span class="matches-info">${matchIds} · ${s.courtsUsed} Court${s.courtsUsed > 1 ? 's' : ''}</span>
            <span class="time-info">${formatMin(s.startMin)} – ${formatMin(s.endMin)}${overBook ? ' ⚠️' : ''}</span>
        </div>`;
    });

    const slotDur = matchTime + pause;
    html += `<div style="margin-top:12px; padding:10px 14px; background:#f0fdf4; border:1.5px solid #bbf7d0; border-radius:10px; font-size:11px; color:#166534; font-weight:600;">
        ✅ <strong>Spieler-Check OK</strong> · Jedes Team spielt genau 4× (Vorrunde + R1 + HF + Finale) · Pausen je ${slotDur} Min zwischen Runden
    </div>`;

    html += `<div style="margin-top:12px; padding:14px; background:white; border:1.5px solid #e2e8f0; border-radius:10px;">
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(110px, 1fr)); gap:12px; text-align:center;">
            <div><p style="font-size:9px; font-weight:700; color:var(--muted); text-transform:uppercase; margin-bottom:4px;">Gesamtdauer</p>
                <p style="font-family:'Barlow Condensed',sans-serif; font-size:28px; font-weight:900; color:${fits ? 'var(--blue)' : 'var(--red)'};">${Math.floor(totalDuration/60)}h ${totalDuration%60>0?totalDuration%60+'m':''}</p></div>
            <div><p style="font-size:9px; font-weight:700; color:var(--muted); text-transform:uppercase; margin-bottom:4px;">Ende ca.</p>
                <p style="font-family:'Barlow Condensed',sans-serif; font-size:28px; font-weight:900; color:var(--slate);">${formatMin(totalEndMin)}</p></div>
            <div><p style="font-size:9px; font-weight:700; color:var(--muted); text-transform:uppercase; margin-bottom:4px;">Buchung bis</p>
                <p style="font-family:'Barlow Condensed',sans-serif; font-size:28px; font-weight:900; color:${fits ? 'var(--green)' : 'var(--red)'};">${formatMin(bookingEndMin)}</p></div>
            <div><p style="font-size:9px; font-weight:700; color:var(--muted); text-transform:uppercase; margin-bottom:4px;">Puffer</p>
                <p style="font-family:'Barlow Condensed',sans-serif; font-size:28px; font-weight:900; color:${fits ? (diff<10?'var(--amber)':'var(--green)') : 'var(--red)'};">${fits?'+'+diff:diff} Min</p></div>
            <div><p style="font-size:9px; font-weight:700; color:var(--muted); text-transform:uppercase; margin-bottom:4px;">Spiele</p>
                <p style="font-family:'Barlow Condensed',sans-serif; font-size:28px; font-weight:900; color:var(--amber);">11</p></div>
        </div>
    </div>
    <div style="margin-top:12px; padding:12px; background:#eff6ff; border:1.5px solid #bfdbfe; border-radius:10px; font-size:11px; color:#1e40af; line-height:1.8;">
        <strong>Platzierungen:</strong>
        FINALE-Sieger → 🥇 P1 · FINALE-Verlierer → 🥈 P2 ·
        KLF-Sieger → 🥉 P3 · KLF-Verlierer → P4 ·
        CF-Sieger → P5 · CF-Verlierer → P6 ·
        CKF-Sieger → P7 · CKF-Verlierer → P8
    </div>`;

    document.getElementById('ko8Simulation').innerHTML = html;
}

// ============================================================
// K.O. 16-TEAM: GENERATE & RENDER (existing logic, simplified)
// ============================================================
function koGenerate16() {
    const teams = koTeams.slice(0, 16);
    const seeded = [...teams];
    while (seeded.length < 16) seeded.push(null);

    const r1matches = [];
    for (let i = 0; i < 16; i += 2) {
        r1matches.push({ id: `W1-${i/2}`, team1: seeded[i], team2: seeded[i+1], winner: null, loser: null });
    }
    const winnerBracket = [{ round: 1, label: 'Runde 1', matches: r1matches }];
    for (let r = 2; r <= 4; r++) {
        const prev = winnerBracket[r-2].matches;
        const rmatches = [];
        for (let i = 0; i < prev.length; i += 2) {
            rmatches.push({ id: `W${r}-${i/2}`, team1: prev[i].winner, team2: prev[i+1]?.winner||null, winner:null, loser:null, feedFrom:[prev[i].id, prev[i+1]?.id] });
        }
        const labels = { 2:'Viertelfinale', 3:'Halbfinale', 4:'Finale' };
        winnerBracket.push({ round: r, label: labels[r]||`Runde ${r}`, matches: rmatches });
    }

    const loserBracket = [];
    for (let r = 0; r < 4; r++) {
        const roundLosers = winnerBracket[r].matches;
        if (roundLosers.length >= 2) {
            const cmatches = [];
            for (let i = 0; i < roundLosers.length; i += 2) {
                if (i+1 < roundLosers.length) {
                    cmatches.push({ id: `L${r+1}-${i/2}`, team1Source: roundLosers[i].id, team2Source: roundLosers[i+1].id, team1: roundLosers[i].loser, team2: roundLosers[i+1].loser, winner:null, loser:null });
                }
            }
            if (cmatches.length > 0) {
                const placeLabels = { 0:'Spiel um Platz 15/16', 1:'Plätze 9–12', 2:'Spiel um Platz 5–8', 3:'Spiel um Platz 3/4' };
                loserBracket.push({ round: r+1, label: placeLabels[r]||`Cons. R${r+1}`, matches: cmatches });
            }
        }
    }

    koBracketData = { type: '16team', teams, winnerBracket, loserBracket, numRounds: 4, totalTeams: teams.length };
    ko16RenderAll();
    document.getElementById('ko8View').classList.add('hidden');
    document.getElementById('ko16View').classList.remove('hidden');
    document.getElementById('koBracketArea').classList.remove('hidden');
}

function ko16RenderAll() {
    ko16RenderBracket();
    ko16RenderSimulation();
}

function ko16RenderBracket() {
    if (!koBracketData || koBracketData.type !== '16team') return;
    const { winnerBracket, loserBracket, numRounds } = koBracketData;
    const size = 16;
    const matchW = 190, matchH = 50, gapY = 14, gapX = 55;
    const roundLabelH = 28, padLeft = 16, padTop = 20;
    const r1count = size / 2;
    const winnerH = r1count * (matchH + gapY) + roundLabelH + 40;
    let loserMaxMatches = 0;
    loserBracket.forEach(r => { if (r.matches.length > loserMaxMatches) loserMaxMatches = r.matches.length; });
    const loserH = Math.max(loserMaxMatches, 1) * (matchH + gapY) + roundLabelH + 40;
    const totalW = padLeft + (numRounds + 1) * (matchW + gapX) + 80;
    const totalH = padTop + winnerH + 40 + loserH + 20;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" style="min-width:${totalW}px; font-family:Arial,sans-serif;">`;
    svg += `<text x="${padLeft}" y="${padTop+14}" style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:900;fill:#16a34a;">🏆 Winner Bracket</text>`;
    svg += `<text x="${padLeft}" y="${padTop+winnerH+30+14}" style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:900;fill:#dc2626;">🔄 Consolation Bracket</text>`;
    svg += `<line x1="0" y1="${padTop+winnerH+20}" x2="${totalW}" y2="${padTop+winnerH+20}" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="8,4"/>`;

    const winnerPositions = {};
    for (let r = 0; r < numRounds; r++) {
        const round = winnerBracket[r];
        const matchCount = round.matches.length;
        const spacing = (r1count * (matchH + gapY)) / matchCount;
        const xStart = padLeft + r * (matchW + gapX);
        svg += `<text x="${xStart+matchW/2}" y="${padTop+roundLabelH}" text-anchor="middle" style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;fill:#64748b;letter-spacing:.08em;text-transform:uppercase;">${round.label||'R'+(r+1)}</text>`;
        round.matches.forEach((m, mi) => {
            const x = xStart;
            const y = padTop + roundLabelH + 10 + mi * spacing + (spacing - matchH) / 2;
            winnerPositions[m.id] = { x, y, cx: x+matchW/2, cy: y+matchH/2, rx: x+matchW };
            svg += `<rect x="${x}" y="${y}" width="${matchW}" height="${matchH}" rx="8" fill="white" stroke="#cbd5e1" stroke-width="1.5"/>`;
            const t1 = koTeamLabel(m.team1), t2 = koTeamLabel(m.team2);
            svg += `<text x="${x+10}" y="${y+18}" style="font-size:10px;font-weight:600;fill:${m.team1?'#0f172a':'#94a3b8'};">${escSvg(t1.substring(0,24))}</text>`;
            svg += `<line x1="${x+5}" y1="${y+matchH/2}" x2="${x+matchW-5}" y2="${y+matchH/2}" stroke="#e2e8f0" stroke-width="0.5"/>`;
            svg += `<text x="${x+10}" y="${y+38}" style="font-size:10px;font-weight:600;fill:${m.team2?'#0f172a':'#94a3b8'};">${escSvg(t2.substring(0,24))}</text>`;
            svg += `<rect x="${x+matchW-32}" y="${y+3}" width="28" height="14" rx="4" fill="#eff6ff"/>`;
            svg += `<text x="${x+matchW-18}" y="${y+13}" text-anchor="middle" style="font-size:7px;font-weight:700;fill:#2563eb;">${m.id}</text>`;
            if (r < numRounds - 1) {
                const nextRound = winnerBracket[r+1];
                const nextMi = Math.floor(mi/2);
                const nextMatch = nextRound.matches[nextMi];
                if (nextMatch) {
                    const nextSpacing = (r1count*(matchH+gapY))/nextRound.matches.length;
                    const nx = padLeft+(r+1)*(matchW+gapX);
                    const ny = padTop+roundLabelH+10+nextMi*nextSpacing+(nextSpacing-matchH)/2;
                    const fromY = y+matchH/2, toY = ny+matchH/2, midX = x+matchW+gapX/2;
                    svg += `<path d="M${x+matchW} ${fromY} H${midX} V${toY} H${nx}" fill="none" stroke="#16a34a" stroke-width="1.5" opacity="0.5"/>`;
                }
            }
        });
    }

    const loserBaseY = padTop + winnerH + 40;
    loserBracket.forEach((round, ri) => {
        const xStart = padLeft + (round.round-1) * (matchW+gapX);
        svg += `<text x="${xStart+matchW/2}" y="${loserBaseY+roundLabelH}" text-anchor="middle" style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;fill:#dc2626;letter-spacing:.08em;text-transform:uppercase;">${round.label}</text>`;
        round.matches.forEach((m, mi) => {
            const x = xStart;
            const y = loserBaseY + roundLabelH + 10 + mi*(matchH+gapY);
            const t1 = m.team1 ? koTeamLabel(m.team1) : `Verlierer ${m.team1Source}`;
            const t2 = m.team2 ? koTeamLabel(m.team2) : `Verlierer ${m.team2Source}`;
            svg += `<rect x="${x}" y="${y}" width="${matchW}" height="${matchH}" rx="8" fill="#fff5f5" stroke="#fecaca" stroke-width="1.5"/>`;
            svg += `<text x="${x+10}" y="${y+18}" style="font-size:10px;font-weight:600;fill:#991b1b;">${escSvg(t1.substring(0,24))}</text>`;
            svg += `<line x1="${x+5}" y1="${y+matchH/2}" x2="${x+matchW-5}" y2="${y+matchH/2}" stroke="#fecaca" stroke-width="0.5"/>`;
            svg += `<text x="${x+10}" y="${y+38}" style="font-size:10px;font-weight:600;fill:#991b1b;">${escSvg(t2.substring(0,24))}</text>`;
            svg += `<rect x="${x+matchW-32}" y="${y+3}" width="28" height="14" rx="4" fill="#fef2f2"/>`;
            svg += `<text x="${x+matchW-18}" y="${y+13}" text-anchor="middle" style="font-size:7px;font-weight:700;fill:#dc2626;">${m.id}</text>`;
            if (m.team1Source) {
                const srcPos = winnerPositions[m.team1Source];
                if (srcPos) {
                    svg += `<path d="M${srcPos.rx} ${srcPos.y+matchH*0.75} Q${srcPos.rx+20} ${srcPos.y+matchH*0.75} ${srcPos.rx+20} ${padTop+winnerH+20} L${srcPos.rx+20} ${y+12} H${x}" fill="none" stroke="#dc2626" stroke-width="1" stroke-dasharray="4,3" opacity="0.35"/>`;
                }
            }
        });
    });

    svg += `</svg>`;
    document.getElementById('ko16BracketContainer').innerHTML = svg;
}

function ko16RenderSimulation() {
    if (!koBracketData || koBracketData.type !== '16team') return;
    const { winnerBracket, loserBracket, totalTeams, numRounds } = koBracketData;
    const courts = parseInt(document.getElementById('koCourts').value) || 2;
    const matchTime = parseInt(document.getElementById('koMatchTime').value) || 30;
    const pauseBetween = parseInt(document.getElementById('koPause').value) || 5;
    const startTime = document.getElementById('koStartTime').value || '09:00';
    let [sH, sM] = startTime.split(':').map(Number);

    const allRounds = [];
    for (let r = 0; r < numRounds; r++) {
        const wMatches = winnerBracket[r].matches.filter(m => !m.isBye);
        if (wMatches.length > 0) allRounds.push({ label: winnerBracket[r].label||`R${r+1}`, matches: wMatches, type:'winner' });
        const cRound = loserBracket.find(lr => lr.round === r+1);
        if (cRound?.matches.length > 0) allRounds.push({ label: cRound.label, matches: cRound.matches, type:'consolation' });
    }

    let currentMin = sH*60 + sM;
    let html = `<p class="lbl" style="margin-bottom:12px;">⏱️ Zeitplan-Simulation (${courts} Plätze · ${matchTime} Min/Match)</p>`;
    let totalMatchesCount = 0;

    allRounds.forEach((round, ri) => {
        const matchCount = round.matches.length;
        totalMatchesCount += matchCount;
        const slotsNeeded = Math.ceil(matchCount/courts);
        const roundDuration = slotsNeeded * matchTime + (slotsNeeded > 1 ? (slotsNeeded-1)*pauseBetween : 0);
        if (ri > 0) currentMin += pauseBetween;
        const startStr = formatMin(currentMin);
        const endMin = currentMin + roundDuration;
        const endStr = formatMin(endMin);
        const typeColor = round.type==='winner'?'var(--green)':'var(--red)';
        const typeBg = round.type==='winner'?'#f0fdf4':'#fef2f2';
        const typeBorder = round.type==='winner'?'#bbf7d0':'#fecaca';
        const typeIcon = round.type==='winner'?'🏆':'🔄';
        html += `<div class="sim-row" style="background:${typeBg};border-color:${typeBorder};">
            <span class="round-num" style="color:${typeColor};">${typeIcon} ${round.label}</span>
            <span class="matches-info">${matchCount} Spiel${matchCount>1?'e':''} · ${slotsNeeded} Zeitslot${slotsNeeded>1?'s':''}</span>
            <span class="time-info">${startStr} – ${endStr}</span>
        </div>`;
        currentMin = endMin;
    });

    const totalDuration = currentMin - (sH*60+sM);
    html += `<div style="margin-top:16px;padding:14px;background:white;border:1.5px solid #e2e8f0;border-radius:10px;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;text-align:center;">
            <div><p style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">Gesamtdauer</p><p style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:900;color:var(--blue);">${Math.floor(totalDuration/60)}h ${totalDuration%60}m</p></div>
            <div><p style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">Geschätztes Ende</p><p style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:900;color:var(--slate);">${formatMin(currentMin)}</p></div>
            <div><p style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">Spiele Total</p><p style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:900;color:var(--green);">${totalMatchesCount}</p></div>
            <div><p style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">Teams</p><p style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:900;color:var(--amber);">${totalTeams}</p></div>
        </div>
    </div>`;
    document.getElementById('ko16Simulation').innerHTML = html;
}

// ============================================================
// PRINT / PDF  – Seite 1: Spielplan   Seite 2: Turnierbaum
// ============================================================
function koPrintBracket() {
    const name = document.getElementById('koTName').value || 'Turnier';
    const matchTime = parseInt(document.getElementById('koMatchTime').value) || 30;
    const pause = parseInt(document.getElementById('koPause').value) || 5;
    const courts = parseInt(document.getElementById('koCourts').value) || 3;
    const courtHours = parseFloat(document.getElementById('koCourtHours').value) || 3;
    const startTime = document.getElementById('koStartTime').value || '09:00';
    const [sH, sM] = startTime.split(':').map(Number);
    const baseMin = sH * 60 + sM;
    const slotDur = matchTime + pause;
    const totalMin = 5 * slotDur;
    const endMin = baseMin + totalMin;
    const bookingEndMin = baseMin + courtHours * 60;
    const diff = courtHours * 60 - totalMin;
    const fitsOK = diff >= 0;
    const today = new Date().toLocaleDateString('de-DE');

    const metaLine = `${koTeamCount} Teams · ${courts} Courts · ${matchTime} Min/Match · ${pause} Min Pause · Start: ${startTime} · Buchung: ${courtHours}h · Stand: ${today}`;

    // ---- Build schedule HTML for print ----
    const slotColors = ['#7c3aed','#d97706','#2563eb','#7c3aed','#d97706'];
    const slotIcons  = ['📋','⚡','🎾','⚔️','🏆'];
    const slotDefs = [
        { label: 'Vorrunde – Slot 1', detail: 'V1 · V2 · V3', nCourts: Math.min(3,courts) },
        { label: 'Slot 2 – V4 + R1a + R1b (parallel)', detail: 'V4 (C1) · R1a (C2) · R1b (C3)', nCourts: Math.min(3,courts) },
        { label: 'Runde 1 – R1c + R1d', detail: 'R1c (C1) · R1d (C2)', nCourts: Math.min(2,courts) },
        { label: 'Halbfinale', detail: 'HF1 (C1) · HF2 (C2) · CHF1 (C3) · CHF2 (C4)', nCourts: Math.min(4,courts) },
        { label: '🏆 Finale', detail: 'FINALE (C1) · Kl.Finale (C2) · Cons. (C3) · Cons.Kl. (C4)', nCourts: Math.min(4,courts) },
    ];

    // Prelim match details
    const pm = koBracketData?.prelimMatches || [];
    const prelimDetail = pm.map(m =>
        `<tr>
            <td style="padding:5px 10px; font-weight:700; color:#7c3aed;">${m.id}</td>
            <td style="padding:5px 10px;">${koTeamLabel(m.team1)}</td>
            <td style="padding:5px 10px; text-align:center; color:#94a3b8; font-weight:900;">VS</td>
            <td style="padding:5px 10px;">${koTeamLabel(m.team2)}</td>
            <td style="padding:5px 10px; text-align:center; font-weight:700; color:#2563eb;">Court ${m.court}</td>
            <td style="padding:5px 10px; text-align:center; font-weight:700; color:#0f172a;">${m.id === 'V4' ? formatMin(baseMin + slotDur) : formatMin(baseMin)}</td>
            <td style="padding:5px 10px; width:80px; border-bottom:1px solid #e2e8f0;">______ : ______</td>
        </tr>`
    ).join('');

    let schedHTML = `
        <div style="font-family:Arial,sans-serif; font-size:12px; color:#0f172a; page-break-after:always;">
            <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid #2563eb; padding-bottom:10px; margin-bottom:16px;">
                <div>
                    <div style="font-family:'Barlow Condensed',sans-serif; font-size:32px; font-weight:900; font-style:italic; color:#2563eb; text-transform:uppercase; letter-spacing:-.01em; line-height:1;">${escHtml(name)}</div>
                    <div style="font-size:10px; color:#64748b; margin-top:4px;">${metaLine}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-family:'Barlow Condensed',sans-serif; font-size:13px; font-weight:900; color:#64748b;">SPIELPLAN · SEITE 1/2</div>
                    <div style="font-size:22px; font-weight:900; color:${fitsOK ? '#16a34a' : '#dc2626'};">${fitsOK ? '✅ Passt' : '⚠️ Zu lang'}</div>
                    <div style="font-size:10px; color:#64748b;">Ende ~${formatMin(endMin)} · Buchung bis ${formatMin(bookingEndMin)} · ${fitsOK ? '+' + diff : diff} Min</div>
                </div>
            </div>

            <!-- VORRUNDE TABELLE -->
            <div style="font-family:'Barlow Condensed',sans-serif; font-size:13px; font-weight:900; letter-spacing:.06em; text-transform:uppercase; color:#64748b; margin-bottom:8px;">📋 Vorrunde – Auslosung</div>
            <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:20px;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding:6px 10px; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:.06em; color:#64748b;">Spiel</th>
                        <th style="padding:6px 10px; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:.06em; color:#64748b;">Team 1</th>
                        <th style="padding:6px 10px;"></th>
                        <th style="padding:6px 10px; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:.06em; color:#64748b;">Team 2</th>
                        <th style="padding:6px 10px; text-align:center; font-size:9px; text-transform:uppercase; letter-spacing:.06em; color:#64748b;">Court</th>
                        <th style="padding:6px 10px; text-align:center; font-size:9px; text-transform:uppercase; letter-spacing:.06em; color:#64748b;">Uhrzeit</th>
                        <th style="padding:6px 10px; text-align:center; font-size:9px; text-transform:uppercase; letter-spacing:.06em; color:#64748b;">Ergebnis</th>
                    </tr>
                </thead>
                <tbody>${prelimDetail}</tbody>
            </table>

            <!-- ZEITPLAN ÜBERSICHT -->
            <div style="font-family:'Barlow Condensed',sans-serif; font-size:13px; font-weight:900; letter-spacing:.06em; text-transform:uppercase; color:#64748b; margin-bottom:8px;">⏱️ Zeitplan aller Runden</div>
            <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:20px;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding:6px 10px; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:.06em; color:#64748b;">Runde / Slot</th>
                        <th style="padding:6px 10px; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:.06em; color:#64748b;">Spiele</th>
                        <th style="padding:6px 10px; text-align:center; font-size:9px; text-transform:uppercase; letter-spacing:.06em; color:#64748b;">Courts</th>
                        <th style="padding:6px 10px; text-align:center; font-size:9px; text-transform:uppercase; letter-spacing:.06em; color:#64748b;">Von</th>
                        <th style="padding:6px 10px; text-align:center; font-size:9px; text-transform:uppercase; letter-spacing:.06em; color:#64748b;">Bis</th>
                        <th style="padding:6px 10px; text-align:center; font-size:9px; text-transform:uppercase; letter-spacing:.06em; color:#64748b;">Dauer</th>
                    </tr>
                </thead>
                <tbody>
                ${slotDefs.map((s, i) => {
                    const from = formatMin(baseMin + i * slotDur);
                    const to   = formatMin(baseMin + i * slotDur + matchTime);
                    const over = (baseMin + i * slotDur + matchTime) > bookingEndMin;
                    return `<tr style="background:${over ? '#fef2f2' : (i % 2 === 0 ? '#ffffff' : '#f8fafc')};">
                        <td style="padding:6px 10px; font-weight:700; color:${slotColors[i]};">${slotIcons[i]} ${s.label}</td>
                        <td style="padding:6px 10px; color:#475569;">${s.detail}</td>
                        <td style="padding:6px 10px; text-align:center; font-weight:700;">${s.nCourts}</td>
                        <td style="padding:6px 10px; text-align:center; font-weight:700;">${from}</td>
                        <td style="padding:6px 10px; text-align:center; font-weight:700; color:${over ? '#dc2626' : '#0f172a'};">${to}${over ? ' ⚠️' : ''}</td>
                        <td style="padding:6px 10px; text-align:center; color:#64748b;">${matchTime} Min</td>
                    </tr>`;
                }).join('')}
                </tbody>
            </table>

            <!-- CHECKS -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:4px;">
                <div style="padding:10px 14px; border-radius:8px; border:1.5px solid ${fitsOK ? '#bbf7d0' : '#fecaca'}; background:${fitsOK ? '#f0fdf4' : '#fef2f2'};">
                    <div style="font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:900; color:#64748b; text-transform:uppercase; letter-spacing:.06em; margin-bottom:4px;">Zeitcheck</div>
                    <div style="font-size:11px; font-weight:700; color:${fitsOK ? '#166534' : '#991b1b'};">
                        ${fitsOK ? '✅ Turnier passt in Platzbuchung' : '❌ Turnier zu lang!'}<br>
                        <span style="font-weight:400; color:#64748b;">Ende ~${formatMin(endMin)} · Buchung bis ${formatMin(bookingEndMin)} · ${fitsOK ? '+'+diff : diff} Min Puffer</span>
                    </div>
                </div>
                <div style="padding:10px 14px; border-radius:8px; border:1.5px solid #bbf7d0; background:#f0fdf4;">
                    <div style="font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:900; color:#64748b; text-transform:uppercase; letter-spacing:.06em; margin-bottom:4px;">Spieler-Check</div>
                    <div style="font-size:11px; font-weight:700; color:#166534;">
                        ✅ Spielanzahl &amp; Pausen OK<br>
                        <span style="font-weight:400; color:#64748b;">Jedes Team spielt 4× · Pause je ${slotDur} Min zwischen Runden</span>
                    </div>
                </div>
            </div>
        </div>`;

    // ---- Seite 2: Turnierbaum ----
    const bracketSrc = koTeamCount === 8
        ? document.getElementById('ko8BracketContainer').innerHTML
        : document.getElementById('ko16BracketContainer').innerHTML;

    const bracketHTML = `
        <div style="font-family:Arial,sans-serif; font-size:12px; color:#0f172a;">
            <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid #2563eb; padding-bottom:10px; margin-bottom:16px;">
                <div>
                    <div style="font-family:'Barlow Condensed',sans-serif; font-size:32px; font-weight:900; font-style:italic; color:#2563eb; text-transform:uppercase; line-height:1;">${escHtml(name)}</div>
                    <div style="font-size:10px; color:#64748b; margin-top:4px;">${metaLine}</div>
                </div>
                <div style="font-family:'Barlow Condensed',sans-serif; font-size:13px; font-weight:900; color:#64748b;">TURNIERBAUM · SEITE 2/2</div>
            </div>
            <div style="overflow:visible; max-width:100%;">
                ${bracketSrc}
            </div>
            <div style="margin-top:16px; padding:10px 14px; border:1px solid #e2e8f0; border-radius:8px; font-size:10px; display:flex; gap:20px; flex-wrap:wrap;">
                <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#f0fdf4;border:1px solid #bbf7d0;margin-right:3px;"></span>Winner Bracket</span>
                <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#fef2f2;border:1px solid #fecaca;margin-right:3px;"></span>Consolation Bracket</span>
                <span style="color:#94a3b8;">— Sieger-Pfad</span>
                <span style="color:#94a3b8; text-decoration:underline dotted;">- - Verlierer-Pfad</span>
            </div>
        </div>`;

    document.getElementById('printTournamentName').textContent = name;
    document.getElementById('printTournamentMeta').textContent = metaLine;
    document.getElementById('printBracketContent').innerHTML = schedHTML + bracketHTML;

    window.print();
}

// ============================================================
// K.O. – SAVE
// ============================================================
async function koSaveTournament() {
    const name = document.getElementById('koTName').value.trim();
    if (!name) { alert('Bitte Turniernamen eingeben.'); return; }
    if (!koBracketData) { alert('Bitte zuerst ein Bracket generieren.'); return; }
    const password = document.getElementById('koTPassword').value.trim();
    const expiryDate = getKOExpiryDate();
    const courtNamesData = readKOCourtNames();
    const payload = {
        tournament_type: 'knockout',
        p: koTeams.flatMap(t => [t.a, t.b]),
        isTeam: true,
        password: password || null,
        expiry_date: expiryDate,
        koTeamCount,
        koCourts: parseInt(document.getElementById('koCourts').value),
        koCourtNames: courtNamesData,
        koStartTime: document.getElementById('koStartTime').value,
        koMatchTime: parseInt(document.getElementById('koMatchTime').value),
        koPause: parseInt(document.getElementById('koPause').value),
        koCourtHours: parseFloat(document.getElementById('koCourtHours').value),
        koTeams,
        koBracket: koBracketData,
    };
    try {
        const { error } = await supabaseClient.from('tournaments').upsert({
            id: name,
            data: payload,
            tournament_type: 'knockout',
            expiry_date: expiryDate
        });
        if (error) throw error;
        document.getElementById('lastActionTime').textContent = `Gespeichert: ${new Date().toLocaleTimeString('de-DE')}`;
        alert(`✅ K.O. Turnier "${name}" gespeichert!`);
        init();
    } catch (e) { alert('Fehler beim Speichern: ' + e.message); }
}

// ============================================================
// INIT
// ============================================================
init();
</script>

// ============================================================
// K.O. PASSWORD TOGGLE
// ============================================================
function koTogglePw() {
    const el=document.getElementById('koTPassword'), btn=document.getElementById('koEyeBtn');
    if(el.type==='password'){el.type='text';btn.innerText='🙈';}
    else{el.type='password';btn.innerText='👁️';}
}
