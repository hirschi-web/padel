// ============================================================
// SETUP-MEXICANO — SPIELER-PICKER
// Eigenständiges Widget: lädt den Spieler-Pool (mex_players) und
// lässt bis zur konfigurierten Spieleranzahl auswählen. Nutzt die
// globalen Funktionen/State aus setup-mexicano-functions.js
// (supabaseClient, slotPlayerId, getValidatedCount, renderSlots-Felder).
// ============================================================

let mexPlayerPool = null;        // einmal geladen: [{id, name}]
let pickerSelected = [];         // Reihenfolge der Auswahl: [{id, name}]

async function openPlayerPicker() {
    if (!mexPlayerPool) {
        const { data, error } = await supabaseClient
            .from('mex_players').select('id, name').eq('active', true).order('name');
        if (error) { alert('Fehler beim Laden der Spielerliste: ' + error.message); return; }
        mexPlayerPool = data || [];
    }
    pickerSelected = [];
    document.getElementById('pickerSearch').value = '';
    document.getElementById('pickerOverlay').classList.remove('hidden');
    renderPickerList();
}

function closePlayerPicker() {
    document.getElementById('pickerOverlay').classList.add('hidden');
}

function renderPickerList() {
    const search = document.getElementById('pickerSearch').value.trim().toLowerCase();
    const cap = getValidatedCount();
    const container = document.getElementById('pickerList');
    const capReached = pickerSelected.length >= cap;

    document.getElementById('pickerCount').textContent = `${pickerSelected.length} / ${cap}`;

    const list = (mexPlayerPool || []).filter(p => p.name.toLowerCase().includes(search));

    if (!list.length) {
        container.innerHTML = '<p style="font-size:12px; color:var(--muted); text-align:center; padding:14px;">Keine Spieler:innen gefunden.</p>';
        return;
    }

    container.innerHTML = list.map(p => {
        const checked = pickerSelected.some(s => s.id === p.id);
        const disable = capReached && !checked;
        return `
            <label class="picker-item ${disable ? 'disabled' : ''}">
                <input type="checkbox" ${checked ? 'checked' : ''} ${disable ? 'disabled' : ''}
                       onchange="togglePickerPlayer('${p.id}', '${p.name.replace(/'/g, "\\'")}')">
                <span style="font-size:13px; font-weight:600;">${escapeHtmlMx(p.name)}</span>
            </label>`;
    }).join('');
}

function togglePickerPlayer(id, name) {
    const idx = pickerSelected.findIndex(s => s.id === id);
    if (idx >= 0) {
        pickerSelected.splice(idx, 1);
    } else {
        const cap = getValidatedCount();
        if (pickerSelected.length >= cap) return;
        pickerSelected.push({ id, name });
    }
    renderPickerList();
}

// Ersetzt die komplette Teilnehmer-Liste: gewählte Spieler:innen
// füllen die ersten Plätze, der Rest fällt zurück auf den Platzhalter.
function applyPickerSelection() {
    const count = getValidatedCount();

    for (let i = 0; i < count; i++) {
        const chosen = pickerSelected[i];
        const nameInput = document.getElementById('mxName_' + i);
        const levelInput = document.getElementById('mxLevel_' + i);
        if (chosen) {
            nameInput.value = chosen.name;
            slotPlayerId[i] = chosen.id;
        } else {
            nameInput.value = `Spieler ${i + 1}`;
            slotPlayerId[i] = null;
        }
        levelInput.value = '1.00';
    }
    // renderSlots() liest die soeben gesetzten Feldwerte als "existing"
    // und baut die Liste inkl. korrekter "aus Spielerliste"-Tags neu auf.
    renderSlots();
    closePlayerPicker();
}

function escapeHtmlMx(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
