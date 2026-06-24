// ============================================================
// SETUP-MEXICANO — KERNLOGIK
// Zugriff per Code, Formular-Status, Validierung, Speichern.
// Der Spieler-Picker liegt in einer eigenen Datei: setup-mexicano-picker.js
// ============================================================

// ------------------------------------------------------------
// SUPABASE — selbes Projekt wie das bestehende Turniersystem
// und wie spieler.html. Neue Tabellen tragen das Präfix "mex_".
// ------------------------------------------------------------
const SB_URL = "https://vjcvchczbyvhweiwrunp.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqY3ZjaGN6Ynl2aHdlaXdydW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NjkzNjYsImV4cCI6MjA4NTM0NTM2Nn0.A01bxl9dNzgmeDcOV2HZIIa2pN5vhWg3q0_FhqO1R2M";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

// ------------------------------------------------------------
// STATE
// slotPlayerId[i] hält die mex_players.id, falls Platz i über den
// Picker zugewiesen wurde — sonst null (freie Eingabe / Platzhalter).
// Wird vom Picker (setup-mexicano-picker.js) mitbenutzt.
// ------------------------------------------------------------
let currentAdmin = null;
let slotPlayerId = [];
let isSaving = false;

// ============================================================
// INIT / LOGIN PER CODE (gleiches Muster wie spieler.html)
// ============================================================
async function init() {
    const urlCode = new URLSearchParams(window.location.search).get('code');
    if (urlCode) sessionStorage.setItem('ph_admin_code', urlCode);
    const code = sessionStorage.getItem('ph_admin_code');

    if (!code) { showAccessDenied(); return; }

    try {
        const { data, error } = await supabaseClient
            .from('mex_admins')
            .select('id, name, code, active')
            .eq('code', code)
            .eq('active', true)
            .maybeSingle();

        if (error || !data) { showAccessDenied(); return; }

        currentAdmin = data;
        document.getElementById('adminNameLabel').textContent = currentAdmin.name;
        document.getElementById('app').classList.remove('hidden');

        renderSlots();
        updateDerived();
    } catch (e) {
        console.error(e);
        showAccessDenied();
    }
}

function showAccessDenied() {
    document.getElementById('accessDenied').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
}

function logout() {
    sessionStorage.removeItem('ph_admin_code');
    window.location.href = window.location.pathname;
}

// ============================================================
// SPIELERANZAHL / SLOTS
// ============================================================

// Liest die Spieleranzahl, korrigiert sie aber NICHT automatisch —
// Validierung/Fehleranzeige passiert separat in updateDerived().
function getRawCount() {
    return parseInt(document.getElementById('mxCount').value) || 0;
}

// Gültige Anzahl für Slot-Rendering & Picker-Limit: Vielfaches von 4,
// mindestens 8. Bei ungültigem Wert wird der zuletzt gültige Wert
// beibehalten (Slots verschwinden nicht einfach beim Tippen).
let lastValidCount = 12;
function getValidatedCount() {
    const raw = getRawCount();
    if (raw >= 8 && raw % 4 === 0) { lastValidCount = raw; }
    return lastValidCount;
}

function onCountChanged() {
    renderSlots();
    updateDerived();
}

function renderSlots() {
    const count = getValidatedCount();
    const container = document.getElementById('playerSlots');

    // Bestehende Werte sichern, damit Tippen/Ändern der Anzahl nicht
    // bereits eingegebene Namen/Level verwirft.
    const existingNames = [];
    const existingLevels = [];
    for (let i = 0; i < count; i++) {
        existingNames[i] = document.getElementById('mxName_' + i)?.value;
        existingLevels[i] = document.getElementById('mxLevel_' + i)?.value;
    }
    // slotPlayerId-Array auf die neue Länge bringen
    const newSlotPlayerId = [];
    for (let i = 0; i < count; i++) newSlotPlayerId[i] = slotPlayerId[i] ?? null;
    slotPlayerId = newSlotPlayerId;

    let html = '';
    for (let i = 0; i < count; i++) {
        const name = existingNames[i] || `Spieler ${i + 1}`;
        const level = existingLevels[i] || '1.00';
        const sourceTag = slotPlayerId[i] ? '<div class="slot-source-tag">aus Spielerliste</div>' : '';
        html += `
            <div>
                <div class="slot-grid">
                    <input type="text" id="mxName_${i}" value="${name.replace(/"/g, '&quot;')}" oninput="onSlotNameEdited(${i})">
                    <input type="number" id="mxLevel_${i}" value="${level}" step="0.1" min="1" max="5">
                </div>
                ${sourceTag}
            </div>`;
    }
    container.innerHTML = html;
    setTimeout(updatePreview, 0);
}

