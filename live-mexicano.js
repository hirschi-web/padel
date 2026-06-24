// ============================================================
// LIVE-MEXICANO.JS — Komplette App-Logik
// ============================================================

// ── Supabase ─────────────────────────────────────────────────
const SB_URL = "https://vjcvchczbyvhweiwrunp.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqY3ZjaGN6Ynl2aHdlaXdydW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NjkzNjYsImV4cCI6MjA4NTM0NTM2Nn0.A01bxl9dNzgmeDcOV2HZIIa2pN5vhWg3q0_FhqO1R2M";
const sb = supabase.createClient(SB_URL, SB_KEY);

// ── Elo-Konstanten ───────────────────────────────────────────
const ELO = { MAX_PTS:24, BASE_K:.40, MIN_K:.15, REL_GAIN:.10, REL_MAX:1.0, STEEP:1.8 };

// ── State ────────────────────────────────────────────────────
let tournamentId   = null;
let tournament     = null;   // DB row
let tData          = null;   // data JSONB
let players        = [];     // live player objects
let isAdmin        = false;
let pendingRound   = null;   // berechnete aber noch nicht gestartete Runde
let dirtyScores    = false;
let isTyping       = false;
let typingTimer    = null;
let isSaving       = false;
let realtimeConn   = false;
let pollTimer      = null;
let themes         = [];

// ── Init ─────────────────────────────────────────────────────
async function init() {
    tournamentId = new URLSearchParams(location.search).get('id');
    if (!tournamentId) { showFatal('Keine Turnier-ID in der URL (?id=…)'); return; }

    // Admin-Session wiederherstellen
    if (sessionStorage.getItem('mex_admin_' + tournamentId) === '1') {
        isAdmin = true;
        document.getElementById('adminBtn').classList.add('active');
    }

    await loadThemes();
    await loadTournament(true);
    setupRealtime();
    setupVisibility();
    setTimeout(() => { if (!realtimeConn) startPolling(); }, 15000);
}

// ── Themes (identisch live.html) ─────────────────────────────
async function loadThemes() {
    try {
        const r = await fetch('themes.json');
        const d = await r.json();
        themes = d.themes || [];
        const cur = localStorage.getItem('theme') || 'navy';
        renderThemeButtons(cur);
        applyTheme(cur);
    } catch(e) { console.warn('themes.json fehlt'); }
}

function renderThemeButtons(cur) {
    const area = document.getElementById('themeButtons');
    if (!themes.length || !area) return;
    area.innerHTML = themes.map(t =>
        `<button class="theme-btn ${t.id===cur?'active':''}" onclick="switchTheme('${t.id}')">${t.name}<br><span style="font-size:10px;opacity:.7">${t.desc}</span></button>`
    ).join('');
}

function switchTheme(id) { localStorage.setItem('theme',id); applyTheme(id); renderThemeButtons(id); }

function applyTheme(id) {
    const t = themes.find(x => x.id === id);
    if (!t) return;
    Object.entries(t.vars).forEach(([k,v]) => {
        document.documentElement.style.setProperty('--' + k.replace(/([A-Z])/g,'-$1').toLowerCase(), v);
    });
}

// ── Turnier laden ─────────────────────────────────────────────
async function loadTournament(initial = false) {
    try {
        const { data, error } = await sb
            .from('mex_tournaments')
            .select('*, mex_tournament_players(player_id, start_level, mex_players(name))')
            .eq('id', tournamentId)
            .single();

        if (error || !data) throw error || new Error('Nicht gefunden');

        tournament = data;
        tData      = data.data || { settings:{}, rounds:[] };
        document.getElementById('offlineWarning').style.display = 'none';
        document.getElementById('tournamentTitle').innerText = (data.name || 'Mexicano').toUpperCase();

        buildPlayers(data.mex_tournament_players || []);

        if (initial) {
            setupFocusDropdown();
            // Erste Runde sofort berechnen und als pending anzeigen wenn noch keine Runden
            if (!tData.rounds || tData.rounds.length === 0) {
                pendingRound = calcRound(1);
            }
        }

        renderAll();
    } catch(e) {
        console.error('Load failed:', e);
        const backup = localStorage.getItem('mex_backup_' + tournamentId);
        if (backup) {
            const cached = JSON.parse(backup);
            tData = cached.tData;
            players = cached.players || [];
            document.getElementById('offlineWarning').style.display = 'block';
            document.getElementById('tournamentTitle').innerText = 'OFFLINE';
            renderAll();
        } else {
            showFatal('Turnier konnte nicht geladen werden.');
        }
    }
}

