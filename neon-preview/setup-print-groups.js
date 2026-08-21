// ============================================================
// PADEL HIRSCH – GRUPPEN DRUCK / PDF  v1.0
// Erzeugt ein neues Fenster mit 2 Seiten (A3 Querformat):
//   Seite 1 – Spielplan Gruppenphase (alle 12 Matches + Score-Felder)
//   Seite 2 – Rangtabellen + K.O.-Bracket mit farbigen Pfeilen
// Aufruf: grpPrintPlan()
// ============================================================

function grpPrintPlan() {
    if (!grpSchedule || !grpTeams || grpTeams.length === 0) {
        alert('Bitte erst Bracket generieren.');
        return;
    }

    const tournName = document.getElementById('grpTName')?.value?.trim() || 'Padel Turnier';
    const startTime = document.getElementById('grpStartTime')?.value || '';
    const matchMin  = parseInt(document.getElementById('grpMatchTime')?.value) || 16;
    const pauseMin  = parseInt(document.getElementById('grpPause')?.value)     || 3;
    const today     = new Date().toLocaleDateString('de-AT', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

    const p1Matches = grpSchedule.matches.filter(m => m.phase === 1);
    const p2Matches = grpSchedule.matches.filter(m => m.phase === 2);
    const p3Matches = grpSchedule.matches.filter(m => m.phase === 3);

    // Gruppen-Teams sortiert
    const teamsA = (grpGroups.A || []).map(idx => grpTeams[idx]);
    const teamsB = (grpGroups.B || []).map(idx => grpTeams[idx]);

    const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Spielplan – ${escForPrint(tournName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;0,900;1,900&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
/* ── PAGE SETUP ─────────────────────────────────────────── */
@page {
    size: A3 landscape;
    margin: 14mm 16mm 12mm 16mm;
}
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
    font-family: 'Barlow', sans-serif;
    background: #fff;
    color: #0f172a;
    font-size: 11pt;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

.page {
    width: 100%;
    min-height: 100vh;
    page-break-after: always;
    display: flex;
    flex-direction: column;
}
.page:last-child { page-break-after: avoid; }

/* ── HEADER ─────────────────────────────────────────────── */
.page-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    border-bottom: 3px solid #0f172a;
    padding-bottom: 8px;
    margin-bottom: 16px;
    gap: 12px;
}
.page-header-left { display: flex; align-items: center; gap: 12px; }
.header-logo {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 36pt;
    font-weight: 900;
    font-style: italic;
    color: #2563eb;
    letter-spacing: -.02em;
    line-height: 1;
    text-transform: uppercase;
}
.header-sub {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 11pt;
    font-weight: 700;
    color: #64748b;
    letter-spacing: .1em;
    text-transform: uppercase;
    line-height: 1.3;
}
.header-date {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 10pt;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: .08em;
    text-align: right;
}
.page-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 8.5pt;
    font-weight: 900;
    letter-spacing: .15em;
    text-transform: uppercase;
    color: #fff;
    background: #0f172a;
    border-radius: 5px;
    padding: 4px 10px;
    white-space: nowrap;
}

/* ── SECTION TITLES ─────────────────────────────────────── */
.section-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13pt;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .08em;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
}
.section-title::after {
    content: '';
    flex: 1;
    height: 1.5px;
    background: currentColor;
    opacity: .18;
}
.col-blue   { color: #2563eb; }
.col-purple { color: #7c3aed; }
.col-green  { color: #16a34a; }
.col-gold   { color: #d97706; }
.col-slate  { color: #0f172a; }
.col-muted  { color: #64748b; }

/* ── PAGE 1 LAYOUT ──────────────────────────────────────── */
.p1-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    flex: 1;
}
.p1-col { display: flex; flex-direction: column; gap: 14px; }

/* ── MATCH TABLE ────────────────────────────────────────── */
.match-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5pt;
}
.match-table thead tr {
    background: #f1f5f9;
}
.match-table th {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: #64748b;
    padding: 5px 8px;
    text-align: left;
    border-bottom: 2px solid #e2e8f0;
}
.match-table td {
    padding: 7px 8px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
    line-height: 1.3;
}
.match-table tr:last-child td { border-bottom: none; }
.match-table tr:nth-child(even) td { background: #fafbfc; }

.mt-round {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 14pt;
    color: #2563eb;
    min-width: 22px;
    text-align: center;
}
.mt-time {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 9pt;
    color: #0f172a;
    white-space: nowrap;
}
.mt-court {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 8pt;
    letter-spacing: .06em;
    padding: 3px 7px;
    border-radius: 4px;
    display: inline-block;
    white-space: nowrap;
}
.court-1 { background: #dbeafe; color: #1d4ed8; }
.court-2 { background: #dcfce7; color: #15803d; }
.mt-team {
    font-weight: 600;
    color: #0f172a;
    font-size: 10pt;
}
.mt-vs {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 8pt;
    letter-spacing: .08em;
    color: #94a3b8;
    text-align: center;
}
.score-field {
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
}
.score-box {
    width: 30px;
    height: 20px;
    border: 1.5px solid #cbd5e1;
    border-radius: 4px;
    background: #fff;
    display: inline-block;
}
.score-colon {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 12pt;
    color: #94a3b8;
}

/* Phase 3 rows: subtly highlighted */
.row-finale { background: #fffbeb !important; }
.row-semifinal { background: #f5f3ff !important; }

/* ── PHASE HEADER ROW ───────────────────────────────────── */
.phase-row td {
    background: #0f172a !important;
    color: #fff !important;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 9.5pt;
    letter-spacing: .12em;
    text-transform: uppercase;
    padding: 5px 8px;
}

/* ── PAGE 2 LAYOUT ──────────────────────────────────────── */
.p2-body {
    display: grid;
    grid-template-columns: 268px 1fr;
    gap: 24px;
    flex: 1;
    align-items: start;
}

/* ── RANKING TABLES (Page 2 left) ───────────────────────── */
.ranking-tables { display: flex; flex-direction: column; gap: 16px; }

.rank-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5pt;
}
.rank-table caption {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 11pt;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .1em;
    text-align: left;
    padding-bottom: 5px;
    caption-side: top;
}
.rank-table th {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 7.5pt;
    font-weight: 700;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: #64748b;
    padding: 4px 7px;
    border-bottom: 2px solid #e2e8f0;
    background: #f8fafc;
    text-align: center;
}
.rank-table th:nth-child(2) { text-align: left; }
.rank-table td {
    padding: 8px 6px;
    border-bottom: 1px solid #f1f5f9;
    text-align: center;
}
.rank-table td:nth-child(2) { text-align: left; }
.rank-table tr:last-child td { border-bottom: none; }
.rank-num {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 18pt;
    font-weight: 900;
    color: #2563eb;
    width: 26px;
    line-height: 1;
}
.rank-qual { border-left: 3px solid #16a34a !important; }
.rank-place { border-left: 3px solid #d97706 !important; }
.rank-name-field {
    width: 130px;
    height: 18px;
    border: none;
    border-bottom: 2px solid #94a3b8;
    display: inline-block;
    background: transparent;
    vertical-align: bottom;
}
.rank-small {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 7.5pt;
    font-weight: 700;
    color: #94a3b8;
    letter-spacing: .04em;
}

.qualify-badge {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 7.5pt;
    font-weight: 900;
    letter-spacing: .04em;
    text-transform: uppercase;
    padding: 3px 6px;
    border-radius: 4px;
    white-space: nowrap;
    display: inline-block;
}
.qb-grn { background: #dcfce7; color: #15803d; }
.qb-gld { background: #fef3c7; color: #b45309; }

.rank-legend {
    font-size: 8pt;
    color: #64748b;
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 3px;
}
.legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
}
.legend-bar {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    flex-shrink: 0;
}

/* ── SVG BRACKET (Page 2 right) ─────────────────────────── */
.bracket-wrap {
    overflow: visible;
}
.bracket-wrap svg {
    width: 100%;
    height: auto;
    display: block;
}
</style>
</head>
<body>

<!-- ═══════════════════════════════════════════════════════ -->
<!-- SEITE 1 – SPIELPLAN GRUPPENPHASE                       -->
<!-- ═══════════════════════════════════════════════════════ -->
<div class="page">
    <div class="page-header">
        <div class="page-header-left">
            <div class="header-logo">${escForPrint(tournName)}</div>
            <div>
                <div class="header-sub">Spielplan · Gruppenturnier</div>
                <div class="header-sub" style="color:#94a3b8;font-size:9pt;margin-top:2px;">${today}${startTime ? ' · Start ' + startTime : ''}</div>
            </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
            <div class="header-date">8 Teams · 2 Gruppen · 20 Spiele</div>
            <div class="page-label">Seite 1 / 2</div>
        </div>
    </div>

    <div class="p1-body">
        <!-- GRUPPE A -->
        <div class="p1-col">
            ${buildGroupBlock('A', teamsA, p1Matches, '#2563eb', 'court-1')}
            ${buildPhase2Block(p2Matches, teamsA, teamsB, matchMin)}
        </div>

        <!-- GRUPPE B + PHASE 3 -->
        <div class="p1-col">
            ${buildGroupBlock('B', teamsB, p1Matches, '#7c3aed', 'court-2')}
            ${buildPhase3Block(p3Matches, matchMin)}
        </div>
    </div>
</div>

<!-- ═══════════════════════════════════════════════════════ -->
<!-- SEITE 2 – RANGTABELLEN + K.O.-BRACKET                 -->
<!-- ═══════════════════════════════════════════════════════ -->
<div class="page">
    <div class="page-header">
        <div class="page-header-left">
            <div class="header-logo">${escForPrint(tournName)}</div>
            <div>
                <div class="header-sub">Rangtabellen &amp; K.O.-Bracket</div>
                <div class="header-sub" style="color:#94a3b8;font-size:9pt;margin-top:2px;">${today}</div>
            </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
            <div class="header-date">Nach Gruppenphase ausfüllen</div>
            <div class="page-label">Seite 2 / 2</div>
        </div>
    </div>

    <div class="p2-body">
        <!-- LINKS: RANGTABELLEN -->
        <div class="ranking-tables">
            <div class="section-title col-blue">Gruppe A – Endstand</div>
            ${buildRankTable('A', teamsA, '#2563eb', '#1d4ed8')}

            <div class="section-title col-purple" style="margin-top:4px;">Gruppe B – Endstand</div>
            ${buildRankTable('B', teamsB, '#7c3aed', '#6d28d9')}

            <div class="rank-legend">
                <div class="legend-item">
                    <div class="legend-bar" style="background:#16a34a;"></div>
                    <span>Platz 1–2 → Halbfinale</span>
                </div>
                <div class="legend-item">
                    <div class="legend-bar" style="background:#d97706;"></div>
                    <span>Platz 3–4 → Platzierungsspiele</span>
                </div>
            </div>

            <!-- Phase 2 times -->
            <div style="margin-top:8px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;padding:10px 12px;">
                <div style="font-family:'Barlow Condensed',sans-serif;font-size:9pt;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin-bottom:6px;">Zeitplan K.O.-Phase</div>
                ${buildTimeRef(p2Matches, p3Matches)}
            </div>
        </div>

        <!-- RECHTS: K.O. BRACKET SVG -->
        <div class="bracket-wrap">
            <div class="section-title col-slate">K.O.-Bracket</div>
            ${buildBracketSVG(teamsA, teamsB, p2Matches, p3Matches)}
        </div>
    </div>
</div>

</body>
</html>`;

    // Open in new window → user can Save as PDF via browser
    const win = window.open('', '_blank');
    if (!win) { alert('Bitte Pop-ups für diese Seite erlauben.'); return; }
    win.document.write(html);
    win.document.close();
    // Auto-trigger print dialog after fonts load
    win.addEventListener('load', () => {
        setTimeout(() => { win.focus(); win.print(); }, 800);
    });
}

// ── HELPERS ──────────────────────────────────────────────────

function escForPrint(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildGroupBlock(grp, teams, p1Matches, accentColor, courtCls) {
    const grpMatches = p1Matches.filter(m => m.group === grp);

    const rows = grpMatches.map((m, i) => {
        // Determine court class
        const cName = m.court;
        const cCls  = cName === (document.getElementById('grpCourt1Name')?.value || '1') ? 'court-1' : 'court-2';
        return `<tr>
            <td class="mt-round">${m.round}</td>
            <td class="mt-time">${m.startTime}<br><span style="font-size:7.5pt;color:#94a3b8;">–${m.endTime}</span></td>
            <td><span class="mt-court ${cCls}">Court ${escForPrint(m.court)}</span></td>
            <td class="mt-team">${escForPrint(m.t1name)}</td>
            <td class="mt-vs">VS</td>
            <td class="mt-team">${escForPrint(m.t2name)}</td>
            <td>
                <div class="score-field">
                    <div class="score-box"></div>
                    <span class="score-colon">:</span>
                    <div class="score-box"></div>
                </div>
            </td>
        </tr>`;
    }).join('');

    return `
    <div>
        <div class="section-title" style="color:${accentColor};">Gruppe ${escForPrint(grp)}
            <span style="font-size:7.5pt;font-weight:700;letter-spacing:.06em;color:#94a3b8;font-family:'Barlow Condensed',sans-serif;">
                ${teams.map(t => escForPrint(t?.name || '?')).join(' · ')}
            </span>
        </div>
        <table class="match-table">
            <thead>
                <tr>
                    <th>R</th>
                    <th>Zeit</th>
                    <th>Court</th>
                    <th colspan="3" style="text-align:center;">Teams</th>
                    <th>Score</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    </div>`;
}

function buildPhase2Block(p2Matches, teamsA, teamsB, matchMin) {
    // SF1, SF2 on round 1 – SF3, SF4 on round 2
    const sfLabels = {
        'SF1': 'Halbfinale 1 · A1 vs B2',
        'SF2': 'Halbfinale 2 · B1 vs A2',
        'SF3': 'Halbfinale 3 · A3 vs B4',
        'SF4': 'Halbfinale 4 · B3 vs A4',
    };

    const rows = p2Matches.map(m => {
        const label = sfLabels[m.id] || m.label || m.id;
        const sfRef = m.sfRef || {};
        const t1    = `Gr. ${sfRef.ga || '?'} · Platz ${sfRef.ra || '?'}`;
        const t2    = `Gr. ${sfRef.gb || '?'} · Platz ${sfRef.rb || '?'}`;
        const cCls  = m.court === (document.getElementById('grpCourt1Name')?.value || '1') ? 'court-1' : 'court-2';
        return `<tr class="row-semifinal">
            <td class="mt-round" style="color:#7c3aed;">${m.round}</td>
            <td class="mt-time">${m.startTime}</td>
            <td><span class="mt-court ${cCls}">Court ${escForPrint(m.court)}</span></td>
            <td colspan="3" style="font-size:9pt;font-weight:600;color:#4c1d95;">
                <span style="font-family:'Barlow Condensed',sans-serif;font-size:8.5pt;font-weight:900;color:#7c3aed;letter-spacing:.06em;">${escForPrint(m.id)}</span>
                &nbsp; ${escForPrint(t1)}
                <span style="color:#94a3b8;font-size:8pt;"> vs </span>
                ${escForPrint(t2)}
            </td>
            <td>
                <div class="score-field">
                    <div class="score-box"></div>
                    <span class="score-colon">:</span>
                    <div class="score-box"></div>
                </div>
            </td>
        </tr>`;
    }).join('');

    return `
    <div>
        <div class="section-title col-purple">Phase 2 · Halbfinale</div>
        <table class="match-table">
            <thead>
                <tr>
                    <th>R</th><th>Zeit</th><th>Court</th><th colspan="3" style="text-align:center;">Paarung</th><th>Score</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    </div>`;
}

function buildPhase3Block(p3Matches, matchMin) {
    const phaseLabels = {
        'F56': 'Platz 5–6',
        'F78': 'Platz 7–8',
        'F34': 'Platz 3–4',
        'F12': '🏆 Finale · Platz 1–2',
    };

    const rows = p3Matches.map(m => {
        const label  = phaseLabels[m.id] || m.label || m.id;
        const isF    = m.id === 'F12';
        const cCls   = m.court === (document.getElementById('grpCourt1Name')?.value || '1') ? 'court-1' : 'court-2';
        const src    = m.fromW
            ? `Sieger ${m.fromW[0]} vs Sieger ${m.fromW[1]}`
            : m.fromL
                ? `Verlierer ${m.fromL[0]} vs Verlierer ${m.fromL[1]}`
                : '?';
        return `<tr class="${isF ? 'row-finale' : 'row-semifinal'}">
            <td class="mt-round" style="color:${isF ? '#d97706' : '#64748b'};">${m.round}</td>
            <td class="mt-time">${m.startTime}</td>
            <td><span class="mt-court ${cCls}">Court ${escForPrint(m.court)}</span></td>
            <td colspan="3" style="font-size:9pt;font-weight:600;">
                <span style="font-family:'Barlow Condensed',sans-serif;font-size:8.5pt;font-weight:900;
                      color:${isF ? '#d97706' : '#7c3aed'};letter-spacing:.06em;">${escForPrint(m.id)}</span>
                &nbsp; <span style="font-size:9pt;font-weight:${isF ? 700 : 600};">${escForPrint(label)}</span>
                <br><span style="font-size:8pt;color:#94a3b8;">${escForPrint(src)}</span>
            </td>
            <td>
                <div class="score-field">
                    <div class="score-box" style="${isF ? 'border-color:#d97706;' : ''}"></div>
                    <span class="score-colon">:</span>
                    <div class="score-box" style="${isF ? 'border-color:#d97706;' : ''}"></div>
                </div>
            </td>
        </tr>`;
    }).join('');

    return `
    <div>
        <div class="section-title col-green">Phase 3 · Finalrunde</div>
        <table class="match-table">
            <thead>
                <tr>
                    <th>R</th><th>Zeit</th><th>Court</th><th colspan="3" style="text-align:center;">Spiel</th><th>Score</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:8px;font-size:8pt;color:#94a3b8;font-style:italic;">
            * Teams werden nach Gruppenrangliste eingetragen · W = Sieger · L = Verlierer
        </div>
    </div>`;
}

function buildRankTable(grp, teams, accentColor, darkColor) {
    const isA = grp === 'A';
    const dest = isA
        ? ['→ HF1', '→ HF2', '→ Pl. 5/6', '→ Pl. 7/8']
        : ['→ HF2', '→ HF1', '→ Pl. 5/6', '→ Pl. 7/8'];

    const rows = [1,2,3,4].map(rank => {
        const isQ   = rank <= 2;
        const qCls  = isQ ? 'qb-grn' : 'qb-gld';
        const trCls = isQ ? 'rank-qual' : 'rank-place';
        return `<tr>
            <td class="${trCls}"><span class="rank-num">${rank}</span></td>
            <td>
                <div class="rank-name-field"></div>
            </td>
            <td style="text-align:center;"><span class="rank-small">—</span></td>
            <td style="text-align:center;"><span class="rank-small">—</span></td>
            <td style="text-align:center;"><span class="rank-small">—</span></td>
            <td style="text-align:center;"><span class="rank-small">—:—</span></td>
            <td><span class="qualify-badge ${qCls}">${escForPrint(dest[rank-1])}</span></td>
        </tr>`;
    }).join('');

    return `<table class="rank-table">
        <caption style="color:${accentColor};">Gruppe ${escForPrint(grp)}</caption>
        <thead>
            <tr>
                <th>#</th>
                <th>Team</th>
                <th>Sp</th>
                <th>S</th>
                <th>N</th>
                <th>Score</th>
                <th>Weiter</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>`;
}

function buildTimeRef(p2Matches, p3Matches) {
    const allRef = [...p2Matches, ...p3Matches];
    const labels = {
        'SF1':'HF 1','SF2':'HF 2','SF3':'HF 3','SF4':'HF 4',
        'F12':'🏆 Finale','F34':'Pl. 3/4','F56':'Pl. 5/6','F78':'Pl. 7/8',
    };
    return allRef.map(m => {
        const lbl   = labels[m.id] || m.id;
        const color = m.phase === 2 ? '#7c3aed' : (m.id==='F12' ? '#d97706' : '#16a34a');
        return `<div style="display:flex;justify-content:space-between;align-items:center;
                            padding:3px 0;border-bottom:1px solid #f1f5f9;font-size:8.5pt;">
            <span style="font-family:'Barlow Condensed',sans-serif;font-weight:700;color:${color};">${escForPrint(lbl)}</span>
            <span style="font-family:'Barlow Condensed',sans-serif;font-weight:600;color:#0f172a;">${m.startTime}</span>
            <span style="font-size:7.5pt;color:#94a3b8;">Court ${escForPrint(m.court)}</span>
        </div>`;
    }).join('');
}

// ── SVG BRACKET ───────────────────────────────────────────────
// Exakt nach dem Layout der live.html renderBracket() gebaut.
// Gleiche Maße, gleiche Struktur — nur leere Schreiblinien statt Namen.
function buildBracketSVG(teamsA, teamsB, p2Matches, p3Matches) {

    function esc(s) {
        return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // ── Farben (Print-optimiert, kein dark mode) ──────────────
    const C = {
        grn:  '#16a34a',
        gld:  '#d97706',
        acc:  '#2563eb',
        pur:  '#7c3aed',
        dim:  '#94a3b8',
        mut:  '#64748b',
        brd:  '#e2e8f0',
        card: '#f8fafc',
        sol:  '#f1f5f9',
        bg:   '#ffffff',
        text: '#0f172a',
    };

    // ── Layout-Konstanten (1:1 aus live.html) ─────────────────
    const hfW = 178, finW = 178, mH = 48;
    const gapHfFin = 48;
    const headerH = 30, gapMatchV = 10, sectionGap = 28;

    // X-Positionen: kein Gruppen-Block, HF startet links
    // Kleiner Offset links für Herkunfts-Labels
    const srcW  = 44;
    const xHf   = srcW + 8;
    const xFin  = xHf + hfW + gapHfFin;
    const xLab  = xFin + finW + 10;
    const labW  = 90;
    const svgW  = xLab + labW;

    // Y-Positionen (exakt aus live.html)
    const hf1Y = headerH;
    const hf2Y = hf1Y + mH + gapMatchV;
    const hf3Y = hf2Y + mH + sectionGap;
    const hf4Y = hf3Y + mH + gapMatchV;

    const gapFinV = 10;
    const f12Y = hf1Y + (hf2Y + mH - hf1Y) / 2 - mH / 2;
    const f34Y = f12Y + mH + gapFinV;
    const f56Y = hf3Y + (hf4Y + mH - hf3Y) / 2 - mH / 2;
    const f78Y = f56Y + mH + gapFinV;

    const svgH = hf4Y + mH + 36;

    // ── Bezier-Verbindung (aus live.html conn()) ──────────────
    function conn(x1, y1, x2, y2, col, dash, opacity) {
        const mx = (x1 + x2) / 2;
        return `<path d="M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}" `
             + `fill="none" stroke="${col}" stroke-width="2" `
             + `opacity="${opacity||.6}" `
             + `${dash ? 'stroke-dasharray="6,4"' : ''}/>`;
    }

    // Pfeilspitze rechts
    function arrowR(x, y, col, op) {
        return `<polygon points="${x},${y} ${x-8},${y-4.5} ${x-8},${y+4.5}" `
             + `fill="${col}" opacity="${op||.85}"/>`;
    }

    // ── Match-Box mit Schreiblinien (statt Team-Namen) ────────
    // Identisch zu mBox() in live.html, aber:
    //   - kein Text, statt dessen 2 gestrichelte Schreiblinien
    //   - Badge oben rechts mit ID/Label
    function mBox(x, y, w, badgeId, accentCol, isGold) {
        const bord = isGold ? C.gld : C.brd;
        const acol = isGold ? C.gld : accentCol || C.acc;
        const lbg  = isGold ? '#fef3c7' : C.sol;
        // Schreiblinien: gleiche Position wie Texte in live.html
        const lx1 = x + 10;
        const lx2 = x + w - 38;  // endet vor dem Badge
        const lineTop = y + 15;       // wo y+17 Text wäre
        const lineBot = y + mH - 12;  // wo y+mH-10 Text wäre
        return `<g>
  <rect x="${x}" y="${y}" width="${w}" height="${mH}" rx="8"
        fill="${C.bg}" stroke="${bord}" stroke-width="${isGold ? 2.2 : 1.5}"/>
  ${isGold ? `<rect x="${x}" y="${y}" width="4" height="${mH}" rx="2" fill="${C.gld}"/>` : ''}
  <line x1="${x+5}" y1="${y+mH/2}" x2="${x+w-5}" y2="${y+mH/2}"
        stroke="${C.brd}" stroke-width="1" opacity="0.7"/>
  <!-- Schreiblinie oben -->
  <line x1="${lx1}" y1="${lineTop}" x2="${lx2}" y2="${lineTop}"
        stroke="${C.dim}" stroke-width="1.5" stroke-dasharray="4,3" stroke-linecap="round"/>
  <!-- Schreiblinie unten -->
  <line x1="${lx1}" y1="${lineBot}" x2="${lx2}" y2="${lineBot}"
        stroke="${C.dim}" stroke-width="1.5" stroke-dasharray="4,3" stroke-linecap="round"/>
  <!-- Badge (wie in mBox: kleines Rechteck oben rechts) -->
  <rect x="${x+w-34}" y="${y+3}" width="30" height="14" rx="4" fill="${lbg}"/>
  <text x="${x+w-19}" y="${y+13}" text-anchor="middle"
        font-family="Barlow Condensed,sans-serif" font-size="8" font-weight="900"
        fill="${acol}">${esc(badgeId)}</text>
</g>`;
    }

    // ── Herkunfts-Label links einer HF-Box ───────────────────
    function srcLbl(y, top, bot, cTop, cBot) {
        const cx  = srcW / 2;
        const midY = y + mH / 2;
        return `<g>
  <text x="${cx}" y="${midY - 5}" text-anchor="middle"
        font-family="Barlow Condensed,sans-serif" font-size="11" font-weight="900"
        fill="${cTop}">${esc(top)}</text>
  <text x="${cx}" y="${midY + 13}" text-anchor="middle"
        font-family="Barlow Condensed,sans-serif" font-size="11" font-weight="900"
        fill="${cBot}">${esc(bot)}</text>
</g>`;
    }

    // ── Platz-Label rechts ────────────────────────────────────
    function placeLbl(y, txt, col, bold) {
        return `<text x="${xLab + 4}" y="${y + mH/2 + 4}" text-anchor="start"
        font-family="Barlow Condensed,sans-serif"
        font-size="11" font-weight="${bold ? 900 : 700}"
        fill="${col}">${esc(txt)}</text>`;
    }

    // ── SVG aufbauen ──────────────────────────────────────────
    let s = `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" `
          + `style="width:100%;height:auto;display:block;overflow:visible;">`;

    // Spalten-Header (wie live.html)
    s += `<text x="${xHf + hfW/2}" y="16" text-anchor="middle"
        font-family="Barlow Condensed,sans-serif" font-size="9" font-weight="700"
        fill="${C.dim}" letter-spacing="2">HALBFINALE</text>`;
    s += `<text x="${xFin + finW/2}" y="16" text-anchor="middle"
        font-family="Barlow Condensed,sans-serif" font-size="9" font-weight="700"
        fill="${C.dim}" letter-spacing="2">FINALE</text>`;

    // Trennlinie zwischen Top/Bottom-Hälfte
    const divY = hf2Y + mH + sectionGap / 2;
    s += `<line x1="${0}" y1="${divY}" x2="${svgW}" y2="${divY}"
        stroke="${C.brd}" stroke-width="1" stroke-dasharray="5,4" opacity="0.5"/>`;

    // ── Herkunfts-Labels ──────────────────────────────────────
    s += srcLbl(hf1Y, 'A1', 'B2', C.acc,  C.pur );
    s += srcLbl(hf2Y, 'B1', 'A2', C.pur,  C.acc );
    s += srcLbl(hf3Y, 'A3', 'B4', C.acc,  C.pur );
    s += srcLbl(hf4Y, 'B3', 'A4', C.pur,  C.acc );

    // Kleine Pfeile src → HF-Box
    [hf1Y, hf2Y, hf3Y, hf4Y].forEach(fy => {
        s += `<line x1="${srcW}" y1="${fy + mH/2}" x2="${xHf - 1}" y2="${fy + mH/2}"
            stroke="${C.dim}" stroke-width="1" opacity="0.4"/>`;
        s += arrowR(xHf, fy + mH/2, C.dim, 0.4);
    });

    // ── HF-Boxen ─────────────────────────────────────────────
    s += mBox(xHf, hf1Y, hfW, 'SF1', C.grn, false);
    s += mBox(xHf, hf2Y, hfW, 'SF2', C.grn, false);
    s += mBox(xHf, hf3Y, hfW, 'SF3', C.acc, false);
    s += mBox(xHf, hf4Y, hfW, 'SF4', C.acc, false);

    // ── Finale-Boxen ─────────────────────────────────────────
    s += mBox(xFin, f12Y, finW, 'F12', C.grn, true );
    s += mBox(xFin, f34Y, finW, 'F34', C.gld, false);
    s += mBox(xFin, f56Y, finW, 'F56', C.acc, false);
    s += mBox(xFin, f78Y, finW, 'F78', C.dim, false);

    // ── Verbindungen HF → Finale (exakt wie live.html) ───────
    const hfRx = xHf + hfW;

    // Sieger SF1 + SF2 → F12 Finale (grün)
    s += conn(hfRx, hf1Y+mH/2, xFin, f12Y+mH*.25, C.grn, false, .7);
    s += conn(hfRx, hf2Y+mH/2, xFin, f12Y+mH*.75, C.grn, false, .7);
    s += arrowR(xFin, f12Y+mH*.25, C.grn);
    s += arrowR(xFin, f12Y+mH*.75, C.grn);

    // Verlierer SF1 + SF2 → F34 (gold, gestrichelt)
    s += conn(hfRx, hf1Y+mH/2, xFin, f34Y+mH*.25, C.gld, true, .55);
    s += conn(hfRx, hf2Y+mH/2, xFin, f34Y+mH*.75, C.gld, true, .55);
    s += arrowR(xFin, f34Y+mH*.25, C.gld, .7);
    s += arrowR(xFin, f34Y+mH*.75, C.gld, .7);

    // Sieger SF3 + SF4 → F56 (blau)
    s += conn(hfRx, hf3Y+mH/2, xFin, f56Y+mH*.25, C.acc, false, .65);
    s += conn(hfRx, hf4Y+mH/2, xFin, f56Y+mH*.75, C.acc, false, .65);
    s += arrowR(xFin, f56Y+mH*.25, C.acc);
    s += arrowR(xFin, f56Y+mH*.75, C.acc);

    // Verlierer SF3 + SF4 → F78 (grau, gestrichelt)
    s += conn(hfRx, hf3Y+mH/2, xFin, f78Y+mH*.25, C.dim, true, .45);
    s += conn(hfRx, hf4Y+mH/2, xFin, f78Y+mH*.75, C.dim, true, .45);
    s += arrowR(xFin, f78Y+mH*.25, C.dim, .6);
    s += arrowR(xFin, f78Y+mH*.75, C.dim, .6);

    // ── Platz-Labels rechts ───────────────────────────────────
    s += placeLbl(f12Y, '🥇 Platz 1/2', C.gld,  true );
    s += placeLbl(f34Y, '🥉 Platz 3/4', C.mut,  false);
    s += placeLbl(f56Y, '   Platz 5/6', C.acc,  false);
    s += placeLbl(f78Y, '   Platz 7/8', C.dim,  false);

    // ── Legende (wie live.html) ───────────────────────────────
    const legY = svgH - 14;
    const legItems = [
        { col: C.grn, dash: false, label: 'Sieger → Finale' },
        { col: C.gld, dash: true,  label: 'Verlierer → Pl. 3/4' },
        { col: C.acc, dash: false, label: 'Sieger → Pl. 5/6' },
        { col: C.dim, dash: true,  label: 'Verlierer → Pl. 7/8' },
    ];
    let lx = xHf;
    legItems.forEach(li => {
        s += `<line x1="${lx}" y1="${legY}" x2="${lx+20}" y2="${legY}"
            stroke="${li.col}" stroke-width="2" stroke-linecap="round"
            ${li.dash ? 'stroke-dasharray="5,3"' : ''}/>`;
        s += `<text x="${lx+24}" y="${legY+4}"
            font-family="Barlow Condensed,sans-serif" font-size="8.5" font-weight="600"
            fill="${C.mut}">${esc(li.label)}</text>`;
        lx += 132;
    });

    s += `</svg>`;
    return s;
}
