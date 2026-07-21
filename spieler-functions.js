// ============================================================
// PADEL — SPIELERVERWALTUNG
// ============================================================

// ------------------------------------------------------------
// SUPABASE — selbes Projekt wie das bestehende Turniersystem.
// Neue Tabellen tragen das Präfix "mex_", damit es keine Kollision
// mit der bestehenden "tournaments"-Tabelle gibt.
// ------------------------------------------------------------
const SB_URL = "https://vjcvchczbyvhweiwrunp.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqY3ZjaGN6Ynl2aHdlaXdydW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NjkzNjYsImV4cCI6MjA4NTM0NTM2Nn0.A01bxl9dNzgmeDcOV2HZIIa2pN5vhWg3q0_FhqO1R2M";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

// ------------------------------------------------------------
// STATE
// ------------------------------------------------------------
let currentAdmin = null;       // { id, name, code }
let allPlayers = [];           // mex_players-Tabelle
let latestLevelByPlayer = {};  // player_id -> letztes bekanntes Level (global)
let activeAdmins = [];         // für "Freigeben für…"
let currentDetailPlayerId = null;
let prepSelected = {};         // player_id -> start_level (Auswahl im "Turnier vorbereiten")

// ============================================================
// INIT / LOGIN PER CODE
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
    if (tab === 'prepare') renderPreparePicker();
    if (tab === 'mine') loadMyTournaments();
}

// ============================================================
// ACCESSIBLE TOURNAMENTS (eigene + freigegebene)
// ============================================================
async function getAccessibleTournamentIds() {
    const [{ data: owned }, { data: granted }] = await Promise.all([
        supabaseClient.from('mex_tournaments').select('id').eq('owner_admin_id', currentAdmin.id),
        supabaseClient.from('mex_tournament_access').select('tournament_id').eq('admin_id', currentAdmin.id)
    ]);
    const ids = new Set();
    (owned || []).forEach(t => ids.add(t.id));
    (granted || []).forEach(g => ids.add(g.tournament_id));
    return Array.from(ids);
}

// ============================================================
// PLAYERS — LIST / ADD / ACTIVATE / DETAIL
// ============================================================
async function loadPlayers() {
    const { data: playerRows } = await supabaseClient
        .from('mex_players').select('id, name, active').order('name');
    allPlayers = playerRows || [];

    const { data: levels } = await supabaseClient
        .from('mex_player_latest_level').select('player_id, latest_level');
    latestLevelByPlayer = {};
    (levels || []).forEach(l => { latestLevelByPlayer[l.player_id] = l.latest_level; });
}

async function loadActiveAdmins() {
    const { data } = await supabaseClient.from('mex_admins').select('id, name').eq('active', true);
    activeAdmins = (data || []).filter(a => a.id !== currentAdmin.id);
}

function levelBadgeClass(level) {
    if (level == null) return 'badge-slate';
    if (level >= 3.2) return 'badge-purple';
    if (level >= 2.5) return 'badge-amber';
    if (level >= 2.0) return 'badge-blue';
    return 'badge-slate';
}

function renderPlayerList() {
    const search = document.getElementById('playerSearch').value.trim().toLowerCase();
    const showInactive = document.getElementById('showInactive').checked;
    const container = document.getElementById('playerList');

    const list = allPlayers
        .filter(p => showInactive || p.active)
        .filter(p => p.name.toLowerCase().includes(search));

    if (!list.length) {
        container.innerHTML = '<p style="text-align:center; color:var(--muted); font-size:12px; padding:20px;">Keine Spieler:innen gefunden.</p>';
        return;
    }

    container.innerHTML = list.map(p => {
        const lvl = latestLevelByPlayer[p.id];
        const lvlText = lvl != null ? `Level ${Number(lvl).toFixed(2)}` : 'noch kein Level';
        return `
            <div class="row-card ${p.active ? '' : 'inactive'}" onclick="openPlayerDetail('${p.id}')">
                <div>
                    <div style="font-weight:700; font-size:13px;">${escapeHtml(p.name)}</div>
                    <div style="font-size:10px; color:var(--muted);">${p.active ? '' : 'Inaktiv · '}${lvlText}</div>
                </div>
                <span class="badge ${levelBadgeClass(lvl)}">${lvl != null ? Number(lvl).toFixed(1) : '–'}</span>
            </div>`;
    }).join('');
}

