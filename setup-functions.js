// ============================================================
// PADEL HIRSCH - SETUP FUNCTIONS
// Americano System & Core Functions
// ============================================================

// ============================================================
// SUPABASE
// ============================================================
const SB_URL = "https://vjcvchczbyvhweiwrunp.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqY3ZjaGN6Ynl2aHdlaXdydW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NjkzNjYsImV4cCI6MjA4NTM0NTM2Nn0.A01bxl9dNzgmeDcOV2HZIIa2pN5vhWg3q0_FhqO1R2M";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

// ============================================================
// GLOBAL STATE
// ============================================================
let currentSchedule = [];
let players = [];
let tournamentsList = [];
let currentAppMode = 'americano';
let courtNames = ['1','2','3'];

// ============================================================
// MODE TOGGLE
// ============================================================
function switchMode(mode) {
    currentAppMode = mode;
    document.getElementById('modeBtn_americano').classList.toggle('active', mode === 'americano');
    document.getElementById('modeBtn_ko').classList.toggle('active', mode === 'ko');
    document.getElementById('americanoSection').classList.toggle('hidden', mode !== 'americano');
    document.getElementById('koSection').classList.toggle('hidden', mode !== 'ko');
    document.getElementById('headerSubtitle').textContent = mode === 'americano'
        ? 'Smart-Mix Engine v2.0 · Americano Optimizer'
        : 'K.O. System · 8 oder 16 Teams · Vorrunde + Bracket';
    if (mode === 'ko') koUpdateTeamInputs();
}

// ============================================================
// INIT
// ============================================================
async function init() {
    try {
        const { data } = await supabaseClient.from('tournaments').select('id, data');
        tournamentsList = data || [];
        const sel = document.getElementById('tournamentSelect');
        while (sel.options.length > 1) sel.remove(1);
        tournamentsList.filter(t => t.id !== 'LIVE_CONFIG').forEach(t => sel.add(new Option(t.id, t.id)));
        const urlParam = window.location.search.substring(1);
        if (urlParam && tournamentsList.some(t => t.id === urlParam)) {
            sel.value = urlParam; loadTournament(urlParam);
        } else { updatePlayerInputs(); }
    } catch(e) { console.warn('Supabase offline.', e); updatePlayerInputs(); }
    toggleModeUI();
    koUpdateTeamInputs();
}

// ============================================================
// LOAD TOURNAMENT
// ============================================================
async function loadTournament(id) {
    if (id === 'new') {
        document.getElementById('deleteBtn').classList.add('hidden');
        document.getElementById('tName').value = '';
        document.getElementById('tPassword').value = '';
        document.getElementById('previewArea').classList.add('hidden');
        document.getElementById('koBracketArea').classList.add('hidden');
        updatePlayerInputs();
        return;
    }
    const entry = tournamentsList.find(t => t.id === id);
    if (!entry?.data) return;
    const d = entry.data;

    // K.O. TOURNAMENT
    if (d.tournament_type === 'knockout') {
        switchMode('ko');
        document.getElementById('koTName').value = id;
        document.getElementById('koTPassword').value = d.password || '';
        if (d.koCourts) document.getElementById('koCourts').value = d.koCourts;
        if (d.koStartTime) document.getElementById('koStartTime').value = d.koStartTime;
        if (d.koMatchTime) document.getElementById('koMatchTime').value = d.koMatchTime;
        if (d.koPause != null) document.getElementById('koPause').value = d.koPause;
        if (d.koCourtHours != null) document.getElementById('koCourtHours').value = d.koCourtHours;
        
        // Court Names
        if (d.koCourtNames?.length) {
            d.koCourtNames.forEach((name, i) => {
                const el = document.getElementById(`koCourt${i+1}Name`);
                if (el) el.value = name;
            });
            koUpdateCourtNamesSection();
        }
        
        // Expiry Date
        if (d.expiry_date) {
            document.getElementById('koExpiryEnabled').checked = true;
            koToggleExpiry();
            const dateObj = new Date(d.expiry_date);
            const localISO = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000).toISOString().slice(0,16);
            document.getElementById('koExpiryDate').value = localISO;
        }
        
        koTeamCount = d.koTeamCount || 8;
        koSelectTeamCount(koTeamCount, true);
        if (d.koTeams?.length) {
            koTeams = d.koTeams;
            koUpdateTeamInputs(d.koTeams);
        }
        if (d.koBracket) {
            koBracketData = d.koBracket;
            if (koTeamCount === 8) { ko8RenderAll(); }
            else { ko16RenderAll(); }
            document.getElementById('koBracketArea').classList.remove('hidden');
        }
        document.getElementById('deleteBtn').classList.remove('hidden');
        return;
    }

    // AMERICANO TOURNAMENT
    switchMode('americano');
    document.getElementById('tName').value = id;
    document.getElementById('tPassword').value = d.password || '';
    if (d.t) {
        if (d.t.start != null) document.getElementById('startTime').value = d.t.start;
        if (d.t.warmup != null) document.getElementById('warmup').value = d.t.warmup;
        if (d.t.match != null) document.getElementById('matchTime').value = d.t.match;
    }
    if (d.courts != null) document.getElementById('cCount').value = d.courts;
    if (d.totalHours != null) document.getElementById('totalHours').value = d.totalHours;
    if (d.mode) { 
        const el = document.querySelector(`input[name="mode"][value="${d.mode}"]`); 
        if(el) el.checked = true; 
    }
    if (d.isTeam != null) { 
        const el = document.querySelector(`input[name="tType"][value="${d.isTeam?'team':'solo'}"]`); 
        if(el) el.checked = true; 
    }
    if (d.p?.length) { 
        document.getElementById('pCount').value = d.p.length; 
        updatePlayerInputs(d.p); 
    }
    
    // Court Names
    if (d.courtNames?.length) {
        d.courtNames.forEach((name, i) => {
            const el = document.getElementById(`court${i+1}Name`);
            if (el) el.value = name;
        });
        updateCourtNamesSection();
    }
    
    // Expiry Date
    if (d.expiry_date) {
        document.getElementById('expiryEnabled').checked = true;
        toggleExpiry();
        const dateObj = new Date(d.expiry_date);
        const localISO = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000).toISOString().slice(0,16);
        document.getElementById('expiryDate').value = localISO;
    }
    
    if (d.s_new?.length) { 
        players = d.p || []; 
        currentSchedule = d.s_new; 
        renderPreview(false, false, true); 
    }
    document.getElementById('deleteBtn').classList.remove('hidden');
    toggleModeUI(); 
    checkConsistency();
}