// Wird aufgerufen, wenn ein Name von Hand verändert wird — die
// Picker-Zuordnung für diesen Platz ist dann nicht mehr verlässlich.
function onSlotNameEdited(i) {
    slotPlayerId[i] = null;
    const tag = document.getElementById('mxName_' + i)?.parentElement?.parentElement?.querySelector('.slot-source-tag');
    if (tag) tag.remove();
    setTimeout(updatePreview, 0);
}

// ============================================================
// ABGELEITETE WERTE / VALIDIERUNG (Courts, Runden)
// ============================================================
function updateDerived() {
    const raw = getRawCount();
    const errBox = document.getElementById('mxErrorBox');
    let errors = [];

    if (raw < 8 || raw % 4 !== 0) {
        errors.push('Spieleranzahl muss ein Vielfaches von 4 sein (mind. 8) — alle spielen immer gleichzeitig, 4 pro Court.');
    }

    const count = getValidatedCount();
    const courts = count / 4;
    document.getElementById('mxCourtsBadge').textContent = `→ ${courts} Court${courts > 1 ? 's' : ''}`;

    const totalHours = parseFloat(document.getElementById('mxTotalHours').value) || 0;
    const warmup = parseInt(document.getElementById('mxWarmup').value) || 0;
    const matchMin = parseInt(document.getElementById('mxMatchMin').value) || 0;
    const breakMin = parseInt(document.getElementById('mxBreakMin').value) || 0;
    const totalMin = totalHours * 60;
    const perRound = matchMin + breakMin;
    const netto = totalMin - warmup;

    if (matchMin < 1) errors.push('Match-Dauer muss mindestens 1 Minute sein.');
    if (warmup >= totalMin) errors.push('Aufwärmzeit darf nicht länger als die Gesamtdauer sein.');

    if (!errors.length && perRound > 0) {
        const rounds = Math.floor(netto / perRound);
        if (rounds < 1) {
            errors.push('Zu wenig Zeit für auch nur eine Runde — Parameter prüfen.');
        } else {
            const buffer = netto - rounds * perRound;
            document.getElementById('mxRoundsBadge').textContent = `≈ ${rounds} Runden (Puffer ${buffer} Min.)`;
        }
    }

    errBox.classList.toggle('hidden', !errors.length);
    errBox.innerHTML = errors.join('<br>');
    document.getElementById('mxSaveBtn').disabled = !!errors.length;

    renderCourtNameInputs(courts);
    setTimeout(updatePreview, 0);
}

function renderCourtNameInputs(courts) {
    const container = document.getElementById('mxCourtNames');
    if (!container) return;
    // Preserve existing values
    const existing = [];
    for (let i = 0; i < courts; i++) {
        existing[i] = document.getElementById(`mxCourtName_${i}`)?.value || String(i + 1);
    }
    let html = '<div class="param-grid">';
    for (let i = 0; i < courts; i++) {
        html += `<div>
            <label class="lbl">Court ${i + 1}</label>
            <input type="text" id="mxCourtName_${i}" value="${existing[i].replace(/"/g, '&quot;')}" placeholder="${i + 1}">
        </div>`;
    }
    html += '</div>';
    container.innerHTML = html;
}

