// ============================================================
// PADEL — SPIELERVERWALTUNG
// ============================================================

const SB_URL = "https://vjcvchczbyvhweiwrunp.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqY3ZjaGN6Ynl2aHdlaXdydW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NjkzNjYsImV4cCI6MjA4NTM0NTM2Nn0.A01bxl9dNzgmeDcOV2HZIIa2pN5vhWg3q0_FhqO1R2M";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

// ============================================================
// STATE
// ============================================================
let currentAdmin   = null;
let allPlayers     = [];
let latestLevelByPlayer = {};
let prevLevelByPlayer   = {};   // vorletzter Eintrag → Trend
let activeAdmins   = [];
let currentDetailPlayerId = null;
let prepSelected   = {};        // playerId → start_level (string)
let prepPickerTemp = {};        // temporäre Auswahl im Overlay (playerId → true)

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
            .from('mex_admins').select('id, name, code, active')
            .eq('code', code).eq('active', true).maybeSingle();
        if (error || !data) { showAccessDenied(); return; }

        currentAdmin = data;
        document.getElementById('adminNameLabel').textContent = currentAdmin.name;
        document.getElementById('app').classList.remove('hidden');

        await loadPlayers();
        await loadActiveAdmins();
        renderPlayerList();
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
// TAB NAVIGATION
// ============================================================
function showTab(tab) {
    ['players', 'prepare', 'mine'].forEach(t => {
        document.getElementById('tab_' + t).classList.toggle('hidden', t !== tab);
        document.getElementById('tabBtn_' + t).classList.toggle('active', t === tab);
    });
    if (tab === 'mine') loadMyTournaments();
}

// ============================================================
// ACCESSIBLE TOURNAMENTS
// ============================================================
async function getAccessibleTournamentIds() {
    const [{ data: owned }, { data: granted }] = await Promise.all([
        supabaseClient.from('mex_tournaments').select('id').eq('owner_admin_id', currentAdmin.id),
        supabaseClient.from('mex_tournament_access').select('tournament_id').eq('admin_id', currentAdmin.id)
    ]);
    const ids = new Set();
    (owned  || []).forEach(t => ids.add(t.id));
    (granted|| []).forEach(g => ids.add(g.tournament_id));
    return Array.from(ids);
}

// ============================================================
// LOAD PLAYERS + LEVELS
// ============================================================
async function loadPlayers() {
    const { data: playerRows } = await supabaseClient
        .from('mex_players').select('id, name, active').order('name');
    allPlayers = playerRows || [];

    // Alle Level-Einträge laden (neueste 2 pro Spieler für Trend)
    const { data: histRows } = await supabaseClient
        .from('mex_player_level_history')
        .select('player_id, level, changed_at')
        .order('changed_at', { ascending: false });

    latestLevelByPlayer = {};
    prevLevelByPlayer   = {};
    const seen = {};
    (histRows || []).forEach(r => {
        if (!seen[r.player_id]) {
            latestLevelByPlayer[r.player_id] = r.level;
            seen[r.player_id] = 1;
        } else if (seen[r.player_id] === 1) {
            prevLevelByPlayer[r.player_id] = r.level;
            seen[r.player_id] = 2;
        }
    });
}

async function loadActiveAdmins() {
    const { data } = await supabaseClient.from('mex_admins').select('id, name').eq('active', true);
    activeAdmins = (data || []).filter(a => a.id !== currentAdmin.id);
}

// ============================================================
// HELPERS
// ============================================================
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c =>
        ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function levelBadgeClass(level) {
    if (level == null) return 'badge-slate';
    if (level >= 3.2)  return 'badge-purple';
    if (level >= 2.5)  return 'badge-amber';
    if (level >= 2.0)  return 'badge-blue';
    return 'badge-slate';
}

function trendHtml(playerId) {
    const cur  = latestLevelByPlayer[playerId];
    const prev = prevLevelByPlayer[playerId];
    if (cur == null || prev == null) return '<span class="trend trend-flat">–</span>';
    const diff = cur - prev;
    if (Math.abs(diff) < 0.005) return '<span class="trend trend-flat">→</span>';
    if (diff > 0) return `<span class="trend trend-up">↑ +${diff.toFixed(2)}</span>`;
    return `<span class="trend trend-down">↓ ${diff.toFixed(2)}</span>`;
}

