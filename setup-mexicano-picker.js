// ============================================================
// SETUP-MEXICANO — SPIELER-PICKER
// ============================================================

let mexPlayerPool  = null;   // [{id, name, level}]
let pickerSelected = [];     // [{id, name, level}]

async function openPlayerPicker() {
    if (!mexPlayerPool) {
        // Spieler + aktuelles Level laden
        const [{ data: players, error }, { data: levels }] = await Promise.all([
            supabaseClient.from('mex_players').select('id, name').eq('active', true).order('name'),
            supabaseClient.from('mex_player_latest_level').select('player_id, latest_level')
        ]);
        if (error) { alert('Fehler beim Laden der Spielerliste: ' + error.message); return; }

        const lvlMap = {};
        (levels || []).forEach(l => { lvlMap[l.player_id] = l.latest_level; });

        mexPlayerPool = (players || []).map(p => ({
            id:    p.id,
            name:  p.name,
            level: lvlMap[p.id] ?? null
        }));
    }

    pickerSelected = [];
    document.getElementById('pickerSearch').value = '';
    document.getElementById('pickerOverlay').classList.remove('hidden');
    renderPickerList();
}

function closePlayerPicker() {
    document.getElementById('pickerOverlay').classList.add('hidden');
}

function levelBadgeClassMx(level) {
    if (level == null) return 'badge-slate';
    if (level >= 3.2)  return 'badge-purple';
    if (level >= 2.5)  return 'badge-amber';
    if (level >= 2.0)  return 'badge-blue';
    return 'badge-slate';
}

function renderPickerList() {
    const search     = document.getElementById('pickerSearch').value.trim().toLowerCase();
    const cap        = getValidatedCount();
    const container  = document.getElementById('pickerList');
    const capReached = pickerSelected.length >= cap;

    document.getElementById('pickerCount').textContent = `${pickerSelected.length} / ${cap}`;

    const list = (mexPlayerPool || []).filter(p => p.name.toLowerCase().includes(search));

    if (!list.length) {
        container.innerHTML = '<p style="font-size:12px; color:var(--muted); text-align:center; padding:14px;">Keine Spieler:innen gefunden.</p>';
        return;
    }

    container.innerHTML = list.map(p => {
        const checked  = pickerSelected.some(s => s.id === p.id);
        const disable  = capReached && !checked;
        const lvlStr   = p.level != null ? Number(p.level).toFixed(2) : '–';
        const badgeCls = levelBadgeClassMx(p.level);
        return `
            <label class="picker-item ${checked ? 'selected' : ''} ${disable ? 'disabled' : ''}"
                   style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px; border-radius:10px; cursor:pointer; border:1.5px solid ${checked ? '#bfdbfe' : 'transparent'}; background:${checked ? '#eff6ff' : 'transparent'}; margin-bottom:4px;">
                <div style="display:flex; align-items:center; gap:10px; flex:1;">
                    <input type="checkbox" ${checked ? 'checked' : ''} ${disable ? 'disabled' : ''}
                           onchange="togglePickerPlayer('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${p.level ?? 'null'})"
                           style="width:17px; height:17px; accent-color:#2563eb; flex-shrink:0;">
                    <span style="font-size:13px; font-weight:600;">${escapeHtmlMx(p.name)}</span>
                </div>
                <span class="badge ${badgeCls}">${lvlStr}</span>
            </label>`;
    }).join('');
}

function togglePickerPlayer(id, name, level) {
    const idx = pickerSelected.findIndex(s => s.id === id);
    if (idx >= 0) {
        pickerSelected.splice(idx, 1);
    } else {
        const cap = getValidatedCount();
        if (pickerSelected.length >= cap) return;
        pickerSelected.push({ id, name, level });
    }
    renderPickerList();
}

function applyPickerSelection() {
    const count = getValidatedCount();

    for (let i = 0; i < count; i++) {
        const chosen     = pickerSelected[i];
        const nameInput  = document.getElementById('mxName_'  + i);
        const levelInput = document.getElementById('mxLevel_' + i);
        if (chosen) {
            nameInput.value  = chosen.name;
            levelInput.value = chosen.level != null ? Number(chosen.level).toFixed(2) : '1.00';
            slotPlayerId[i]  = chosen.id;
        } else {
            nameInput.value  = `Spieler ${i + 1}`;
            levelInput.value = '1.00';
            slotPlayerId[i]  = null;
        }
    }
    renderSlots();
    closePlayerPicker();
}

function escapeHtmlMx(str) {
    return String(str).replace(/[&<>"']/g, c =>
        ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