// ============================================================
// VORSCHAU: RUNDE 1 (SHUFFLE) + ZEITPLAN + TEILNEHMER
// ============================================================

// Aktueller gemischter Slot-Order für Runde-1-Vorschau
let previewOrder = [];

// Wird bei jeder Änderung der Slots / Parameter aufgerufen
function updatePreview() {
    const count = getValidatedCount();
    const courts = count / 4;

    // Namen aus Slots lesen (Platzhalter bleiben als "Spieler N")
    const names = [];
    for (let i = 0; i < count; i++) {
        names.push(document.getElementById('mxName_' + i)?.value.trim() || `Spieler ${i + 1}`);
    }

    // previewOrder initialisieren falls leer oder falsche Länge
    if (previewOrder.length !== count) {
        previewOrder = Array.from({ length: count }, (_, i) => i);
        shuffleArray(previewOrder);
    }

    renderPreviewCourts(names, courts);
    renderPreviewSchedule();
    renderPreviewPlayers(names);
}

function shufflePreview() {
    const count = getValidatedCount();
    previewOrder = Array.from({ length: count }, (_, i) => i);
    shuffleArray(previewOrder);
    updatePreview();
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

function renderPreviewCourts(names, courts) {
    const container = document.getElementById('mxPreviewCourts');
    if (!container) return;

    const courtNames = [];
    for (let i = 0; i < courts; i++) {
        courtNames.push(document.getElementById(`mxCourtName_${i}`)?.value.trim() || String(i + 1));
    }

    let html = '';
    for (let ci = 0; ci < courts; ci++) {
        const block = previewOrder.slice(ci * 4, ci * 4 + 4);
        const teamA = [names[block[0]], names[block[3]]];
        const teamB = [names[block[1]], names[block[2]]];
        html += `<div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:12px; padding:10px 14px; margin-bottom:8px;">
            <div style="font-size:9px; font-weight:800; color:var(--muted); text-transform:uppercase; letter-spacing:.1em; margin-bottom:8px;">Court ${courtNames[ci]}</div>
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="flex:1;">
                    ${teamA.map(n => `<div style="font-size:13px; font-weight:700; color:var(--slate); text-transform:uppercase; line-height:1.35;">${escHtml(n)}</div>`).join('')}
                </div>
                <div style="font-size:11px; font-weight:700; color:var(--muted); flex-shrink:0;">vs</div>
                <div style="flex:1; text-align:right;">
                    ${teamB.map(n => `<div style="font-size:13px; font-weight:700; color:var(--slate); text-transform:uppercase; line-height:1.35;">${escHtml(n)}</div>`).join('')}
                </div>
            </div>
        </div>`;
    }
    container.innerHTML = html || '<div style="font-size:12px; color:var(--muted);">Spielernamen eingeben um Vorschau zu sehen.</div>';
}

function renderPreviewSchedule() {
    const container = document.getElementById('mxPreviewSchedule');
    if (!container) return;

    const startTime  = document.getElementById('mxStartTime')?.value || '14:00';
    const warmup     = parseInt(document.getElementById('mxWarmup')?.value) || 0;
    const matchMin   = parseInt(document.getElementById('mxMatchMin')?.value) || 20;
    const breakMin   = parseInt(document.getElementById('mxBreakMin')?.value) || 5;
    const totalHours = parseFloat(document.getElementById('mxTotalHours')?.value) || 3;
    const totalMin   = totalHours * 60;
    const perRound   = matchMin + breakMin;
    const netto      = totalMin - warmup;
    const rounds     = perRound > 0 ? Math.floor(netto / perRound) : 0;

    const [h, m] = startTime.split(':').map(Number);
    const startMinutes = h * 60 + m;

    function toHHMM(mins) {
        const hh = Math.floor(mins / 60);
        const mm = mins % 60;
        return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }

    if (rounds < 1) { container.innerHTML = '<div style="font-size:11px;color:var(--muted);">Zeitplan nicht berechenbar.</div>'; return; }

    // Aufwärmen
    let html = `<div style="display:flex; gap:8px; align-items:center; margin-bottom:6px; padding:6px 10px; background:#eff6ff; border-radius:8px;">
        <span style="font-size:10px; font-weight:800; color:var(--blue); min-width:80px; font-family:'Barlow Condensed',sans-serif;">${toHHMM(startMinutes)}</span>
        <span style="font-size:11px; font-weight:600; color:var(--muted);">🔥 Aufwärmen (${warmup} Min.)</span>
    </div>`;

    let cursor = startMinutes + warmup;
    for (let r = 1; r <= rounds; r++) {
        const endMatch = cursor + matchMin;
        html += `<div style="display:flex; gap:8px; align-items:center; margin-bottom:4px; padding:6px 10px; background:#f8fafc; border-radius:8px;">
            <span style="font-size:10px; font-weight:800; color:var(--slate); min-width:80px; font-family:'Barlow Condensed',sans-serif;">${toHHMM(cursor)}</span>
            <span style="font-size:11px; font-weight:700; color:var(--slate);">Runde ${r}</span>
            <span style="font-size:10px; color:var(--muted); margin-left:auto;">${toHHMM(cursor)}–${toHHMM(endMatch)}</span>
        </div>`;
        cursor = endMatch + breakMin;
    }

    const buffer = netto - rounds * perRound;
    if (buffer > 0) {
        html += `<div style="font-size:10px; color:var(--muted); padding:4px 10px;">Puffer: ${buffer} Min. · Ende ca. ${toHHMM(cursor - breakMin)}</div>`;
    }

    container.innerHTML = html;
}

function renderPreviewPlayers(names) {
    const container = document.getElementById('mxPreviewPlayers');
    if (!container) return;
    const count = getValidatedCount();
    let html = '<div style="display:flex; flex-wrap:wrap; gap:6px;">';
    for (let i = 0; i < count; i++) {
        const n = names[i];
        const lvl = parseFloat(document.getElementById('mxLevel_' + i)?.value) || 1.0;
        const isReal = n !== `Spieler ${i + 1}`;
        html += `<div style="background:${isReal ? '#eff6ff' : '#f8fafc'}; border:1.5px solid ${isReal ? '#bfdbfe' : '#e2e8f0'}; border-radius:8px; padding:5px 10px; display:flex; align-items:center; gap:6px;">
            <span style="font-size:12px; font-weight:700; color:${isReal ? 'var(--blue)' : 'var(--muted)'}; text-transform:uppercase;">${escHtml(n)}</span>
            <span style="font-size:10px; color:var(--muted);">Lvl ${lvl.toFixed(1)}</span>
        </div>`;
    }
    html += '</div>';
    container.innerHTML = html;
}

function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// LIVE-LINK NACH SPEICHERN
// ============================================================
function showLiveLink(tournamentId) {
    const base = window.location.origin + window.location.pathname.replace('setup-mexicano.html', '');
    const url  = `${base}live-mexicano.html?id=${tournamentId}`;
    document.getElementById('mxLiveLink').textContent = url;
    document.getElementById('mxLiveLink').href = url;
    document.getElementById('mxLiveLinkBtn').href = url;
    document.getElementById('mxLiveLinkBox').classList.remove('hidden');
    // Scroll zum Link
    document.getElementById('mxLiveLinkBox').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function copyLiveLink() {
    const url = document.getElementById('mxLiveLink').textContent;
    navigator.clipboard.writeText(url).then(() => {
        const btn = event.target;
        const orig = btn.textContent;
        btn.textContent = '✓ Kopiert!';
        setTimeout(() => { btn.textContent = orig; }, 2000);
    });
}

async function saveMexicanoTournament() {
    if (isSaving) return;
    const saveErr = document.getElementById('mxSaveError');
    const saveOk = document.getElementById('mxSaveSuccess');
    saveErr.classList.add('hidden');
    saveOk.classList.add('hidden');

    const name = document.getElementById('mxName').value.trim();
    const date = document.getElementById('mxDate').value || null;
    const password = document.getElementById('mxPassword').value || null;
    const count = getValidatedCount();
    const courts = count / 4;
    const totalHours = parseFloat(document.getElementById('mxTotalHours').value) || 0;
    const warmup = parseInt(document.getElementById('mxWarmup').value) || 0;
    const matchMin = parseInt(document.getElementById('mxMatchMin').value) || 0;
    const breakMin = parseInt(document.getElementById('mxBreakMin').value) || 0;
    const startTime = document.getElementById('mxStartTime').value || '14:00';

    // Court-Namen einlesen
    const courtNames = [];
    for (let i = 0; i < courts; i++) {
        courtNames.push(document.getElementById(`mxCourtName_${i}`)?.value.trim() || String(i + 1));
    }

    if (!name) {
        saveErr.textContent = 'Bitte einen Turniernamen eingeben.';
        saveErr.classList.remove('hidden');
        return;
    }

    // Teilnehmer:innen einsammeln — Plätze, die noch auf dem
    // unveränderten Platzhalter stehen, werden übersprungen.
    const slots = [];
    for (let i = 0; i < count; i++) {
        const nameInput = document.getElementById('mxName_' + i).value.trim();
        const levelInput = parseFloat(document.getElementById('mxLevel_' + i).value);
        const isPlaceholder = nameInput === `Spieler ${i + 1}`;
        if (isPlaceholder || !nameInput) continue;
        slots.push({
            slotIndex: i,
            name: nameInput,
            level: isNaN(levelInput) ? 1.0 : levelInput,
            playerId: slotPlayerId[i] || null
        });
    }

    if (!slots.length) {
        saveErr.textContent = 'Mindestens eine echte Teilnehmerin/ein echter Teilnehmer nötig (nicht nur Platzhalter).';
        saveErr.classList.remove('hidden');
        return;
    }

    isSaving = true;
    document.getElementById('mxSaveBtn').disabled = true;
    document.getElementById('mxSaveBtn').textContent = 'Speichert…';

    try {
        // 1) Freie Namen ohne Picker-Zuordnung als neue mex_players anlegen
        for (const slot of slots) {
            if (!slot.playerId) {
                const { data: newPlayer, error: pErr } = await supabaseClient
                    .from('mex_players').insert({ name: slot.name }).select().single();
                if (pErr) throw pErr;
                slot.playerId = newPlayer.id;
            }
        }

        // 2) Turnier anlegen
        const data = {
            settings: {
                playerCount: count,
                courts,
                totalHours,
                warmupMin: warmup,
                matchMin,
                breakMin,
                maxPoints: 24,
                startTime,
                courtNames,
                password
            },
            rounds: [] // wird später von der Live-Seite befüllt
        };

        const { data: tournament, error: tErr } = await supabaseClient
            .from('mex_tournaments')
            .insert({ name, date, type: 'mexicano', status: 'draft', owner_admin_id: currentAdmin.id, data })
            .select().single();
        if (tErr) throw tErr;

        // 3) Teilnahme-Zeilen anlegen
        const rows = slots.map(s => ({
            tournament_id: tournament.id,
            player_id: s.playerId,
            start_level: s.level
        }));
        const { error: tpErr } = await supabaseClient.from('mex_tournament_players').insert(rows);
        if (tpErr) throw tpErr;

        saveOk.textContent = `✅ "${name}" angelegt mit ${slots.length} von ${count} Plätzen besetzt.`;
        saveOk.classList.remove('hidden');
        showLiveLink(tournament.id);
    } catch (e) {
        saveErr.textContent = 'Fehler beim Speichern: ' + e.message;
        saveErr.classList.remove('hidden');
    } finally {
        isSaving = false;
        document.getElementById('mxSaveBtn').disabled = false;
        document.getElementById('mxSaveBtn').textContent = '🎾 Mexicano-Turnier anlegen';
    }
}