// ============================================================
// PASSWORD TOGGLE
// ============================================================
function togglePw() {
    const el = document.getElementById('tPassword');
    const btn = document.getElementById('eyeBtn');
    if(el.type === 'password') {
        el.type = 'text'; 
        btn.innerText = '🙈';
    } else {
        el.type = 'password'; 
        btn.innerText = '👁️';
    }
}

// ============================================================
// COURT NAMES MANAGEMENT
// ============================================================
function updateCourtNamesSection() {
    const count = parseInt(document.getElementById('cCount').value) || 1;
    const section = document.getElementById('courtNamesSection');
    if (count > 1) {
        section.classList.remove('hidden');
        // Show/hide fields based on count
        for (let i = 1; i <= 3; i++) {
            const el = document.getElementById(`court${i}Name`);
            if (el) el.style.display = i <= count ? 'block' : 'none';
        }
    } else {
        section.classList.add('hidden');
    }
}

function readCourtNames() {
    const count = parseInt(document.getElementById('cCount').value) || 1;
    courtNames = [];
    for (let i = 0; i < count; i++) {
        const val = document.getElementById(`court${i+1}Name`)?.value.trim() || (i+1).toString();
        courtNames.push(val);
    }
    return courtNames;
}

// ============================================================
// EXPIRY DATE MANAGEMENT
// ============================================================
function toggleExpiry() {
    const enabled = document.getElementById('expiryEnabled').checked;
    document.getElementById('expiryDateSection').classList.toggle('hidden', !enabled);
}

function getExpiryDate() {
    const enabled = document.getElementById('expiryEnabled')?.checked;
    if (!enabled) return null;
    const val = document.getElementById('expiryDate')?.value;
    return val ? new Date(val).toISOString() : null;
}

// ============================================================
// MODE UI (Americano)
// ============================================================
function toggleModeUI() {
    const isTime = document.querySelector('input[name="mode"]:checked').value === 'time';
    document.getElementById('optSection').style.display = isTime ? 'block' : 'none';
    document.getElementById('pointsModeInfo').classList.toggle('hidden', isTime);
    updateCountLabel();
    checkConsistency();
}

function updateCountLabel() {
    const isTeam = document.querySelector('input[name="tType"]:checked')?.value === 'team';
    const label = document.querySelector('label[for="pCount"]') || document.querySelectorAll('.lbl')[2];
    if (label) {
        label.innerHTML = isTeam
            ? 'Anzahl Teams <span style="font-size:8px;opacity:0.7;">(je 2 Spieler)</span>'
            : 'Spieler';
    }
}