// ── Spieler-State aufbauen ────────────────────────────────────
function buildPlayers(rows) {
    players = rows.map(r => ({
        id:          r.player_id,
        name:        r.mex_players?.name || '?',
        startLevel:  r.start_level || 1.0,
        liveLevel:   r.start_level || 1.0,
        reliability: 0,
        points:      0,
        wins:        0,
        losses:      0,
        matches:     0,
    }));

    // Alle abgeschlossenen Runden einrechnen
    for (const round of (tData.rounds || []).filter(r => r.completed)) {
        applyRoundElo(round);
    }

    // Backup speichern
    localStorage.setItem('mex_backup_' + tournamentId,
        JSON.stringify({ tData, players, ts: Date.now() }));
}

// ── Elo für eine abgeschlossene Runde einrechnen ──────────────
function applyRoundElo(round) {
    for (const court of (round.courts || [])) {
        const { teamA, teamB, scoreA, scoreB } = court;
        if (scoreA == null || scoreB == null) continue;
        const sA = Number(scoreA), sB = Number(scoreB);
        const all = [...teamA, ...teamB];

        for (const pid of all) {
            const p = players.find(x => x.id === pid);
            if (!p) continue;
            const inA      = teamA.includes(pid);
            const myScore  = inA ? sA : sB;
            const oppScore = inA ? sB : sA;

            // Turnierpunkte
            p.points += myScore;
            if (myScore > oppScore) p.wins++;
            else if (myScore < oppScore) p.losses++;
            p.matches++;

            // Elo-Update
            const others   = all.filter(id => id !== pid).map(id => players.find(x=>x.id===id)?.liveLevel || 1);
            const avgOther = others.reduce((a,b)=>a+b,0) / others.length;
            const expected = 1 / (1 + Math.exp(-(p.liveLevel - avgOther) * ELO.STEEP));
            const actual   = myScore / ELO.MAX_PTS;
            const rel      = Math.min(p.reliability, ELO.REL_MAX);
            const k        = ELO.BASE_K * (1 - rel * (1 - ELO.MIN_K));
            p.liveLevel   += k * (actual - expected);
            p.reliability  = Math.min(p.reliability + ELO.REL_GAIN, ELO.REL_MAX);
        }
    }
}

// ── Zeitberechnung ────────────────────────────────────────────
function getRoundTimes() {
    const s = tData.settings || {};
    const [h, m]   = (s.startTime || '14:00').split(':').map(Number);
    const start    = h * 60 + m;
    const warmup   = s.warmupMin  || 0;
    const match    = s.matchMin   || 20;
    const brk      = s.breakMin   || 0;
    const total    = (s.totalHours || 3) * 60;
    const perRound = match + brk;
    const netto    = total - warmup;
    const count    = perRound > 0 ? Math.floor(netto / perRound) : 0;
    const times    = [];
    let cursor     = start + warmup;
    for (let i = 0; i < count; i++) { times.push(cursor); cursor += perRound; }
    return { times, matchMin: match };
}

function toHHMM(mins) {
    return String(Math.floor(mins/60)).padStart(2,'0') + ':' + String(mins%60).padStart(2,'0');
}

function getCourtName(i) {
    return (tData.settings?.courtNames || [])[i] || String(i+1);
}

// ── Paarungslogik ─────────────────────────────────────────────
function calcRound(roundNum) {
    const s      = tData.settings || {};
    const courts = s.courts || Math.floor(players.length / 4);

    let ordered;
    if (roundNum === 1) {
        // Runde 1: zufällig
        ordered = [...players].sort(() => Math.random() - .5);
    } else {
        // Ab Runde 2: nach Live-Level absteigend
        ordered = [...players].sort((a, b) => b.liveLevel - a.liveLevel);
    }

    const courtList = [];
    for (let ci = 0; ci < courts; ci++) {
        const block = ordered.slice(ci*4, ci*4+4);
        courtList.push({
            courtNumber: ci + 1,
            teamA: [block[0]?.id, block[3]?.id].filter(Boolean),
            teamB: [block[1]?.id, block[2]?.id].filter(Boolean),
            scoreA: null,
            scoreB: null,
        });
    }

    const snap = {};
    players.forEach(p => { snap[p.id] = p.liveLevel; });

    return { roundNumber: roundNum, completed: false, courts: courtList, levelSnapshot: snap };
}

// ── Render all ────────────────────────────────────────────────
function renderAll() {
    renderTimeBanner();
    renderMatchArea();
    renderRanking();
    renderHistory();
}

