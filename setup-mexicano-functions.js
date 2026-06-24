// ============================================================
// SETUP-MEXICANO — KERNLOGIK
// Zugriff per Code, Turnier laden/speichern/löschen, Validierung.
// Der Spieler-Picker liegt in: setup-mexicano-picker.js
// ============================================================

const SB_URL = "https://vjcvchczbyvhweiwrunp.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqY3ZjaGN6Ynl2aHdlaXdydW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NjkzNjYsImV4cCI6MjA4NTM0NTM2Nn0.A01bxl9dNzgmeDcOV2HZIIa2pN5vhWg3q0_FhqO1R2M";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

// ------------------------------------------------------------
// STATE
// slotPlayerId[i]: mex_players.id falls via Picker zugewiesen, sonst null.
// Wird von setup-mexicano-picker.js mitbenutzt.
// ------------------------------------------------------------
let currentAdmin      = null;
let slotPlayerId      = [];
let isSaving          = false;
let currentTournamentId = null;  // null = neues Turnier, sonst UUID
let tournamentsList   = [];      // für das Dropdown

// ============================================================
// INIT / LOGIN
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
            .eq('code', code).eq('active', true).maybeSingle();
        if (error || !data) { showAccessDenied(); return; }

        currentAdmin = data;
        document.getElementById('adminNameLabel').textContent = currentAdmin.name;
        document.getElementById('app').classList.remove('hidden');

        await loadTournamentsList();
        resetForm();
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
// TURNIER-DROPDOWN
// ============================================================
async function loadTournamentsList() {
    // Eigene Turniere
    const { data: owned } = await supabaseClient
        .from('mex_tournaments')
        .select('id, name, date, status, owner_admin_id')
        .eq('owner_admin_id', currentAdmin.id)
        .order('created_at', { ascending: false });

    // Freigegebene Turniere
    const { data: granted } = await supabaseClient
        .from('mex_tournament_access')
        .select('tournament_id, mex_tournaments(id, name, date, status, owner_admin_id)')
        .eq('admin_id', currentAdmin.id);

    const grantedTournaments = (granted || [])
        .map(g => g.mex_tournaments)
        .filter(Boolean);

    // Zusammenführen, Duplikate vermeiden
    const seen = new Set();
    tournamentsList = [];
    for (const t of [...(owned || []), ...grantedTournaments]) {
        if (!seen.has(t.id)) { seen.add(t.id); tournamentsList.push(t); }
    }

    const sel = document.getElementById('tournamentSelect');
    while (sel.options.length > 1) sel.remove(1);
    tournamentsList.forEach(t => {
        const dateStr = t.date ? ` (${new Date(t.date).toLocaleDateString('de-DE')})` : '';
        const statusStr = t.status !== 'draft' ? ` [${t.status}]` : '';
        sel.add(new Option(`${t.name}${dateStr}${statusStr}`, t.id));
    });
}

async function onTournamentSelected(value) {
    if (value === 'new') {
        resetForm();
        return;
    }
    await loadExistingTournament(value);
}

async function loadExistingTournament(id) {
    // Turnier-Grunddaten
    const { data: t, error } = await supabaseClient
        .from('mex_tournaments')
        .select('id, name, date, status, data')
        .eq('id', id).single();
    if (error || !t) { alert('Fehler beim Laden des Turniers.'); return; }

    // Teilnehmer:innen
    const { data: participants } = await supabaseClient
        .from('mex_tournament_players')
        .select('player_id, start_level, mex_players(id, name)')
        .eq('tournament_id', id);

    currentTournamentId = id;
    const s = t.data?.settings || {};

    // Felder befüllen
    document.getElementById('mxName').value     = t.name || '';
    document.getElementById('mxDate').value     = t.date || '';
    document.getElementById('mxPassword').value = s.password || '';
    document.getElementById('mxCount').value    = s.playerCount || 12;
    document.getElementById('mxTotalHours').value = s.totalHours || 3;
    document.getElementById('mxWarmup').value   = s.warmupMin || 10;
    document.getElementById('mxMatchMin').value = s.matchMin || 20;
    document.getElementById('mxBreakMin').value = s.breakMin || 5;

    // Slots aus Teilnehmerliste aufbauen
    const count = s.playerCount || 12;
    slotPlayerId = new Array(count).fill(null);

    // Erst renderSlots() mit leerem State aufrufen, dann Felder befüllen
    renderSlots();
    (participants || []).forEach((p, i) => {
        if (i >= count) return;
        const player = p.mex_players;
        if (player) {
            const nameEl  = document.getElementById('mxName_'  + i);
            const levelEl = document.getElementById('mxLevel_' + i);
            if (nameEl)  nameEl.value  = player.name;
            if (levelEl) levelEl.value = p.start_level != null ? Number(p.start_level).toFixed(2) : '1.00';
            slotPlayerId[i] = player.id;
        }
    });
    renderSlots(); // nochmal für "aus Spielerliste"-Tags

    // Save-Button-Text und Löschen-Button anpassen
    document.getElementById('mxSaveBtn').textContent   = '💾 Änderungen speichern';
    document.getElementById('deleteBtn').classList.remove('hidden');
    updateDerived();
}