// ============================================================
// PLAYER INPUTS (Americano)
// ============================================================
function updatePlayerInputs(preloadNames = null) {
    updateCountLabel();
    const count = parseInt(document.getElementById('pCount').value) || 6;
    const isTeam = document.querySelector('input[name="tType"]:checked').value === 'team';
    const existing = Array.from(document.querySelectorAll('#playerList input')).map(i => i.value);
    document.getElementById('playerListLabel').textContent = isTeam ? 'Feste 2er-Teams' : 'Teilnehmer:innen';
    document.getElementById('teamModeInfo').classList.toggle('hidden', !isTeam);
    let html = '';
    if(isTeam) {
        for(let teamIdx = 0; teamIdx < count; teamIdx++) {
            const playerAIdx = teamIdx * 2;
            const playerBIdx = teamIdx * 2 + 1;
            const valA = preloadNames?.[playerAIdx] || existing[playerAIdx] || `Spieler ${playerAIdx+1}`;
            const valB = preloadNames?.[playerBIdx] || existing[playerBIdx] || `Spieler ${playerBIdx+1}`;
            html += `<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:6px;">
                <div>
                    <label style="font-size:9px; font-weight:700; color:var(--muted); text-transform:uppercase; display:block; margin-bottom:3px;">Team ${teamIdx+1} · Spieler A</label>
                    <input type="text" id="pIdx_${playerAIdx}" value="${valA.replace(/"/g,'&quot;')}" style="margin:0;">
                </div>
                <div>
                    <label style="font-size:9px; font-weight:700; color:var(--muted); text-transform:uppercase; display:block; margin-bottom:3px;">Spieler B</label>
                    <input type="text" id="pIdx_${playerBIdx}" value="${valB.replace(/"/g,'&quot;')}" style="margin:0;">
                </div>
            </div>`;
        }
    } else {
        for(let i = 0; i < count; i++) {
            let val = preloadNames?.[i] || existing[i] || `Spieler ${i+1}`;
            html += `<input type="text" id="pIdx_${i}" value="${val.replace(/"/g,'&quot;')}">`;
        }
    }
    document.getElementById('playerList').innerHTML = html;
}

// ============================================================
// CONSISTENCY CHECK (Americano)
// ============================================================
function checkConsistency() {
    const countRaw = parseInt(document.getElementById('pCount').value) || 0;
    const isTeam = document.querySelector('input[name="tType"]:checked')?.value === 'team';
    const count = isTeam ? countRaw * 2 : countRaw;
    const courts = parseInt(document.getElementById('cCount').value) || 1;
    const totalMin = parseFloat(document.getElementById('totalHours').value) * 60 || 0;
    const matchTime = parseInt(document.getElementById('matchTime').value) || 0;
    const warmup = parseInt(document.getElementById('warmup').value) || 0;
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const errBox = document.getElementById('inputError');
    const warnBox = document.getElementById('consistencyWarning');
    let errors = [];
    let warnings = [];
    
    if(count < 2) errors.push('Mindestens 2 Spieler/Teams nötig.');
    if(courts < 1) errors.push('Mindestens 1 Platz nötig.');
    if(matchTime < 5) errors.push('Match-Zeit muss mindestens 5 Min. sein.');
    if(totalMin < 10) errors.push('Gesamtdauer muss mindestens 10 Min. sein.');
    if(warmup >= totalMin) errors.push('Aufwärm-Zeit darf nicht länger als Gesamtdauer sein.');
    if(count < 4 && courts >= 1) errors.push('Mindestens 4 Spieler/Teams für ein Match nötig.');
    
    if(!errors.length && matchTime > 0) {
        const netto = totalMin - warmup;
        const rounds = Math.floor(netto / matchTime);
        if(rounds < 1) {
            errors.push('Zu wenig Zeit für 1 Runde.');
        } else {
            const slots = rounds * courts * 4;
            if(slots % count !== 0) {
                warnings.push(`⚠️ ${slots} Slots für ${count} Spieler → ungleiche Verteilung. Nutze "Setup-Optionen" für fairen Plan. Puffer: ${netto-(rounds*matchTime)} Min.`);
            }
            if(mode === 'points') {
                warnings.push(`🎯 Ca. ${rounds} Runden geschätzt (max. ${matchTime} Min./Runde).`);
            }
        }
    }
    
    errBox.classList.toggle('hidden', !errors.length);
    errBox.innerHTML = errors.join('<br>');
    warnBox.classList.toggle('hidden', !warnings.length);
    warnBox.innerHTML = warnings.join('<br>');
    
    // Update court names section
    updateCourtNamesSection();
}