// ============================================================
// PLAYER TABLE
// ============================================================
function renderPlayerList() {
    const search     = document.getElementById('playerSearch').value.trim().toLowerCase();
    const showArch   = document.getElementById('showArchived').checked;
    const container  = document.getElementById('playerTableContainer');

    const list = allPlayers
        .filter(p => showArch || p.active)
        .filter(p => p.name.toLowerCase().includes(search));

    if (!list.length) {
        container.innerHTML = '<p style="text-align:center; color:var(--muted); font-size:12px; padding:24px;">Keine Spieler:innen gefunden.</p>';
        return;
    }

    container.innerHTML = `
        <table class="player-table">
            <thead>
                <tr>
                    <th style="padding-left:20px;">Name</th>
                    <th>Level</th>
                    <th>Trend</th>
                    <th style="text-align:right; padding-right:16px;">Aktion</th>
                </tr>
            </thead>
            <tbody>
                ${list.map(p => {
                    const lvl = latestLevelByPlayer[p.id];
                    return `
                    <tr class="${p.active ? '' : 'archived'}" id="playerRow_${p.id}">
                        <td style="padding-left:20px; min-width:140px;">
                            <input class="inline-name-input"
                                   value="${escapeHtml(p.name)}"
                                   title="Klicken zum Bearbeiten"
                                   onblur="saveInlineName('${p.id}', this)"
                                   onkeydown="if(event.key==='Enter'){this.blur();}if(event.key==='Escape'){this.value='${escapeHtml(p.name)}';this.blur();}">
                            ${p.active ? '' : '<div style="font-size:9px; color:var(--muted); font-weight:700; text-transform:uppercase; letter-spacing:.06em; margin-top:2px;">Archiviert</div>'}
                        </td>
                        <td>
                            <span class="badge ${levelBadgeClass(lvl)}">${lvl != null ? Number(lvl).toFixed(2) : '–'}</span>
                        </td>
                        <td>${trendHtml(p.id)}</td>
                        <td style="text-align:right; padding-right:16px; white-space:nowrap;">
                            <button onclick="openPlayerDetail('${p.id}')" class="btn btn-sm btn-secondary" style="margin-right:4px;">Details</button>
                            <button onclick="quickToggleArchive('${p.id}', ${p.active})" class="btn btn-sm ${p.active ? 'btn-danger' : ''}" style="${p.active ? '' : 'background:#f0fdf4; color:var(--green); border:1.5px solid #bbf7d0;'}">${p.active ? 'Archivieren' : 'Reaktivieren'}</button>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>`;
}

// Inline-Name direkt in der Tabelle speichern
async function saveInlineName(playerId, input) {
    const newName = input.value.trim();
    const player  = allPlayers.find(p => p.id === playerId);
    if (!player || newName === player.name) return;
    if (!newName) { input.value = player.name; return; }

    const { error } = await supabaseClient.from('mex_players').update({ name: newName }).eq('id', playerId);
    if (error) { alert('Fehler beim Speichern: ' + error.message); input.value = player.name; return; }
    player.name = newName;
}

// Archivieren/Reaktivieren direkt aus der Tabelle
async function quickToggleArchive(playerId, currentlyActive) {
    const action = currentlyActive ? 'archivieren' : 'reaktivieren';
    if (!confirm(`Spieler:in wirklich ${action}?`)) return;
    const { error } = await supabaseClient.from('mex_players')
        .update({ active: !currentlyActive }).eq('id', playerId);
    if (error) { alert('Fehler: ' + error.message); return; }
    await loadPlayers();
    renderPlayerList();
}

// ============================================================
// ADD PLAYER FORM
// ============================================================
function toggleAddPlayerForm() {
    const form = document.getElementById('addPlayerForm');
    const isHidden = form.classList.contains('hidden');
    form.classList.toggle('hidden');
    if (isHidden) {
        document.getElementById('newPlayerName').value = '';
        document.getElementById('newPlayerLevel').value = '1.00';
        resetDuplicateWarning();
        setTimeout(() => document.getElementById('newPlayerName').focus(), 50);
    }
}

function resetDuplicateWarning() {
    document.getElementById('duplicateWarning').classList.add('hidden');
    document.getElementById('addPlayerActions').style.display = 'flex';
}

async function addPlayer(force = false) {
    const name  = document.getElementById('newPlayerName').value.trim();
    const level = parseFloat(document.getElementById('newPlayerLevel').value) || 1.00;
    if (!name) { alert('Bitte einen Namen eingeben.'); return; }

    if (!force) {
        const dupes = allPlayers.filter(p => p.name.toLowerCase() === name.toLowerCase());
        if (dupes.length) {
            const existing = dupes.map(p => `„${p.name}"${p.active ? '' : ' (archiviert)'}`).join(', ');
            document.getElementById('duplicateWarningText').textContent =
                `Bereits vorhanden: ${existing}. Wirklich nochmal anlegen?`;
            document.getElementById('duplicateWarning').classList.remove('hidden');
            document.getElementById('addPlayerActions').style.display = 'none';
            return;
        }
    }

    // 1) Spieler anlegen
    const { data: newPlayer, error } = await supabaseClient
        .from('mex_players').insert({ name }).select().single();
    if (error) {
        if (error.code === '23505') alert(`„${name}" existiert bereits in der Datenbank.`);
        else alert('Fehler: ' + error.message);
        return;
    }

    // 2) Start-Level in Historie schreiben
    await supabaseClient.from('mex_player_level_history').insert({
        player_id:  newPlayer.id,
        level:      level,
        note:       'Startwert bei Anlage',
        changed_by: currentAdmin.id
    });

    toggleAddPlayerForm();
    await loadPlayers();
    renderPlayerList();
}