// ============================================================
// FORMULAR ZURÜCKSETZEN (Neues Turnier)
// ============================================================
function resetForm() {
    currentTournamentId = null;
    slotPlayerId = [];

    document.getElementById('mxName').value       = '';
    document.getElementById('mxDate').value       = '';
    document.getElementById('mxPassword').value   = '';
    document.getElementById('mxCount').value      = 12;
    document.getElementById('mxTotalHours').value = 3;
    document.getElementById('mxWarmup').value     = 10;
    document.getElementById('mxMatchMin').value   = 20;
    document.getElementById('mxBreakMin').value   = 5;

    document.getElementById('mxSaveBtn').textContent = '🎾 Mexicano-Turnier anlegen';
    document.getElementById('deleteBtn').classList.add('hidden');
    document.getElementById('mxSaveError').classList.add('hidden');
    document.getElementById('mxSaveSuccess').classList.add('hidden');

    renderSlots();
    updateDerived();
}

// ============================================================
// SPIELERANZAHL / SLOTS
// ============================================================
function getRawCount() {
    return parseInt(document.getElementById('mxCount').value) || 0;
}

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

    // Bestehende Werte sichern
    const existingNames  = [];
    const existingLevels = [];
    for (let i = 0; i < count; i++) {
        existingNames[i]  = document.getElementById('mxName_'  + i)?.value;
        existingLevels[i] = document.getElementById('mxLevel_' + i)?.value;
    }

    // slotPlayerId auf neue Länge bringen
    const newSlotPlayerId = [];
    for (let i = 0; i < count; i++) newSlotPlayerId[i] = slotPlayerId[i] ?? null;
    slotPlayerId = newSlotPlayerId;

    let html = '';
    for (let i = 0; i < count; i++) {
        const name  = existingNames[i]  || `Spieler ${i + 1}`;
        const level = existingLevels[i] || '1.00';
        const tag   = slotPlayerId[i]
            ? '<div class="slot-source-tag">aus Spielerliste</div>'
            : '';
        html += `
            <div>
                <div class="slot-grid">
                    <input type="text"   id="mxName_${i}"  value="${name.replace(/"/g, '&quot;')}" oninput="onSlotNameEdited(${i})">
                    <input type="number" id="mxLevel_${i}" value="${level}" step="0.1" min="1" max="5">
                </div>
                ${tag}
            </div>`;
    }
    container.innerHTML = html;
}

function onSlotNameEdited(i) {
    slotPlayerId[i] = null;
    const wrap = document.getElementById('mxName_' + i)?.parentElement?.parentElement;
    wrap?.querySelector('.slot-source-tag')?.remove();
}