// ============================================================
// SETUP OPTIONS (Americano)
// ============================================================
function showOptimalProposals() {
    const countRaw = parseInt(document.getElementById('pCount').value) || 6;
    const isTeam = document.querySelector('input[name="tType"]:checked')?.value === 'team';
    const count = isTeam ? countRaw * 2 : countRaw;
    const courts = parseInt(document.getElementById('cCount').value) || 1;
    const netto = parseFloat(document.getElementById('totalHours').value) * 60 - (parseInt(document.getElementById('warmup').value) || 0);
    let html = '';
    let found = 0;
    
    for(let r = 2; r <= 25; r++) {
        const mt = Math.floor(netto / r / 5) * 5;
        if(mt < 10 || mt * r > netto) continue;
        const slots = r * courts * 4;
        const ppp = slots / count;
        const isFair = Number.isInteger(ppp);
        const buffer = netto - mt * r;
        if(!isFair && buffer < 5) continue;
        
        html += `<div class="opt-card">
            <div>
                <span class="badge ${isFair?'badge-amber':'badge-blue'}">${isFair?'Perfekt fair':'Ausgleich nötig'}</span>
                <div class="opt-time" style="margin:10px 0 4px;">${mt}<span style="font-size:16px;font-weight:700"> Min.</span></div>
                <p style="font-size:11px;color:var(--muted);font-weight:500;">🎾 ${r} Runden · ${courts} ${courts>1?'Plätze':'Platz'}</p>
                <p style="font-size:11px;color:var(--blue);font-weight:700;margin-top:4px;">🏃 ~${Math.floor(ppp*mt)} Min. pro Person</p>
                <div style="font-size:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:6px 8px;margin-top:8px;">
                    <span style="color:var(--muted);">Puffer: </span><strong>${buffer} Min. ${buffer>=15?'🔥':buffer>=5?'👍':'⚡'}</strong>
                    <span style="display:block;color:${isFair?'var(--green)':'var(--muted)'};">${isFair?`✅ Jeder spielt ${Math.round(ppp)}×`:`⌀ ${ppp.toFixed(1)}× pro Person`}</span>
                </div>
            </div>
            <button class="opt-apply" onclick="applyOpt(${mt})">Wählen</button>
        </div>`;
        if(++found >= 6) break;
    }
    
    if(!html) {
        html = `<div style="grid-column:1/-1;text-align:center;color:var(--red);font-size:11px;padding:16px;">Keine sinnvollen Optionen. Bitte Dauer oder Plätze anpassen.</div>`;
    }
    
    const disp = document.getElementById('optDisplay');
    disp.innerHTML = html;
    disp.style.display = 'grid';
}

function applyOpt(val) {
    document.getElementById('matchTime').value = val;
    checkConsistency();
    document.getElementById('optDisplay').style.display = 'none';
}

// ============================================================
// INPUT HELPER
// ============================================================
function getInputs() {
    const countRaw = parseInt(document.getElementById('pCount').value) || 6;
    const isTeam = document.querySelector('input[name="tType"]:checked').value === 'team';
    const count = isTeam ? countRaw * 2 : countRaw;
    const courts = parseInt(document.getElementById('cCount').value) || 1;
    const totalMin = parseFloat(document.getElementById('totalHours').value) * 60 || 120;
    const matchTime = parseInt(document.getElementById('matchTime').value) || 15;
    const warmup = parseInt(document.getElementById('warmup').value) || 0;
    const start = document.getElementById('startTime').value || '18:00';
    const mode = document.querySelector('input[name="mode"]:checked').value;
    return {
        count, courts, totalMin, matchTime, warmup, start, mode, isTeam,
        nettoMin: totalMin - warmup,
        numRounds: Math.max(1, Math.floor((totalMin - warmup) / matchTime))
    };
}