// ============================================================
// PLAYER DETAIL VIEW
// ============================================================
async function openPlayerDetail(playerId) {
    currentDetailPlayerId = playerId;
    const player = allPlayers.find(p => p.id === playerId);
    if (!player) return;

    document.getElementById('playerListView').classList.add('hidden');
    document.getElementById('playerDetailView').classList.remove('hidden');
    document.getElementById('detailName').value = player.name;

    const btn = document.getElementById('detailArchiveBtn');
    btn.textContent = player.active ? 'Archivieren' : 'Reaktivieren';

    const curLvl = latestLevelByPlayer[playerId];
    document.getElementById('manualLevel').value = curLvl != null ? Number(curLvl).toFixed(2) : '';
    document.getElementById('manualLevelNote').value = '';
    document.getElementById('manualLevelMsg').classList.add('hidden');

    await loadLevelHistory(playerId);
    await loadTournamentHistory(playerId);
}

async function loadLevelHistory(playerId) {
    const container = document.getElementById('levelHistoryList');
    container.innerHTML = '<p style="font-size:12px; color:var(--muted);">Lädt…</p>';

    const { data, error } = await supabaseClient
        .from('mex_player_level_history')
        .select('level, note, changed_at, changed_by, mex_admins(name)')
        .eq('player_id', playerId)
        .order('changed_at', { ascending: false })
        .limit(20);

    if (error || !data?.length) {
        container.innerHTML = '<p style="font-size:12px; color:var(--muted);">Kein Level-Verlauf vorhanden.</p>';
        return;
    }

    container.innerHTML = data.map((r, i) => `
        <div class="level-hist-row">
            <div>
                <span class="badge ${levelBadgeClass(r.level)}" style="margin-right:6px;">${Number(r.level).toFixed(2)}</span>
                <span style="font-size:11px; color:var(--muted);">${r.note || '–'}</span>
                ${i === 0 ? '<span class="badge badge-green" style="margin-left:6px;">aktuell</span>' : ''}
            </div>
            <div style="font-size:10px; color:var(--muted); text-align:right;">
                ${new Date(r.changed_at).toLocaleDateString('de-DE')}<br>
                <span style="font-size:9px;">${r.mex_admins?.name || ''}</span>
            </div>
        </div>`).join('');
}