// ============================================================
// ABGELEITETE WERTE / VALIDIERUNG
// ============================================================
function updateDerived() {
    const raw    = getRawCount();
    const errBox = document.getElementById('mxErrorBox');
    const errors = [];

    if (raw < 8 || raw % 4 !== 0) {
        errors.push('Spieleranzahl muss ein Vielfaches von 4 sein (mind. 8) — alle spielen immer gleichzeitig, 4 pro Court.');
    }

    const count      = getValidatedCount();
    const courts     = count / 4;
    document.getElementById('mxCourtsBadge').textContent = `→ ${courts} Court${courts > 1 ? 's' : ''}`;

    const totalHours = parseFloat(document.getElementById('mxTotalHours').value) || 0;
    const warmup     = parseInt(document.getElementById('mxWarmup').value)  || 0;
    const matchMin   = parseInt(document.getElementById('mxMatchMin').value) || 0;
    const breakMin   = parseInt(document.getElementById('mxBreakMin').value) || 0;
    const totalMin   = totalHours * 60;
    const perRound   = matchMin + breakMin;
    const netto      = totalMin - warmup;

    if (matchMin < 1)       errors.push('Match-Dauer muss mindestens 1 Minute sein.');
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
// SPEICHERN (neu anlegen ODER bestehend aktualisieren)
// ============================================================
async function saveMexicanoTournament() {
    if (isSaving) return;
    const saveErr = document.getElementById('mxSaveError');
    const saveOk  = document.getElementById('mxSaveSuccess');
    saveErr.classList.add('hidden');
    saveOk.classList.add('hidden');

    const name       = document.getElementById('mxName').value.trim();
    const date       = document.getElementById('mxDate').value || null;
    const password   = document.getElementById('mxPassword').value || null;
    const count      = getValidatedCount();
    const courts     = count / 4;
    const totalHours = parseFloat(document.getElementById('mxTotalHours').value) || 0;
    const warmup     = parseInt(document.getElementById('mxWarmup').value)  || 0;
    const matchMin   = parseInt(document.getElementById('mxMatchMin').value) || 0;
    const breakMin   = parseInt(document.getElementById('mxBreakMin').value) || 0;

    if (!name) {
        saveErr.textContent = 'Bitte einen Turniernamen eingeben.';
        saveErr.classList.remove('hidden');
        return;
    }

    // Teilnehmer:innen einsammeln — Platzhalter überspringen
    const slots = [];
    for (let i = 0; i < count; i++) {
        const nameVal  = document.getElementById('mxName_'  + i).value.trim();
        const levelVal = parseFloat(document.getElementById('mxLevel_' + i).value);
        if (!nameVal || nameVal === `Spieler ${i + 1}`) continue;
        slots.push({
            slotIndex: i,
            name:      nameVal,
            level:     isNaN(levelVal) ? 1.0 : levelVal,
            playerId:  slotPlayerId[i] || null
        });
    }

    if (!slots.length) {
        saveErr.textContent = 'Mindestens eine:n echte:n Teilnehmer:in eintragen (nicht nur Platzhalter).';
        saveErr.classList.remove('hidden');
        return;
    }

    isSaving = true;
    document.getElementById('mxSaveBtn').disabled    = true;
    document.getElementById('mxSaveBtn').textContent = 'Speichert…';

    try {
        // 1) Unbekannte Spieler:innen automatisch anlegen
        for (const slot of slots) {
            if (!slot.playerId) {
                const { data: np, error: pErr } = await supabaseClient
                    .from('mex_players').insert({ name: slot.name }).select().single();
                if (pErr) throw pErr;
                slot.playerId = np.id;
            }
        }

        const settings = {
            playerCount: count, courts,
            totalHours, warmupMin: warmup, matchMin, breakMin,
            maxPoints: 24, password
        };

        if (currentTournamentId) {
            // --- UPDATE ---
            const { data: existing } = await supabaseClient
                .from('mex_tournaments').select('data').eq('id', currentTournamentId).single();
            const mergedData = { ...(existing?.data || {}), settings, rounds: existing?.data?.rounds || [] };

            const { error: tErr } = await supabaseClient
                .from('mex_tournaments')
                .update({ name, date, data: mergedData })
                .eq('id', currentTournamentId);
            if (tErr) throw tErr;

            // Teilnahme-Zeilen ersetzen (alte löschen, neue einfügen)
            await supabaseClient.from('mex_tournament_players').delete().eq('tournament_id', currentTournamentId);
            const rows = slots.map(s => ({ tournament_id: currentTournamentId, player_id: s.playerId, start_level: s.level }));
            const { error: tpErr } = await supabaseClient.from('mex_tournament_players').insert(rows);
            if (tpErr) throw tpErr;

            saveOk.textContent = `✅ "${name}" aktualisiert (${slots.length} Teilnehmer:innen).`;

        } else {
            // --- NEU ANLEGEN ---
            const data = { settings, rounds: [] };
            const { data: tournament, error: tErr } = await supabaseClient
                .from('mex_tournaments')
                .insert({ name, date, type: 'mexicano', status: 'draft', owner_admin_id: currentAdmin.id, data })
                .select().single();
            if (tErr) throw tErr;

            const rows = slots.map(s => ({ tournament_id: tournament.id, player_id: s.playerId, start_level: s.level }));
            const { error: tpErr } = await supabaseClient.from('mex_tournament_players').insert(rows);
            if (tpErr) throw tpErr;

            currentTournamentId = tournament.id;

            // Dropdown aktualisieren und neues Turnier auswählen
            await loadTournamentsList();
            document.getElementById('tournamentSelect').value = tournament.id;
            document.getElementById('mxSaveBtn').textContent = '💾 Änderungen speichern';
            document.getElementById('deleteBtn').classList.remove('hidden');

            saveOk.textContent = `✅ "${name}" angelegt mit ${slots.length} von ${count} Plätzen besetzt.`;
        }

        saveOk.classList.remove('hidden');

    } catch (e) {
        saveErr.textContent = 'Fehler beim Speichern: ' + e.message;
        saveErr.classList.remove('hidden');
    } finally {
        isSaving = false;
        document.getElementById('mxSaveBtn').disabled    = false;
        if (!document.getElementById('mxSaveBtn').textContent.includes('anlegen')) {
            document.getElementById('mxSaveBtn').textContent = '💾 Änderungen speichern';
        }
    }
}

// ============================================================
// LÖSCHEN
// ============================================================
async function deleteTournament() {
    if (!currentTournamentId) return;
    const name = document.getElementById('mxName').value || 'dieses Turnier';
    if (!confirm(`"${name}" wirklich löschen? Das kann nicht rückgängig gemacht werden.`)) return;

    const { error } = await supabaseClient
        .from('mex_tournaments').delete().eq('id', currentTournamentId);
    if (error) { alert('Fehler beim Löschen: ' + error.message); return; }

    await loadTournamentsList();
    document.getElementById('tournamentSelect').value = 'new';
    resetForm();
}