// ============================================================
// OPTIMIZATION ENGINE
// ============================================================
function calcPenalty(schedule, numPlayers) {
    const partner = Array.from({length: numPlayers}, () => new Array(numPlayers).fill(0));
    const opponent = Array.from({length: numPlayers}, () => new Array(numPlayers).fill(0));
    const plays = new Array(numPlayers).fill(0);
    
    schedule.forEach(r => {
        r.matches.forEach(m => {
            const [a, b, c, d] = [m.team1[0], m.team1[1], m.team2[0], m.team2[1]];
            [a, b, c, d].filter(p => p !== undefined && p < numPlayers).forEach(p => plays[p]++);
            if(a !== undefined && b !== undefined && a < numPlayers && b < numPlayers) {
                partner[a][b]++; partner[b][a]++;
            }
            if(c !== undefined && d !== undefined && c < numPlayers && d < numPlayers) {
                partner[c][d]++; partner[d][c]++;
            }
            [a, b].forEach(t1 => {
                [c, d].forEach(t2 => {
                    if(t1 !== undefined && t2 !== undefined && t1 < numPlayers && t2 < numPlayers) {
                        opponent[t1][t2]++; opponent[t2][t1]++;
                    }
                });
            });
        });
    });
    
    let penalty = 0;
    const avg = plays.reduce((a, b) => a + b, 0) / numPlayers;
    plays.forEach(p => { penalty += Math.pow(p - avg, 2) * 100; });
    for(let i = 0; i < numPlayers; i++) {
        for(let j = i + 1; j < numPlayers; j++) {
            if(partner[i][j] > 1) penalty += Math.pow(partner[i][j] - 1, 2) * 10;
            if(opponent[i][j] > 2) penalty += Math.pow(opponent[i][j] - 2, 2) * 3;
        }
    }
    
    return { penalty, plays, partner, opponent };
}

function smartSelect(pool, needed, partnerCount, opponentCount) {
    if(pool.length <= needed) return [...pool];
    let remaining = [...pool];
    let selected = [];
    const firstIdx = Math.floor(Math.random() * Math.max(1, Math.ceil(remaining.length / 3)));
    selected.push(remaining.splice(firstIdx, 1)[0]);
    
    while(selected.length < needed && remaining.length > 0) {
        let best = null;
        let bestScore = Infinity;
        remaining.forEach(p => {
            const score = selected.reduce((sum, s) => sum + partnerCount[p][s] * 10 + opponentCount[p][s] * 3, 0) + Math.random() * 2;
            if(score < bestScore) {
                bestScore = score;
                best = p;
            }
        });
        selected.push(best);
        remaining = remaining.filter(p => p !== best);
    }
    
    if(needed === 4 && selected.length === 4) {
        const [a, b, c, d] = selected;
        const pairings = [[a, b, c, d], [a, c, b, d], [a, d, b, c]];
        let bestPair = pairings[0];
        let bestPairScore = Infinity;
        pairings.forEach(([p1, p2, p3, p4]) => {
            const sc = partnerCount[p1][p2] * 20 + partnerCount[p3][p4] * 20 + 
                      opponentCount[p1][p3] * 3 + opponentCount[p1][p4] * 3 + 
                      opponentCount[p2][p3] * 3 + opponentCount[p2][p4] * 3;
            if(sc < bestPairScore) {
                bestPairScore = sc;
                bestPair = [p1, p2, p3, p4];
            }
        });
        return bestPair;
    }
    
    return selected;
}

function generateVariant(inputs) {
    const { count, courts, matchTime, warmup, start, numRounds } = inputs;
    let [sH, sM] = start.split(':').map(Number);
    let schedule = [];
    let playTracker = new Array(count).fill(0);
    const partnerCount = Array.from({length: count}, () => new Array(count).fill(0));
    const opponentCount = Array.from({length: count}, () => new Array(count).fill(0));
    
    for(let r = 1; r <= numRounds; r++) {
        const tMin = sH * 60 + sM + warmup + (r - 1) * matchTime;
        const timeStr = `${String(Math.floor(tMin / 60) % 24).padStart(2, '0')}:${String(tMin % 60).padStart(2, '0')}`;
        let pool = [...Array(count).keys()].sort((a, b) => playTracker[a] - playTracker[b]);
        let rem = [...pool];
        let round = { id: r, time: timeStr, pause: [], matches: [] };
        
        for(let c = 0; c < courts; c++) {
            if(rem.length < 4) break;
            const chosen = smartSelect(rem, 4, partnerCount, opponentCount);
            rem = rem.filter(p => !chosen.includes(p));
            const [p1, p2, p3, p4] = chosen;
            [p1, p2, p3, p4].forEach(p => { if(p !== undefined) playTracker[p]++; });
            if(p1 !== undefined && p2 !== undefined) {
                partnerCount[p1][p2]++; partnerCount[p2][p1]++;
            }
            if(p3 !== undefined && p4 !== undefined) {
                partnerCount[p3][p4]++; partnerCount[p4][p3]++;
            }
            [p1, p2].forEach(a => {
                [p3, p4].forEach(b => {
                    if(a !== undefined && b !== undefined) {
                        opponentCount[a][b]++; opponentCount[b][a]++;
                    }
                });
            });
            round.matches.push({ court: c + 1, team1: [p1, p2], team2: [p3, p4] });
        }
        round.pause = rem;
        schedule.push(round);
    }
    
    return schedule;
}