async function loadTournamentHistory(playerId) {
    const container = document.getElementById('playerHistoryTable');
    container.innerHTML = '<p style="font-size:12px; color:var(--muted); text-align:center; padding:14px;">Lädt…</p>';
    const accessibleIds = await getAccessibleTournamentIds();

    const { data, error } = await supabaseClient
        .from('mex_tournament_players')
        .select('start_level, final_points, final_level, placement, mex_tournaments(id, name, date, type)')
        .eq('player_id', playerId);

    if (error) { container.innerHTML = '<p style="font-size:12px; color:var(--red);">Fehler beim Laden.</p>'; return; }

    const rows = (data || [])
        .filter(r => r.mex_tournaments && accessibleIds.includes(r.mex_tournaments.id))
        .sort((a, b) => new Date(b.mex_tournaments.date || 0) - new Date(a.mex_tournaments.date || 0));

    if (!rows.length) {
        container.innerHTML = '<p style="font-size:12px; color:var(--muted); text-align:center; padding:14px;">Noch keine Turniere sichtbar.</p>';
        return;
    }

    container.innerHTML = `
        <table class="hist">
            <thead><tr><th>Datum</th><th>Turnier</th><th>Platz</th><th>Punkte</th><th>Level</th></tr></thead>
            <tbody>
                ${rows.map(r => `
                    <tr>
                        <td>${r.mex_tournaments.date ? new Date(r.mex_tournaments.date).toLocaleDateString('de-DE') : '–'}</td>
                        <td>${escapeHtml(r.mex_tournaments.name)}</td>
                        <td>${r.placement ?? '–'}</td>
                        <td>${r.final_points ?? '–'}</td>
                        <td>${r.final_level != null ? Number(r.final_level).toFixed(2) : '–'}</td>
                    </tr>`).join('')}
            </tbody>
        </table>`;
}

function closePlayerDetail() {
    currentDetailPlayerId = null;
    document.getElementById('playerDetailView').classList.add('hidden');
    document.getElementById('playerListView').classList.remove('hidden');
}

async function savePlayerName() {
    const name = document.getElementById('detailName').value.trim();
    if (!name) { alert('Bitte einen Namen eingeben.'); return; }
    const { error } = await supabaseClient.from('mex_players').update({ name }).eq('id', currentDetailPlayerId);
    if (error) { alert('Fehler: ' + error.message); return; }
    await loadPlayers();
    renderPlayerList();
    const player = allPlayers.find(p => p.id === currentDetailPlayerId);
    if (player) player.name = name;
    showMsg('manualLevelMsg', '✅ Name gespeichert.', 'alert-success');
}

async function togglePlayerArchive() {
    const player = allPlayers.find(p => p.id === currentDetailPlayerId);
    if (!player) return;
    const action = player.active ? 'archivieren' : 'reaktivieren';
    if (!confirm(`Spieler:in wirklich ${action}?`)) return;
    const { error } = await supabaseClient.from('mex_players')
        .update({ active: !player.active }).eq('id', player.id);
    if (error) { alert('Fehler: ' + error.message); return; }
    player.active = !player.active;
    document.getElementById('detailArchiveBtn').textContent = player.active ? 'Archivieren' : 'Reaktivieren';
    renderPlayerList();
}

async function saveManualLevel() {
    const levelRaw = document.getElementById('manualLevel').value;
    const note     = document.getElementById('manualLevelNote').value.trim() || 'Manuelle Anpassung';
    const level    = parseFloat(levelRaw);
    if (!levelRaw || isNaN(level) || level < 0.5 || level > 5) {
        showMsg('manualLevelMsg', 'Bitte ein gültiges Level (0.5–5.0) eingeben.', 'alert-error');
        return;
    }

    const { error } = await supabaseClient.from('mex_player_level_history').insert({
        player_id:  currentDetailPlayerId,
        level,
        note,
        changed_by: currentAdmin.id
    });
    if (error) { showMsg('manualLevelMsg', 'Fehler: ' + error.message, 'alert-error'); return; }

    showMsg('manualLevelMsg', `✅ Level ${level.toFixed(2)} gespeichert.`, 'alert-success');
    document.getElementById('manualLevelNote').value = '';

    await loadPlayers();
    renderPlayerList();
    await loadLevelHistory(currentDetailPlayerId);
}

function showMsg(elemId, text, cls) {
    const el = document.getElementById(elemId);
    el.className = 'alert ' + cls;
    el.textContent = text;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3500);
}

// ============================================================
// TAB: TURNIER VORBEREITEN — Picker Overlay
// ============================================================
function openPrepPicker() {
    // Temp-Zustand aus aktuellem prepSelected initialisieren
    prepPickerTemp = {};
    Object.keys(prepSelected).forEach(id => { prepPickerTemp[id] = true; });

    document.getElementById('prepPickerSearch').value = '';
    document.getElementById('prepPickerOverlay').classList.remove('hidden');
    renderPrepPickerOverlay();
}