// ── Zeit-Banner ───────────────────────────────────────────────
function renderTimeBanner() {
    const { times, matchMin } = getRoundTimes();
    const rounds    = tData.rounds || [];
    const completed = rounds.filter(r => r.completed).length;
    const active    = rounds.find(r => !r.completed);
    const pending   = pendingRound;
    const total     = times.length;
    const finished  = tournament?.status === 'finished';

    // Welche Runde läuft gerade?
    const currentNum = active ? active.roundNumber : (pending ? pending.roundNumber : completed + 1);
    const timeIdx    = currentNum - 1;
    const startTime  = times[timeIdx] != null ? toHHMM(times[timeIdx]) : '–';
    const endTime    = times[timeIdx] != null ? toHHMM(times[timeIdx] + matchMin) : '–';
    const nextIdx    = active ? timeIdx + 1 : timeIdx;
    const nextTime   = times[nextIdx] != null ? toHHMM(times[nextIdx]) : '–';

    const banner = document.getElementById('timeBanner');

    let statusPill;
    if (finished) {
        statusPill = `<span class="time-pill gold">🏁 Fertig</span>`;
        banner.classList.remove('active');
    } else if (active) {
        statusPill = `<span class="time-pill green">▶ Läuft · bis ${endTime}</span>`;
        banner.classList.add('active');
    } else {
        statusPill = `<span class="time-pill">⏸ Pause</span>`;
        banner.classList.remove('active');
    }

    banner.innerHTML = `
        <div>
            <div class="time-lbl">Runde</div>
            <div class="time-val">${finished ? completed : currentNum}<span style="font-size:12px;color:var(--text-muted)"> / ${total}</span></div>
        </div>
        <div style="text-align:center">
            <div class="time-lbl">Nächste Runde</div>
            <div class="time-val" style="font-size:15px">${active ? nextTime : startTime}</div>
        </div>
        <div style="text-align:right">${statusPill}</div>`;
}

// ── Match-Bereich ─────────────────────────────────────────────
function renderMatchArea() {
    const area   = document.getElementById('matchesArea');
    const rounds = tData.rounds || [];
    const active = rounds.find(r => !r.completed);
    const focus  = document.getElementById('playerFocus').value;
    const cls    = isAdmin ? 'is-admin' : '';

    if (tournament?.status === 'finished') {
        const sorted = [...players].sort((a,b) => b.points - a.points);
        area.innerHTML = `<div class="finished-banner mt-4">
            <div style="font-size:36px;margin-bottom:8px">🏆</div>
            <div style="font-size:22px;font-weight:900;color:var(--gold)">${esc(sorted[0]?.name || '')}</div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:4px">Sieger · ${sorted[0]?.points || 0} Punkte</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:8px">${rounds.length} Runden gespielt</div>
        </div>`;
        return;
    }

    let html = '';

    // A) Pending-Runde: Vorschlag mit Drag&Drop
    if (pendingRound && !active) {
        html += renderPendingArea(pendingRound, focus, cls);
    }
    // B) Aktive Runde: Scores eingeben
    else if (active) {
        html += renderActiveArea(active, focus, cls);
    }
    // C) Noch keine Runde (sollte dank auto-pending nicht mehr passieren)
    else {
        html += `<div class="card mt-4" style="padding:28px;text-align:center;color:var(--text-muted)">
            <div style="font-size:36px;margin-bottom:10px">🎾</div>
            <div style="font-size:15px;font-weight:700">Bereit für Runde ${rounds.filter(r=>r.completed).length+1}</div>
            <div style="font-size:12px;margin-top:4px">Admin öffnet die nächste Runde</div>
        </div>`;
    }

    area.innerHTML = html;

    // Event-Listener anhängen
    if (isAdmin && active) attachScoreListeners(active);
    if (isAdmin && pendingRound && !active) attachDragListeners();
}