async function runOptimization() {
    if(!document.getElementById('inputError').classList.contains('hidden')) {
        alert('Bitte zuerst die Eingabefehler beheben!');
        return;
    }
    
    players = Array.from(document.querySelectorAll('#playerList input')).map(i => i.value.trim()).filter(Boolean);
    const inputs = getInputs();
    const totalSlots = inputs.numRounds * inputs.courts * 4;
    const remainder = totalSlots % players.length;
    const isPerfectlyFair = (remainder === 0);
    const isDummyMode = !isPerfectlyFair;
    const isFinalMode = isPerfectlyFair;
    
    const btn = document.getElementById('mixBtn');
    const txt = document.getElementById('mixBtnText');
    const spin = document.getElementById('mixSpinner');
    btn.disabled = true;
    txt.textContent = 'Optimiere…';
    spin.classList.remove('hidden');
    await new Promise(r => setTimeout(r, 30));
    
    let bestSchedule = null;
    let lowestPenalty = Infinity;
    for(let i = 0; i < 500; i++) {
        const sched = generateVariant(inputs);
        const { penalty } = calcPenalty(sched, players.length);
        if(penalty < lowestPenalty) {
            lowestPenalty = penalty;
            bestSchedule = sched;
        }
    }
    
    const lastTime = bestSchedule[bestSchedule.length - 1];
    const [lH, lM] = lastTime.time.split(':').map(Number);
    const nextMin = lH * 60 + lM + inputs.matchTime;
    const nextTime = `${String(Math.floor(nextMin / 60) % 24).padStart(2, '0')}:${String(nextMin % 60).padStart(2, '0')}`;
    
    if(isDummyMode) {
        const { plays } = calcPenalty(bestSchedule, players.length);
        const minPlays = Math.min(...plays);
        const underPlayed = plays.map((p, i) => ({ i, p })).filter(x => x.p === minPlays).map(x => x.i);
        const balanceMatches = [];
        let rem = [...underPlayed];
        let courtNum = 1;
        while(rem.length > 0) {
            const p1 = rem.shift() ?? null;
            const p2 = rem.shift() ?? null;
            const p3 = rem.shift() ?? null;
            const p4 = rem.shift() ?? null;
            if(p1 !== null) {
                balanceMatches.push({ court: courtNum++, team1: [p1, p2], team2: [p3, p4] });
            }
        }
        const balancePause = plays.map((p, i) => ({ i, p })).filter(x => x.p > minPlays).map(x => x.i);
        bestSchedule.push({
            id: bestSchedule.length + 1,
            time: nextTime,
            isBalance: true,
            matches: balanceMatches,
            pause: balancePause
        });
    } else {
        bestSchedule.push({
            id: bestSchedule.length + 1,
            time: nextTime,
            isFinale: true,
            matches: [{ court: 1, team1: ['PLATZ1', 'PLATZ4'], team2: ['PLATZ2', 'PLATZ3'] }],
            pause: []
        });
    }
    
    currentSchedule = bestSchedule;
    btn.disabled = false;
    txt.textContent = 'Plan bestmöglich mischen';
    spin.classList.add('hidden');
    renderPreview(isDummyMode, isFinalMode, false);
}