function closePrepPicker() {
    document.getElementById('prepPickerOverlay').classList.add('hidden');
}

function renderPrepPickerOverlay() {
    const search    = document.getElementById('prepPickerSearch').value.trim().toLowerCase();
    const container = document.getElementById('prepPickerList');
    const list      = allPlayers.filter(p => p.active && p.name.toLowerCase().includes(search));

    document.getElementById('prepPickerCount').textContent =
        Object.keys(prepPickerTemp).length + ' ausgewählt';

    if (!list.length) {
        container.innerHTML = '<p style="font-size:12px; color:var(--muted); text-align:center; padding:14px;">Keine Spieler:innen gefunden.</p>';
        return;
    }

    container.innerHTML = list.map(p => {
        const checked = !!prepPickerTemp[p.id];
        const lvl     = latestLevelByPlayer[p.id];
        const lvlStr  = lvl != null ? Number(lvl).toFixed(2) : '1.00';
        return `
            <div class="picker-item ${checked ? 'selected' : ''}" onclick="togglePrepPickerTemp('${p.id}')">
                <div class="picker-row-left">
                    <input type="checkbox" ${checked ? 'checked' : ''} onclick="event.stopPropagation(); togglePrepPickerTemp('${p.id}')">
                    <span style="font-size:13px; font-weight:600;">${escapeHtml(p.name)}</span>
                </div>
                <div class="picker-row-right">
                    ${trendHtml(p.id)}
                    <span class="badge ${levelBadgeClass(lvl)}">${lvlStr}</span>
                </div>
            </div>`;
    }).join('');
}

function togglePrepPickerTemp(playerId) {
    if (prepPickerTemp[playerId]) delete prepPickerTemp[playerId];
    else prepPickerTemp[playerId] = true;
    renderPrepPickerOverlay();
}

function applyPrepPickerSelection() {
    // Neue Auswahl übernehmen; Level aus bekanntem Level vorbelegen
    const newSelected = {};
    Object.keys(prepPickerTemp).forEach(id => {
        const lvl = latestLevelByPlayer[id];
        // Wenn schon vorhanden (editiertes Level behalten), sonst neues vorschlagen
        newSelected[id] = prepSelected[id] ?? (lvl != null ? Number(lvl).toFixed(2) : '1.00');
    });
    prepSelected = newSelected;
    closePrepPicker();
    renderPrepChips();
}

function renderPrepChips() {
    const container = document.getElementById('prepChips');
    const ids = Object.keys(prepSelected);
    document.getElementById('prepSelectedCount').textContent = ids.length + ' ausgewählt';

    if (!ids.length) {
        container.innerHTML = '<p style="font-size:12px; color:var(--muted); text-align:center; padding:12px 0;">Noch niemand ausgewählt — klick auf „Auswählen"</p>';
        return;
    }

    container.innerHTML = ids.map(id => {
        const player = allPlayers.find(p => p.id === id);
        if (!player) return '';
        const lvl    = latestLevelByPlayer[id];
        return `
            <div class="prep-selected-chip">
                <div class="prep-chip-name">${escapeHtml(player.name)}</div>
                <div class="prep-chip-level">
                    <span style="font-size:11px; color:var(--muted);">Level</span>
                    <input type="number" min="0.5" max="5" step="0.1"
                           value="${prepSelected[id]}"
                           onchange="prepSelected['${id}'] = this.value"
                           style="width:64px; padding:5px 8px; font-size:12px;">
                    <span class="badge ${levelBadgeClass(lvl)}" style="font-size:9px;">${lvl != null ? Number(lvl).toFixed(2) : '–'}</span>
                    <button class="prep-chip-remove" onclick="removePrepChip('${id}')" title="Entfernen">×</button>
                </div>
            </div>`;
    }).join('');
}

function removePrepChip(playerId) {
    delete prepSelected[playerId];
    renderPrepChips();
}

