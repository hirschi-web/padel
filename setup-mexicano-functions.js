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
        // Login läuft über eine RPC-Funktion statt eines direkten SELECTs
        // auf mex_admins, damit die Codes-Spalte nie öffentlich lesbar ist.
        const { data, error } = await supabaseClient
            .rpc('check_admin_code', { input_code: code });

        const admin = (data && data.length) ? data[0] : null;
        if (error || !admin) { showAccessDenied(); return; }

        currentAdmin = admin;
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
}

// Wird aufgerufen, wenn ein Name von Hand verändert wird — die
// Picker-Zuordnung für diesen Platz ist dann nicht mehr verlässlich.
function onSlotNameEdited(i) {
    slotPlayerId[i] = null;
    const tag = document.getElementById('mxName_' + i)?.parentElement?.parentElement?.querySelector('.slot-source-tag');
    if (tag) tag.remove();
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
}

// ============================================================
// SPEICHERN
// ============================================================
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
    } catch (e) {
        saveErr.textContent = 'Fehler beim Speichern: ' + e.message;
        saveErr.classList.remove('hidden');
    } finally {
        isSaving = false;
        document.getElementById('mxSaveBtn').disabled = false;
        document.getElementById('mxSaveBtn').textContent = '🎾 Mexicano-Turnier anlegen';
    }
}