// ============================================================
// RENDER PREVIEW
// ============================================================
function renderPreview(isDummyMode, isFinalMode, isReadonly) {
    if(!players.length) players = Array.from(document.querySelectorAll('#playerList input')).map(i => i.value.trim());
    document.getElementById('previewArea').classList.remove('hidden');
    const mode = document.querySelector('input[name="mode"]:checked')?.value || 'time';
    const ccls = ['c1', 'c2', 'c3', 'c4'];
    
    document.getElementById('previewList').innerHTML = currentSchedule.map((r, idx) => {
        const isLast = idx === currentSchedule.length - 1;
        let roundLabel = `Runde ${r.id}`;
        let cardCls = 'round-card';
        let extra = '';
        let badgeHtml = '';
        
        if(!isReadonly && isLast && isFinalMode) {
            roundLabel = '🏆 Finale der besten 4';
            cardCls = 'round-card round-finale';
            badgeHtml = '<span class="badge badge-amber">Finale</span>';
            extra = `<p style="font-size:9px;color:#92400e;text-align:center;margin-top:8px;font-weight:600;">Zählt nicht für Statistik</p>`;
        } else if(!isReadonly && isLast && isDummyMode) {
            roundLabel = '⚖️ Ausgleichsspiel';
            cardCls = 'round-card round-balance';
            badgeHtml = '<span class="badge badge-blue">Ausgleich</span>';
            extra = `<p style="font-size:9px;color:#1e40af;text-align:center;margin-top:8px;font-weight:600;">Echte Spieler werden normal gewertet · Virtuelle Gegner zählen nicht</p>`;
        }
        
        const matchHtml = r.matches.map(m => {
            let p1, p2, p3, p4;
            if(r.isFinale) {
                p1 = '🥇 Platz 1'; p2 = '🥈 Platz 4'; p3 = '🥈 Platz 2'; p4 = '🥉 Platz 3';
            } else if(r.isBalance) {
                const getName = (idx) => { 
                    if(idx === null || idx === undefined) return null; 
                    return players[idx] || null; 
                };
                const n1 = getName(m.team1[0]);
                const n2 = getName(m.team1[1]);
                const n3 = getName(m.team2[0]);
                const n4 = getName(m.team2[1]);
                let virtNum = 1;
                p1 = n1 || (virtNum++ === 1 ? 'Virtuell 1' : 'Virtuell 2');
                p2 = n2 || (virtNum++ === 1 ? 'Virtuell 1' : 'Virtuell 2');
                p3 = n3 || (virtNum++ === 1 ? 'Virtuell 1' : 'Virtuell 2');
                p4 = n4 || (virtNum++ === 1 ? 'Virtuell 1' : 'Virtuell 2');
            } else {
                p1 = players[m.team1[0]] || 'Virtuell 1';
                p2 = players[m.team1[1]] || 'Virtuell 2';
                p3 = players[m.team2[0]] || 'Virtuell 1';
                p4 = players[m.team2[1]] || 'Virtuell 2';
            }
            const v = n => n && (n.startsWith('Virtuell'));
            const cc = ccls[(m.court - 1) % ccls.length];
            const courtLabel = courtNames[m.court - 1] || m.court;
            return `<div class="match-row ${cc}">
                <span class="court-tag">C${courtLabel}</span>
                <div class="match-names">
                    <span class="${v(p1)?'virt':''}">${p1}</span> <span style="color:#cbd5e1;">+</span> <span class="${v(p2)?'virt':''}">${p2}</span>
                    <span class="vs-tag" style="margin:0 6px;">VS</span>
                    <span class="${v(p3)?'virt':''}">${p3}</span> <span style="color:#cbd5e1;">+</span> <span class="${v(p4)?'virt':''}">${p4}</span>
                </div>
            </div>`;
        }).join('');
        
        let pauseNames;
        if(r.isFinale) {
            pauseNames = 'Alle außer den 4 Finalteilnehmern';
        } else if(r.isBalance) {
            pauseNames = (r.pause || []).map(p => players[p]).filter(Boolean).join(', ') || 'Keiner';
        } else {
            pauseNames = (r.pause || []).map(p => players[p]).filter(Boolean).join(', ') || 'Keiner';
        }
        
        return `<div class="${cardCls} fade-up">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;">${roundLabel}</span>
                <div style="display:flex;align-items:center;gap:6px;">${badgeHtml}<span style="font-size:11px;color:var(--muted);font-weight:600;">${r.time}${mode==='points'?' (ca.)':''}</span></div>
            </div>
            ${matchHtml}
            <p style="font-size:9px;color:#f97316;font-weight:600;margin-top:8px;text-align:center;">Pause: ${pauseNames}</p>
            ${extra}
        </div>`;
    }).join('');
    updateStats(isDummyMode, isFinalMode, isReadonly);
}