// ── Pending-Runde (Drag & Drop) ───────────────────────────────
function renderPendingArea(round, focus, cls) {
    const { times } = getRoundTimes();
    const ti = round.roundNumber - 1;
    const timeStr = times[ti] != null ? toHHMM(times[ti]) : '';

    let html = `<div style="display:flex;align-items:center;gap:10px;margin:20px 0 12px">
        <span class="round-time">Runde ${round.roundNumber}${timeStr?' · '+timeStr:''} · Vorschlag</span>
        <div style="flex:1;height:1px;background:var(--border)"></div>
    </div>`;

    if (isAdmin) {
        html += `<div class="drag-banner">✋ Spieler:innen per Drag &amp; Drop tauschen, dann Runde starten.</div>`;
    }

    for (let ci = 0; ci < round.courts.length; ci++) {
        const court = round.courts[ci];
        const pA    = court.teamA.map(id => players.find(p=>p.id===id));
        const pB    = court.teamB.map(id => players.find(p=>p.id===id));
        const isFocused = focus && [...court.teamA,...court.teamB].some(id => players.find(p=>p.id===id)?.name===focus);

        html += `<div class="court-card ${isFocused?'focused':''}" id="pcc-${ci}">
            <div class="court-label">Court ${esc(getCourtName(ci))}</div>
            <div class="teams-row">
                <div class="team">
                    ${pA.map(p=>`<span class="player-chip ${isAdmin?'draggable':''} ${p?.name===focus?'focus-name':''}" ${isAdmin?`draggable="true" data-pid="${p?.id}"`:''}>${esc(p?.name||'?')}</span>`).join('')}
                </div>
                <div class="vs">vs</div>
                <div class="team right">
                    ${pB.map(p=>`<span class="player-chip ${isAdmin?'draggable':''} ${p?.name===focus?'focus-name':''}" ${isAdmin?`draggable="true" data-pid="${p?.id}"`:''}>${esc(p?.name||'?')}</span>`).join('')}
                </div>
            </div>
        </div>`;
    }

    if (isAdmin) {
        html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px">
            <button class="admin-btn admin-btn-primary" onclick="startPendingRound()">▶ Runde starten</button>
            <button class="admin-btn admin-btn-neutral" onclick="reshufflePending()">🔀 Neu mischen</button>
        </div>`;
    }

    return html;
}

// ── Aktive Runde ─────────────────────────────────────────────
function renderActiveArea(round, focus, cls) {
    const { times, matchMin } = getRoundTimes();
    const ti      = round.roundNumber - 1;
    const timeStr = times[ti] != null ? `${toHHMM(times[ti])}–${toHHMM(times[ti]+matchMin)}` : '';

    let html = `<div class="flex" style="align-items:center;gap:10px;margin:20px 0 12px">
        <span class="round-time">Runde ${round.roundNumber}${timeStr?' · '+timeStr:''}</span>
        <div style="flex:1;height:1px;background:var(--border)"></div>
    </div>`;

    for (let ci = 0; ci < round.courts.length; ci++) {
        const court = round.courts[ci];
        const pA    = court.teamA.map(id => players.find(p=>p.id===id));
        const pB    = court.teamB.map(id => players.find(p=>p.id===id));
        const isFocused = focus && [...court.teamA,...court.teamB].some(id=>players.find(p=>p.id===id)?.name===focus);
        const hasScore  = court.scoreA != null && court.scoreB != null;
        const sA = court.scoreA ?? '', sB = court.scoreB ?? '';

        html += `<div class="court-card ${isFocused?'focused':''} ${cls}" id="acc-${ci}">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <span class="court-label">Court ${esc(getCourtName(ci))}</span>
                ${hasScore?`<span style="font-size:11px;color:var(--green);font-weight:700">✓</span>`:''}
            </div>
            <div class="teams-row">
                <div class="team">
                    ${pA.map(p=>`<span class="player-chip ${p?.name===focus?'focus-name':''}">${esc(p?.name||'?')}</span>`).join('')}
                </div>
                <div class="vs">vs</div>
                <div class="team right">
                    ${pB.map(p=>`<span class="player-chip ${p?.name===focus?'focus-name':''}">${esc(p?.name||'?')}</span>`).join('')}
                </div>
            </div>
            <div class="score-row">`;

        if (isAdmin) {
            html += `<input class="score-box" type="number" inputmode="numeric" id="sc-${ci}-A"
                        value="${sA}" min="0" max="99" placeholder="–"
                        onfocus="onTyping()" onblur="onTypingEnd()" oninput="markDirty()">
                     <span class="score-sep">:</span>
                     <input class="score-box" type="number" inputmode="numeric" id="sc-${ci}-B"
                        value="${sB}" min="0" max="99" placeholder="–"
                        onfocus="onTyping()" onblur="onTypingEnd()" oninput="markDirty()">`;
        } else {
            html += `<div class="score-static">${sA !== '' ? sA : '–'}</div>
                     <span class="score-sep">:</span>
                     <div class="score-static">${sB !== '' ? sB : '–'}</div>`;
        }

        html += `</div></div>`;
    }

    return html;
}

// ── Score Event-Listener ──────────────────────────────────────
function attachScoreListeners(round) {
    for (let ci = 0; ci < round.courts.length; ci++) {
        ['A','B'].forEach(side => {
            const el = document.getElementById(`sc-${ci}-${side}`);
            if (el) { el.addEventListener('focus', onTyping); el.addEventListener('blur', onTypingEnd); }
        });
    }
}

function onTyping()    { isTyping = true; clearTimeout(typingTimer); }
function onTypingEnd() { typingTimer = setTimeout(() => isTyping = false, 1500); }
function markDirty()   { dirtyScores = true; document.getElementById('floatingBtn').style.display = 'block'; }

// ── Floating-Save (Scores zwischenspeichern) ──────────────────
async function saveAllDirty() {
    if (!dirtyScores) return;
    await collectAndSaveScores();
    dirtyScores = false;
    document.getElementById('floatingBtn').style.display = 'none';
    showToast('💾 Scores gespeichert','success');
}

function collectAndSaveScores() {
    const rounds = tData.rounds || [];
    const active = rounds.find(r => !r.completed);
    if (!active) return Promise.resolve();

    for (let ci = 0; ci < active.courts.length; ci++) {
        const vA = document.getElementById(`sc-${ci}-A`)?.value;
        const vB = document.getElementById(`sc-${ci}-B`)?.value;
        active.courts[ci].scoreA = (vA !== '' && vA != null) ? Number(vA) : null;
        active.courts[ci].scoreB = (vB !== '' && vB != null) ? Number(vB) : null;
    }
    return saveTData();
}

// ── Admin-Sheet ───────────────────────────────────────────────
function openAdminSheet() {
    document.getElementById('adminSheet').classList.remove('hidden');
    renderAdminSheet();
}

function closeAdminSheet() {
    document.getElementById('adminSheet').classList.add('hidden');
}

function renderAdminSheet() {
    const rounds    = tData.rounds || [];
    const completed = rounds.filter(r => r.completed).length;
    const active    = rounds.find(r => !r.completed);
    const { times } = getRoundTimes();
    const totalR    = times.length;
    const finished  = tournament?.status === 'finished';

    let html = '';

    if (!isAdmin) {
        const pw = tData.settings?.password;
        if (pw) {
            html = `<p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">Passwort eingeben um Admin-Funktionen zu aktivieren.</p>
                <input type="password" id="adminPwInput" class="sheet-input" placeholder="Passwort…">
                <button class="admin-btn admin-btn-primary" onclick="checkAdminPw()">🔓 Einloggen</button>`;
        } else {
            html = `<button class="admin-btn admin-btn-primary" onclick="activateAdmin()">🔓 Admin aktivieren</button>`;
        }
    } else {
        html = `<div style="font-size:11px;color:var(--green);font-weight:700;margin-bottom:14px">✓ Admin-Modus aktiv</div>`;

        if (!finished) {
            // Score-Zwischenspeichern
            if (active) {
                html += `<button class="admin-btn admin-btn-primary" onclick="saveAllDirty();closeAdminSheet()">💾 Scores speichern</button>`;
                html += `<button class="admin-btn admin-btn-success" onclick="finishRound()">✅ Runde abschließen</button>`;
            }
            // Nächste Runde vorbereiten (nur wenn keine aktive + kein pending)
            if (!active && !pendingRound) {
                const nextNum = completed + 1;
                if (nextNum <= totalR) {
                    html += `<button class="admin-btn admin-btn-primary" onclick="prepareNextRound();closeAdminSheet()">📋 Runde ${nextNum} berechnen</button>`;
                }
            }
            // Pending starten/verwerfen
            if (pendingRound && !active) {
                html += `<button class="admin-btn admin-btn-primary" onclick="startPendingRound();closeAdminSheet()">▶ Runde starten</button>`;
                html += `<button class="admin-btn admin-btn-neutral" onclick="reshufflePending();closeAdminSheet()">🔀 Neu mischen</button>`;
                html += `<button class="admin-btn admin-btn-neutral" onclick="pendingRound=null;renderAll();closeAdminSheet()">✕ Verwerfen</button>`;
            }
            // Turnier beenden nach letzter Runde
            if (!active && !pendingRound && completed >= totalR) {
                html += `<button class="admin-btn admin-btn-danger" onclick="finishTournament()">🏁 Turnier beenden</button>`;
            }
        }

        html += `<hr style="border:none;border-top:1.5px solid var(--border);margin:12px 0">
            <button class="admin-btn admin-btn-neutral" onclick="deactivateAdmin()">🔒 Admin deaktivieren</button>`;
    }

    html += `<button class="admin-btn admin-btn-neutral" style="margin-top:4px" onclick="closeAdminSheet()">Schließen</button>`;
    document.getElementById('adminContent').innerHTML = html;
}

function checkAdminPw() {
    const pw  = tData.settings?.password || '';
    const inp = document.getElementById('adminPwInput')?.value || '';
    if (!pw || inp === pw) activateAdmin();
    else showToast('❌ Falsches Passwort','error');
}

function activateAdmin() {
    isAdmin = true;
    sessionStorage.setItem('mex_admin_' + tournamentId, '1');
    document.getElementById('adminBtn').classList.add('active');
    showToast('✓ Admin-Modus aktiv','success');
    closeAdminSheet();
    renderAll();
}

function deactivateAdmin() {
    isAdmin = false;
    pendingRound = null;
    sessionStorage.removeItem('mex_admin_' + tournamentId);
    document.getElementById('adminBtn').classList.remove('active');
    closeAdminSheet();
    renderAll();
}

// ── Admin-Aktionen ────────────────────────────────────────────
function prepareNextRound() {
    const completed = (tData.rounds||[]).filter(r=>r.completed).length;
    pendingRound = calcRound(completed + 1);
    renderAll();
    showToast('📋 Vorschlag erstellt – Drag & Drop zum Anpassen','info');
}

function reshufflePending() {
    if (!pendingRound) return;
    const n = pendingRound.roundNumber;
    pendingRound = calcRound(n);
    renderAll();
    showToast('🔀 Neu gemischt','info');
}

async function startPendingRound() {
    if (!pendingRound) return;
    tData.rounds = [...(tData.rounds||[]), {...pendingRound, completed:false}];
    pendingRound = null;
    await saveTData();
    renderAll();
    showToast('▶ Runde gestartet!','success');
}

async function finishRound() {
    await collectAndSaveScores();

    const rounds = tData.rounds || [];
    const active = rounds.find(r => !r.completed);
    if (!active) return;
    active.completed = true;

    // Elo neu berechnen (fresh rebuild)
    players.forEach(p => { p.points=0;p.wins=0;p.losses=0;p.matches=0;p.liveLevel=p.startLevel;p.reliability=0; });
    for (const r of tData.rounds.filter(x=>x.completed)) applyRoundElo(r);

    const snap = {};
    players.forEach(p => { snap[p.id] = p.liveLevel; });
    active.levelSnapshot = snap;

    // Nächste Runde direkt als pending berechnen
    const { times } = getRoundTimes();
    const nextNum   = tData.rounds.filter(r=>r.completed).length + 1;
    if (nextNum <= times.length) {
        pendingRound = calcRound(nextNum);
    }

    await saveTData();
    closeAdminSheet();
    renderAll();
    showToast('✅ Runde abgeschlossen!','success');
}

async function finishTournament() {
    if (!confirm('Turnier wirklich beenden? Platzierungen werden gespeichert.')) return;

    const sorted = [...players].sort((a,b) => b.points-a.points || b.wins-a.wins);
    for (let i=0; i<sorted.length; i++) {
        const p = sorted[i];
        await sb.from('mex_tournament_players').update({
            final_points: p.points, final_level: p.liveLevel, placement: i+1
        }).eq('tournament_id', tournamentId).eq('player_id', p.id);
    }

    await sb.from('mex_tournaments').update({ status:'finished', data:tData }).eq('id', tournamentId);
    tournament.status = 'finished';
    pendingRound = null;
    closeAdminSheet();
    renderAll();
    showToast('🏁 Turnier beendet & gespeichert!','success');
}

async function saveTData() {
    isSaving = true;
    try {
        const { error } = await sb.from('mex_tournaments').update({ data:tData }).eq('id', tournamentId);
        if (error) throw error;
        localStorage.setItem('mex_backup_' + tournamentId, JSON.stringify({ tData, players, ts:Date.now() }));
    } catch(e) {
        showToast('⚠️ Speicherfehler: ' + e.message,'error');
        throw e;
    } finally { isSaving = false; }
}

// ── Ranking ───────────────────────────────────────────────────
function renderRanking() {
    const focus  = document.getElementById('playerFocus').value;
    const sorted = [...players].sort((a,b) => b.points-a.points || b.wins-a.wins || a.losses-b.losses);

    document.getElementById('rankingTable').innerHTML = sorted.map((p,i) => {
        const isGold  = i===0 && p.points>0;
        const isFocus = p.name===focus;
        const diff    = p.wins - p.losses;
        return `<tr class="${isGold?'rank-gold':''}" style="border-bottom:1.5px solid var(--border);${isFocus?'background:rgba(96,165,250,.07)':''}">
            <td style="padding:14px 16px;font-size:13px;font-weight:800;color:${isGold?'var(--gold)':'var(--text-muted)'}">${isGold?'👑':'#'+(i+1)}</td>
            <td style="padding:14px 10px;font-size:13px;font-weight:${isFocus?'900':'700'};text-transform:uppercase;color:${isFocus?'var(--accent)':'var(--text)'}">${esc(p.name)}</td>
            <td style="padding:14px 10px;text-align:center;font-size:12px;font-weight:600;color:var(--text-muted)">${p.wins}/${p.losses}</td>
            <td style="padding:14px 10px;text-align:center;font-size:16px;font-weight:800;font-family:'Space Mono',monospace;color:var(--text)">${p.points}</td>
            <td style="padding:14px 16px;text-align:center;font-size:13px;font-weight:700;font-family:'Space Mono',monospace;color:${diff>0?'var(--green)':diff<0?'var(--red)':'var(--text-muted)'}">${diff>0?'+':''}${diff}</td>
        </tr>`;
    }).join('');
}

// ── History ───────────────────────────────────────────────────
function renderHistory() {
    const done   = (tData.rounds||[]).filter(r=>r.completed);
    const area   = document.getElementById('historyArea');
    const focus  = document.getElementById('playerFocus').value;
    const { times, matchMin } = getRoundTimes();
    if (!done.length) { area.innerHTML=''; return; }

    let html = '';
    for (const round of [...done].reverse()) {
        const ti      = round.roundNumber - 1;
        const timeStr = times[ti]!=null ? `${toHHMM(times[ti])}–${toHHMM(times[ti]+matchMin)}` : '';
        html += `<div class="history-lbl">Runde ${round.roundNumber}${timeStr?' · '+timeStr:''}</div>`;
        for (let ci=0; ci<round.courts.length; ci++) {
            const court = round.courts[ci];
            const pA    = court.teamA.map(id=>players.find(p=>p.id===id));
            const pB    = court.teamB.map(id=>players.find(p=>p.id===id));
            const hasSc = court.scoreA!=null && court.scoreB!=null;
            const wA    = hasSc && court.scoreA>court.scoreB;
            const wB    = hasSc && court.scoreB>court.scoreA;
            const isFoc = focus && [...court.teamA,...court.teamB].some(id=>players.find(p=>p.id===id)?.name===focus);
            html += `<div class="history-card ${isFoc?'focused':''}">
                <div class="court-label" style="margin-bottom:8px">Court ${esc(getCourtName(ci))}</div>
                <div class="teams-row">
                    <div class="team" style="opacity:${wB?.45:1}">
                        ${pA.map(p=>`<span class="player-chip" style="font-size:12px">${esc(p?.name||'?')}</span>`).join('')}
                    </div>
                    <div style="text-align:center;flex-shrink:0">
                        ${hasSc
                            ? `<div style="font-family:'Space Mono',monospace;font-weight:700;font-size:17px;color:var(--text)">${court.scoreA}:${court.scoreB}</div>`
                            : `<div class="vs">vs</div>`}
                    </div>
                    <div class="team right" style="opacity:${wA?.45:1}">
                        ${pB.map(p=>`<span class="player-chip" style="font-size:12px">${esc(p?.name||'?')}</span>`).join('')}
                    </div>
                </div>
            </div>`;
        }
    }
    area.innerHTML = html;
}

// ── Fokus-Dropdown ────────────────────────────────────────────
function setupFocusDropdown() {
    const sel   = document.getElementById('playerFocus');
    const saved = localStorage.getItem('mex_focus_' + tournamentId);
    sel.innerHTML = '<option value="">Alle anzeigen</option>';
    [...players].sort((a,b)=>a.name.localeCompare(b.name))
        .forEach(p => sel.add(new Option(p.name, p.name)));
    if (saved) sel.value = saved;
}

function saveFocus() {
    const v = document.getElementById('playerFocus').value;
    v ? localStorage.setItem('mex_focus_'+tournamentId,v)
      : localStorage.removeItem('mex_focus_'+tournamentId);
    renderAll();
}

// ── Drag & Drop (Mouse + Touch) ───────────────────────────────
let dragPid = null;

function attachDragListeners() {
    document.querySelectorAll('[data-pid]').forEach(el => {
        el.addEventListener('dragstart', onDragStart);
        el.addEventListener('dragend',   onDragEnd);
        el.addEventListener('touchstart', onTouchStart, { passive:true });
        el.addEventListener('touchmove',  onTouchMove,  { passive:false });
        el.addEventListener('touchend',   onTouchEnd);
    });
    document.querySelectorAll('[id^="pcc-"]').forEach(el => {
        el.addEventListener('dragover',  e => { e.preventDefault(); el.classList.add('drag-target'); });
        el.addEventListener('dragleave', () => el.classList.remove('drag-target'));
        el.addEventListener('drop',      onMouseDrop);
    });
}

function onDragStart(e) {
    dragPid = e.currentTarget.dataset.pid;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}
function onDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('[id^="pcc-"]').forEach(el=>el.classList.remove('drag-target'));
}
function onMouseDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-target');
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-pid]');
    if (target && target.dataset.pid !== dragPid) swapPlayers(dragPid, target.dataset.pid);
    dragPid = null;
}

// Touch
let touchEl = null;
function onTouchStart(e) {
    touchEl = e.currentTarget;
    dragPid = touchEl.dataset.pid;
    touchEl.classList.add('dragging');
    const ghost = document.getElementById('dragGhost');
    ghost.textContent = touchEl.textContent.trim();
    ghost.style.display = 'block';
}
function onTouchMove(e) {
    e.preventDefault();
    const t = e.touches[0];
    const ghost = document.getElementById('dragGhost');
    ghost.style.left = (t.clientX - 60) + 'px';
    ghost.style.top  = (t.clientY - 20) + 'px';
    document.querySelectorAll('[id^="pcc-"]').forEach(el=>el.classList.remove('drag-target'));
    document.elementFromPoint(t.clientX,t.clientY)?.closest('[id^="pcc-"]')?.classList.add('drag-target');
}
function onTouchEnd(e) {
    document.getElementById('dragGhost').style.display = 'none';
    touchEl?.classList.remove('dragging');
    document.querySelectorAll('[id^="pcc-"]').forEach(el=>el.classList.remove('drag-target'));
    const t      = e.changedTouches[0];
    const target = document.elementFromPoint(t.clientX,t.clientY)?.closest('[data-pid]');
    if (target && target.dataset.pid !== dragPid) swapPlayers(dragPid, target.dataset.pid);
    dragPid = null; touchEl = null;
}

function swapPlayers(pidA, pidB) {
    if (!pendingRound) return;
    let posA=null, posB=null;
    for (let ci=0; ci<pendingRound.courts.length; ci++) {
        const c = pendingRound.courts[ci];
        let idx;
        idx=c.teamA.indexOf(pidA); if(idx!==-1) posA={ci,team:'A',idx};
        idx=c.teamB.indexOf(pidA); if(idx!==-1) posA={ci,team:'B',idx};
        idx=c.teamA.indexOf(pidB); if(idx!==-1) posB={ci,team:'A',idx};
        idx=c.teamB.indexOf(pidB); if(idx!==-1) posB={ci,team:'B',idx};
    }
    if (!posA||!posB) return;
    const cA = pendingRound.courts[posA.ci];
    const cB = pendingRound.courts[posB.ci];
    (posA.team==='A'?cA.teamA:cA.teamB)[posA.idx] = pidB;
    (posB.team==='A'?cB.teamA:cB.teamB)[posB.idx] = pidA;
    showToast('↕️ Getauscht','info');
    renderMatchArea();
    attachDragListeners();
}

// ── Realtime + Polling ────────────────────────────────────────
function setupRealtime() {
    sb.channel('mex-' + tournamentId)
        .on('postgres_changes', { event:'UPDATE', schema:'public', table:'mex_tournaments', filter:`id=eq.${tournamentId}` },
            payload => {
                realtimeConn = true;
                if (isTyping || isSaving) { setTimeout(()=>{if(!isTyping&&!isSaving)onRemoteUpdate(payload.new)},3000); return; }
                onRemoteUpdate(payload.new);
            })
        .subscribe(s => { if(s==='SUBSCRIBED'){realtimeConn=true;console.log('[Realtime] Connected')} });
}

function onRemoteUpdate(row) {
    if (isAdmin) return; // Admin hat lokalen State
    tData = row.data || tData;
    tournament.status = row.status;
    buildPlayers((tournament.mex_tournament_players||[])); // rebuild ohne erneuten DB-Call
    renderAll();
}

function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(async () => {
        if (realtimeConn||isAdmin) return;
        await loadTournament();
    }, 15000);
}

function setupVisibility() {
    document.addEventListener('visibilitychange', async () => {
        if (!document.hidden && !isAdmin) await loadTournament();
    });
}

async function manualRefresh() {
    const icon = document.getElementById('refreshIcon');
    icon.classList.add('spin');
    await loadTournament();
    setTimeout(()=>icon.classList.remove('spin'),800);
    showToast('✓ Aktualisiert','success');
}

// ── Utils ─────────────────────────────────────────────────────
function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, type='info') {
    const colors = {success:'#4ade80',warning:'#fbbf24',error:'#f87171',info:'#60a5fa'};
    const toast  = document.getElementById('toast');
    toast.innerHTML = `<div style="background:${colors[type]||colors.info};color:#000;padding:14px 20px;border-radius:14px;font-size:14px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.25)">${msg}</div>`;
    toast.classList.add('show');
    setTimeout(()=>toast.classList.remove('show'),3000);
}

function showFatal(msg) {
    document.getElementById('matchesArea').innerHTML =
        `<div style="padding:40px 20px;text-align:center;color:var(--red);font-weight:700">${esc(msg)}</div>`;
}

// ── Start ─────────────────────────────────────────────────────
init();