async function saveDraftTournament() {
    const name     = document.getElementById('prepName').value.trim();
    const date     = document.getElementById('prepDate').value || null;
    const type     = document.getElementById('prepType').value;
    const errorBox = document.getElementById('prepError');
    errorBox.classList.add('hidden');

    const selectedIds = Object.keys(prepSelected);
    if (!name)            { errorBox.textContent = 'Bitte einen Turniernamen eingeben.'; errorBox.classList.remove('hidden'); return; }
    if (!selectedIds.length) { errorBox.textContent = 'Bitte mindestens eine:n Teilnehmer:in auswählen.';  errorBox.classList.remove('hidden'); return; }

    try {
        const { data: tournament, error: tErr } = await supabaseClient
            .from('mex_tournaments')
            .insert({ name, date, type, status: 'draft', owner_admin_id: currentAdmin.id })
            .select().single();
        if (tErr) throw tErr;

        const rows = selectedIds.map(pid => ({
            tournament_id: tournament.id,
            player_id:     pid,
            start_level:   parseFloat(prepSelected[pid])
        }));
        const { error: tpErr } = await supabaseClient.from('mex_tournament_players').insert(rows);
        if (tpErr) throw tpErr;

        alert(`✅ "${name}" als Entwurf angelegt (${selectedIds.length} Teilnehmer:innen).`);
        prepSelected = {};
        document.getElementById('prepName').value  = '';
        document.getElementById('prepDate').value  = '';
        renderPrepChips();
        showTab('mine');
    } catch (e) {
        errorBox.textContent = 'Fehler beim Speichern: ' + e.message;
        errorBox.classList.remove('hidden');
    }
}

// ============================================================
// TAB: MEINE TURNIERE
// ============================================================
async function loadMyTournaments() {
    const container = document.getElementById('myTournamentsList');
    container.innerHTML = '<p style="font-size:12px; color:var(--muted); text-align:center; padding:14px;">Lädt…</p>';

    const ids = await getAccessibleTournamentIds();
    if (!ids.length) {
        container.innerHTML = '<p style="font-size:12px; color:var(--muted); text-align:center; padding:14px;">Noch keine Turniere.</p>';
        return;
    }

    const { data: tournamentRows, error } = await supabaseClient
        .from('mex_tournaments').select('id, name, date, type, status, owner_admin_id')
        .in('id', ids).order('created_at', { ascending: false });
    if (error) { container.innerHTML = '<p style="font-size:12px; color:var(--red);">Fehler beim Laden.</p>'; return; }

    const { data: accessRows } = await supabaseClient
        .from('mex_tournament_access').select('tournament_id, admin_id, mex_admins(name)').in('tournament_id', ids);

    container.innerHTML = (tournamentRows || []).map(t => {
        const isOwner    = t.owner_admin_id === currentAdmin.id;
        const sharedWith = (accessRows || []).filter(a => a.tournament_id === t.id);
        const statusBadge = { draft:'badge-slate', live:'badge-amber', finished:'badge-green' }[t.status] || 'badge-slate';

        const adminOptions = activeAdmins
            .filter(a => !sharedWith.some(s => s.admin_id === a.id))
            .map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');

        return `
            <div class="card" style="margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                    <div>
                        <div style="font-weight:700; font-size:14px;">${escapeHtml(t.name)}</div>
                        <div style="font-size:10px; color:var(--muted);">${t.date ? new Date(t.date).toLocaleDateString('de-DE') : 'kein Datum'} · ${escapeHtml(t.type||'')}${isOwner ? '' : ' · freigegeben für dich'}</div>
                    </div>
                    <span class="badge ${statusBadge}">${t.status}</span>
                </div>
                ${sharedWith.length ? `<div style="margin-bottom:8px;">${sharedWith.map(s=>`<span class="badge badge-blue" style="margin-right:4px;">${escapeHtml(s.mex_admins?.name||'?')}</span>`).join('')}</div>` : ''}
                ${isOwner && adminOptions ? `
                    <div style="display:flex; gap:6px;">
                        <select id="shareSelect_${t.id}" style="font-size:12px;">${adminOptions}</select>
                        <button onclick="grantAccess('${t.id}')" class="btn btn-sm btn-primary" style="width:auto;">Freigeben</button>
                    </div>` : ''}
            </div>`;
    }).join('');
}

async function grantAccess(tournamentId) {
    const select  = document.getElementById('shareSelect_' + tournamentId);
    const adminId = select.value;
    if (!adminId) return;
    const { error } = await supabaseClient.from('mex_tournament_access')
        .insert({ tournament_id: tournamentId, admin_id: adminId });
    if (error) { alert('Fehler: ' + error.message); return; }
    loadMyTournaments();
}