// ============================================================
// UPDATE STATS
// ============================================================
function updateStats(isDummyMode, isFinalMode, isReadonly) {
    const scoredRounds = currentSchedule.filter(r => !r.isFinale);
    const { plays, partner, opponent } = calcPenalty(scoredRounds, players.length);
    const mTime = parseInt(document.getElementById('matchTime').value) || 15;
    
    document.getElementById('fairnessStats').innerHTML = players.map((name, i) => `
        <div class="stat-card">
            <p style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${name}">${name}</p>
            <p style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:var(--blue);line-height:1;">${plays[i]}<span style="font-size:11px;">×</span></p>
            <p style="font-size:10px;color:var(--muted);font-weight:500;">~${plays[i]*mTime} Min.</p>
        </div>`).join('');
    
    let mx = `<div style="overflow-x:auto;"><table style="border-collapse:collapse;font-size:9px;font-weight:700;width:100%;">
        <thead><tr><th style="padding:3px;min-width:50px;"></th>
        ${players.map(nm => `<th style="padding:3px;color:var(--muted);min-width:36px;font-weight:800;" title="${nm}">${nm.substring(0,5)}</th>`).join('')}
        </tr></thead><tbody>`;
    
    players.forEach((name, i) => {
        mx += `<tr><td style="padding:3px;font-weight:800;color:var(--slate);text-align:right;padding-right:8px;font-size:8px;" title="${name}">${name.substring(0,7)}</td>`;
        players.forEach((_, j) => {
            if(i === j) {
                mx += `<td class="matrix-cell" style="background:#f1f5f9;color:#cbd5e1;">—</td>`;
                return;
            }
            const p = partner[i][j];
            const o = opponent[i][j];
            let bg = 'background:#f8fafc;color:#cbd5e1;';
            if(p > 1) bg = 'background:#fef2f2;color:#dc2626;';
            else if(p > 0) bg = 'background:#f0fdf4;color:#16a34a;';
            else if(o > 0) bg = 'background:#eff6ff;color:#2563eb;';
            const lbl = p > 0 ? `P${p}${o>0?'/G'+o:''}` : o > 0 ? `G${o}` : '·';
            mx += `<td class="matrix-cell" style="${bg}" title="Mit ${players[j]}: ${p}× Partner, ${o}× Gegner">${lbl}</td>`;
        });
        mx += `</tr>`;
    });
    
    mx += `</tbody></table>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;font-size:9px;font-weight:700;color:var(--muted);">
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#f0fdf4;border:1px solid #bbf7d0;margin-right:3px;"></span>P = Partner</span>
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#eff6ff;border:1px solid #bfdbfe;margin-right:3px;"></span>G = Gegner</span>
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#fef2f2;border:1px solid #fecaca;margin-right:3px;"></span>Doppel-Partnerschaft ⚠️</span>
        <span>· = noch kein Kontakt</span>
    </div></div>`;
    
    document.getElementById('partnerStats').innerHTML = mx;
    
    const mode = document.querySelector('input[name="mode"]:checked')?.value;
    const isTeam = document.querySelector('input[name="tType"]:checked')?.value === 'team';
    const modeBox = document.getElementById('modeStatsBox');
    let info = [];
    if(mode === 'points') info.push('🎯 Punkte-Modus: Zeiten sind Schätzwerte.');
    if(isTeam) info.push('👥 Team-Modus: Nur Gegner-Optimierung aktiv.');
    modeBox.classList.toggle('hidden', !info.length);
    document.getElementById('modeStatsContent').innerHTML = info.join('<br>');
}

// ============================================================
// SAVE & DELETE
// ============================================================
async function saveFinal() {
    const name = document.getElementById('tName').value.trim();
    if(!name) { alert('Bitte Turniernamen eingeben.'); return; }
    if(!currentSchedule.length) { alert('Bitte zuerst einen Plan erstellen.'); return; }
    
    const inp = getInputs();
    const password = document.getElementById('tPassword').value.trim();
    const expiryDate = getExpiryDate();
    const courtNamesData = readCourtNames();
    
    const payload = {
        tournament_type: 'roundrobin',
        p: players,
        s_new: currentSchedule,
        courts: inp.courts,
        courtNames: courtNamesData,
        totalHours: inp.totalMin / 60,
        mode: inp.mode,
        isTeam: inp.isTeam,
        password: password || null,
        expiry_date: expiryDate,
        t: { start: inp.start, warmup: inp.warmup, match: inp.matchTime }
    };
    
    try {
        const { error } = await supabaseClient.from('tournaments').upsert({
            id: name,
            data: payload,
            tournament_type: 'roundrobin',
            expiry_date: expiryDate
        });
        if(error) throw error;
        document.getElementById('lastActionTime').textContent = `Gespeichert: ${new Date().toLocaleTimeString('de-DE')}`;
        alert(`✅ "${name}" gespeichert!`);
        init();
    } catch(e) {
        alert('Fehler beim Speichern: ' + e.message);
    }
}

async function deleteTournament() {
    const id = document.getElementById('tournamentSelect').value;
    if(id === 'new') return;
    if(!confirm(`Turnier "${id}" wirklich löschen?`)) return;
    try {
        await supabaseClient.from('tournaments').delete().eq('id', id);
        location.reload();
    } catch(e) {
        alert('Fehler: ' + e.message);
    }
}