function toggleAddPlayerForm() {
    document.getElementById('addPlayerForm').classList.toggle('hidden');
    document.getElementById('newPlayerName').value = '';
}

async function addPlayer() {
    const name = document.getElementById('newPlayerName').value.trim();
    if (!name) { alert('Bitte einen Namen eingeben.'); return; }
    const { error } = await supabaseClient.from('mex_players').insert({ name });
    if (error) { alert('Fehler: ' + error.message); return; }
    toggleAddPlayerForm();
    await loadPlayers();
    renderPlayerList();
}

async function openPlayerDetail(playerId) {
    currentDetailPlayerId = playerId;
    const player = allPlayers.find(p => p.id === playerId);
    if (!player) return;

    document.getElementById('playerListView').classList.add('hidden');
    document.getElementById('playerDetailView').classList.remove('hidden');
    document.getElementById('detailName').value = player.name;
    updateDetailActiveBtn(player.active);

    document.getElementById('playerHistoryTable').innerHTML = '<p style="font-size:12px; color:var(--muted); text-align:center; padding:14px;">Lädt…</p>';
    const accessibleIds = await getAccessibleTournamentIds();

    const { data, error } = await supabaseClient
        .from('mex_tournament_players')
        .select('start_level, final_points, final_level, placement, mex_tournaments(id, name, date, type)')
        .eq('player_id', playerId);

    if (error) {
        document.getElementById('playerHistoryTable').innerHTML = '<p style="font-size:12px; color:var(--red);">Fehler beim Laden.</p>';
        return;
    }

    const rows = (data || [])
        .filter(r => r.mex_tournaments && accessibleIds.includes(r.mex_tournaments.id))
        .sort((a, b) => new Date(b.mex_tournaments.date || 0) - new Date(a.mex_tournaments.date || 0));

    if (!rows.length) {
        document.getElementById('playerHistoryTable').innerHTML = '<p style="font-size:12px; color:var(--muted); text-align:center; padding:14px;">Noch keine Turniere für dich sichtbar.</p>';
        return;
    }

    document.getElementById('playerHistoryTable').innerHTML = `
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

function updateDetailActiveBtn(active) {
    const btn = document.getElementById('detailActiveBtn');
    btn.textContent = active ? 'Auf Inaktiv setzen' : 'Auf Aktiv setzen';
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
    alert('✅ Gespeichert.');
}

async function togglePlayerActive() {
    const player = allPlayers.find(p => p.id === currentDetailPlayerId);
    if (!player) return;
    const { error } = await supabaseClient.from('mex_players').update({ active: !player.active }).eq('id', player.id);
    if (error) { alert('Fehler: ' + error.message); return; }
    await loadPlayers();
    updateDetailActiveBtn(!player.active);
    renderPlayerList();
}

// ============================================================
// TAB: TURNIER VORBEREITEN
// ============================================================
function renderPreparePicker() {
    const search = document.getElementById('prepSearch').value.trim().toLowerCase();
    const container = document.getElementById('preparePicker');
    const list = allPlayers.filter(p => p.active && p.name.toLowerCase().includes(search));

    container.innerHTML = list.map(p => {
        const checked = prepSelected.hasOwnProperty(p.id);
        const defaultLevel = latestLevelByPlayer[p.id] != null ? Number(latestLevelByPlayer[p.id]).toFixed(2) : '1.00';
        const levelValue = checked ? prepSelected[p.id] : defaultLevel;
        return `
            <div class="picker-row">
                <label>
                    <input type="checkbox" ${checked ? 'checked' : ''} onchange="togglePrepSelect('${p.id}', '${defaultLevel}', this.checked)">
                    ${escapeHtml(p.name)}
                </label>
                <input type="number" step="0.1" min="1" max="5" value="${levelValue}"
                       ${checked ? '' : 'disabled'}
                       onchange="setPrepLevel('${p.id}', this.value)"
                       style="padding:6px 8px; font-size:12px;">
            </div>`;
    }).join('');
    updatePrepCount();
}

function togglePrepSelect(playerId, defaultLevel, isChecked) {
    if (isChecked) prepSelected[playerId] = defaultLevel;
    else delete prepSelected[playerId];
    renderPreparePicker();
}

function setPrepLevel(playerId, value) {
    if (prepSelected.hasOwnProperty(playerId)) prepSelected[playerId] = value;
}

function updatePrepCount() {
    document.getElementById('prepSelectedCount').textContent = Object.keys(prepSelected).length + ' ausgewählt';
}

async function saveDraftTournament() {
    const name = document.getElementById('prepName').value.trim();
    const date = document.getElementById('prepDate').value || null;
    const type = document.getElementById('prepType').value;
    const errorBox = document.getElementById('prepError');
    errorBox.classList.add('hidden');

    const selectedIds = Object.keys(prepSelected);
    if (!name) { errorBox.textContent = 'Bitte einen Turniernamen eingeben.'; errorBox.classList.remove('hidden'); return; }
    if (!selectedIds.length) { errorBox.textContent = 'Bitte mindestens eine:n Teilnehmer:in auswählen.'; errorBox.classList.remove('hidden'); return; }

    try {
        const { data: tournament, error: tErr } = await supabaseClient
            .from('mex_tournaments')
            .insert({ name, date, type, status: 'draft', owner_admin_id: currentAdmin.id })
            .select().single();
        if (tErr) throw tErr;

        const rows = selectedIds.map(pid => ({
            tournament_id: tournament.id,
            player_id: pid,
            start_level: parseFloat(prepSelected[pid])
        }));
        const { error: tpErr } = await supabaseClient.from('mex_tournament_players').insert(rows);
        if (tpErr) throw tpErr;

        alert(`✅ "${name}" als Entwurf angelegt (${selectedIds.length} Teilnehmer:innen).`);
        prepSelected = {};
        document.getElementById('prepName').value = '';
        document.getElementById('prepDate').value = '';
        renderPreparePicker();
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
        const isOwner = t.owner_admin_id === currentAdmin.id;
        const sharedWith = (accessRows || []).filter(a => a.tournament_id === t.id);
        const statusBadge = { draft: 'badge-slate', live: 'badge-amber', finished: 'badge-green' }[t.status] || 'badge-slate';

        const adminOptions = activeAdmins
            .filter(a => !sharedWith.some(s => s.admin_id === a.id))
            .map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');

        return `
            <div class="card" style="margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                    <div>
                        <div style="font-weight:700; font-size:14px;">${escapeHtml(t.name)}</div>
                        <div style="font-size:10px; color:var(--muted);">${t.date ? new Date(t.date).toLocaleDateString('de-DE') : 'kein Datum'} · ${escapeHtml(t.type || '')}${isOwner ? '' : ' · freigegeben für dich'}</div>
                    </div>
                    <span class="badge ${statusBadge}">${t.status}</span>
                </div>
                ${sharedWith.length ? `<div style="margin-bottom:8px;">${sharedWith.map(s => `<span class="badge badge-blue" style="margin-right:4px;">${escapeHtml(s.mex_admins?.name || '?')}</span>`).join('')}</div>` : ''}
                ${isOwner && adminOptions ? `
                    <div style="display:flex; gap:6px;">
                        <select id="shareSelect_${t.id}" style="font-size:12px;">${adminOptions}</select>
                        <button onclick="grantAccess('${t.id}')" class="btn-sm" style="background:var(--blue); color:#fff; border:none; border-radius:10px; font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11px; text-transform:uppercase; cursor:pointer;">Freigeben</button>
                    </div>` : ''}
            </div>`;
    }).join('');
}

async function grantAccess(tournamentId) {
    const select = document.getElementById('shareSelect_' + tournamentId);
    const adminId = select.value;
    if (!adminId) return;
    const { error } = await supabaseClient.from('mex_tournament_access').insert({ tournament_id: tournamentId, admin_id: adminId });
    if (error) { alert('Fehler: ' + error.message); return; }
    loadMyTournaments();
}

// ============================================================
// HELPERS
// ============================================================
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
