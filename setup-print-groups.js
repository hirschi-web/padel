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
    width: 148px;
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
        ? ['→ HF1 (A1 vs B2)', '→ HF2 (B1 vs A2)', '→ Pl. 5/6', '→ Pl. 7/8']
        : ['→ HF2 (B1 vs A2)', '→ HF1 (A1 vs B2)', '→ Pl. 5/6', '→ Pl. 7/8'];

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
                <th>→ Weiter</th>
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
// Seite 2: Nur Halbfinale + Finale, alle Felder leer zum Eintragen.
// Linke Seite: kleine Herkunfts-Labels (A1/B2 etc.) mit Pfeil.
// Rechte Seite: Platz-Labels.
function buildBracketSVG(teamsA, teamsB, p2Matches, p3Matches) {

    // ── Farben ────────────────────────────────────────────────
    const C = {
        slate:  '#0f172a', blue:   '#2563eb', purple: '#7c3aed',
        green:  '#16a34a', gold:   '#d97706', red:    '#dc2626',
        muted:  '#64748b', dim:    '#94a3b8', border: '#e2e8f0',
        bg:     '#f8fafc', white:  '#ffffff',
    };

    // ── Maße ──────────────────────────────────────────────────
    // Bewusst großzügig damit nichts überlappt
    const boxW  = 190;   // Breite einer Match-Box
    const boxH  = 52;    // Höhe einer Match-Box
    const vGap  = 18;    // Vertikaler Abstand zwischen Boxen im selben Block
    const hGap  = 36;    // Vertikaler Abstand zwischen Top- und Bottom-Hälfte (Trennlinie)
    const colW  = 58;    // Horizontaler Abstand zwischen HF und Finale

    const srcW  = 38;    // Breite der Herkunfts-Labels links
    const labW  = 70;    // Breite der Platz-Labels rechts

    const padTop = 28;   // Platz für Spalten-Header oben

    // X-Positionen
    const xSrc  = 0;
    const xHF   = xSrc + srcW + 6;
    const xFin  = xHF  + boxW + colW;
    const xLab  = xFin + boxW + 10;
    const svgW  = xLab + labW + 4;

    // Y-Positionen HF (4 Boxen, 2 Hälften)
    const hf1Y = padTop;
    const hf2Y = hf1Y + boxH + vGap;
    const hf3Y = hf2Y + boxH + hGap;
    const hf4Y = hf3Y + boxH + vGap;

    // Y-Positionen Finale – mittig zwischen den jeweiligen HF-Boxenpaaren
    // F12: zentriert zwischen HF1 und HF2 (Sieger)
    // F34: direkt unter F12 (Verlierer HF1+HF2)
    const finVGap = 16;
    const f12Y = Math.round((hf1Y + hf2Y + boxH) / 2 - boxH / 2);
    const f34Y = f12Y + boxH + finVGap;
    const f56Y = Math.round((hf3Y + hf4Y + boxH) / 2 - boxH / 2);
    const f78Y = f56Y + boxH + finVGap;

    // Gesamthöhe SVG
    const legH  = 22;
    const svgH  = Math.max(hf4Y + boxH, f78Y + boxH) + legH + 16;

    // ── Hilfsfunktionen ───────────────────────────────────────

    // Bezier-Verbindungspfad
    function conn(x1, y1, x2, y2, color, dashed, opacity, sw) {
        const mx = Math.round((x1 + x2) / 2);
        return `<path d="M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}" `
             + `fill="none" stroke="${color}" stroke-width="${sw||2}" `
             + `opacity="${opacity||.75}" `
             + `${dashed ? 'stroke-dasharray="7,4"' : ''} `
             + `stroke-linecap="round"/>`;
    }

    // Pfeilspitze (zeigt nach rechts)
    function arrow(x, y, color, op) {
        return `<polygon points="${x},${y} ${x-8},${y-4.5} ${x-8},${y+4.5}" `
             + `fill="${color}" opacity="${op||.9}"/>`;
    }

    // Match-Box mit gestrichelten Schreiblinien
    function box(x, y, accent, isGold, labelTop, labelBot) {
        const bord  = isGold ? C.gold   : C.border;
        const lbg   = isGold ? '#fffbeb': C.bg;
        const acol  = isGold ? C.gold   : accent;
        const lW    = boxW - 52;  // Breite der Schreiblinie
        const lx1   = x + 10;
        const lx2   = x + 10 + lW;
        const midY  = y + boxH / 2;

        // Label-Badge oben rechts
        const badgeX = x + boxW - 46;
        const badgeW = 42;

        return `<g>
  <rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="8"
        fill="${C.white}" stroke="${bord}" stroke-width="${isGold ? 2.5 : 1.5}"/>
  ${isGold ? `<rect x="${x}" y="${y}" width="5" height="${boxH}" rx="2.5" fill="${C.gold}"/>` : ''}
  <line x1="${x+6}" y1="${midY}" x2="${x+boxW-6}" y2="${midY}"
        stroke="${C.border}" stroke-width="1"/>
  <line x1="${lx1}" y1="${midY - 11}" x2="${lx2}" y2="${midY - 11}"
        stroke="${C.dim}" stroke-width="1.5" stroke-dasharray="4,3" stroke-linecap="round"/>
  <line x1="${lx1}" y1="${midY + 14}" x2="${lx2}" y2="${midY + 14}"
        stroke="${C.dim}" stroke-width="1.5" stroke-dasharray="4,3" stroke-linecap="round"/>
  <rect x="${badgeX}" y="${y + 6}" width="${badgeW}" height="16" rx="4" fill="${lbg}"/>
  <text x="${badgeX + badgeW/2}" y="${y + 18}" text-anchor="middle"
        font-family="Barlow Condensed,sans-serif" font-size="8" font-weight="900"
        fill="${acol}" letter-spacing=".5">${labelTop}</text>
  ${labelBot ? `<text x="${x + boxW/2 - 10}" y="${y + boxH - 7}" text-anchor="middle"
        font-family="Barlow Condensed,sans-serif" font-size="7" font-weight="700"
        fill="${C.dim}" letter-spacing=".3">${labelBot}</text>` : ''}
</g>`;
    }

    // Herkunfts-Label links einer Box (z.B. "A1 / B2 →")
    function srcLabel(x, y, top, bot, c1, c2) {
        const cx = x + srcW / 2;
        return `<g>
  <text x="${cx}" y="${y + boxH * .35}" text-anchor="middle"
        font-family="Barlow Condensed,sans-serif" font-size="10" font-weight="900"
        fill="${c1}">${top}</text>
  <text x="${cx}" y="${y + boxH * .70}" text-anchor="middle"
        font-family="Barlow Condensed,sans-serif" font-size="10" font-weight="900"
        fill="${c2}">${bot}</text>
  <text x="${x + srcW - 4}" y="${y + boxH/2 + 4}" text-anchor="end"
        font-family="Barlow Condensed,sans-serif" font-size="14" font-weight="700"
        fill="${C.dim}">›</text>
</g>`;
    }

    // Platz-Label rechts einer Box
    function placeLbl(x, y, text, color, bold) {
        return `<text x="${x + 6}" y="${y + boxH/2 + 4}" text-anchor="start"
        font-family="Barlow Condensed,sans-serif" font-size="11" font-weight="${bold?900:700}"
        fill="${color}">${text}</text>`;
    }

    // ── SVG aufbauen ──────────────────────────────────────────
    let svg = `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" `
            + `style="width:100%;height:auto;display:block;">`;

    // ── Spalten-Header ────────────────────────────────────────
    svg += `<text x="${xHF + boxW/2}" y="16" text-anchor="middle"
        font-family="Barlow Condensed,sans-serif" font-size="9" font-weight="900"
        fill="${C.muted}" letter-spacing="2.5">HALBFINALE</text>`;
    svg += `<text x="${xFin + boxW/2}" y="16" text-anchor="middle"
        font-family="Barlow Condensed,sans-serif" font-size="9" font-weight="900"
        fill="${C.muted}" letter-spacing="2.5">FINALE</text>`;
    svg += `<text x="${xLab + labW/2}" y="16" text-anchor="middle"
        font-family="Barlow Condensed,sans-serif" font-size="9" font-weight="900"
        fill="${C.muted}" letter-spacing="2.5">PLATZ</text>`;

    // ── Trennlinie zwischen Top/Bottom ────────────────────────
    const divY = hf2Y + boxH + hGap / 2;
    svg += `<line x1="${xHF}" y1="${divY}" x2="${xLab + labW}" y2="${divY}"
        stroke="${C.border}" stroke-width="1" stroke-dasharray="6,4" opacity=".5"/>`;

    // ── Herkunfts-Labels (links der HF-Boxen) ─────────────────
    svg += srcLabel(xSrc, hf1Y, 'A1', 'B2', C.blue,   C.purple);
    svg += srcLabel(xSrc, hf2Y, 'B1', 'A2', C.purple, C.blue  );
    svg += srcLabel(xSrc, hf3Y, 'A3', 'B4', C.blue,   C.purple);
    svg += srcLabel(xSrc, hf4Y, 'B3', 'A4', C.purple, C.blue  );

    // ── HF-Boxen ──────────────────────────────────────────────
    svg += box(xHF, hf1Y, C.green, false, 'SF 1 · Halbfinale', '');
    svg += box(xHF, hf2Y, C.green, false, 'SF 2 · Halbfinale', '');
    svg += box(xHF, hf3Y, C.gold,  false, 'SF 3 · Halbfinale', '');
    svg += box(xHF, hf4Y, C.gold,  false, 'SF 4 · Halbfinale', '');

    // ── Finale-Boxen ──────────────────────────────────────────
    svg += box(xFin, f12Y, C.green, true,  'F12 · 🏆 Finale',   'Platz 1 / 2');
    svg += box(xFin, f34Y, C.gold,  false, 'F34 · Platz 3 / 4', '');
    svg += box(xFin, f56Y, C.blue,  false, 'F56 · Platz 5 / 6', '');
    svg += box(xFin, f78Y, C.muted, false, 'F78 · Platz 7 / 8', '');

    // ── Verbindungspfeile HF → Finale ─────────────────────────
    const hfRx = xHF + boxW;
    const hf1m = hf1Y + boxH / 2,  hf2m = hf2Y + boxH / 2;
    const hf3m = hf3Y + boxH / 2,  hf4m = hf4Y + boxH / 2;

    // Sieger SF1+SF2 → F12 Finale (grün, durchgezogen)
    svg += conn(hfRx, hf1m, xFin, f12Y + boxH * .27, C.green, false, .8, 2.2);
    svg += conn(hfRx, hf2m, xFin, f12Y + boxH * .73, C.green, false, .8, 2.2);
    svg += arrow(xFin, f12Y + boxH * .27, C.green);
    svg += arrow(xFin, f12Y + boxH * .73, C.green);

    // Verlierer SF1+SF2 → F34 Platz 3/4 (gold, gestrichelt)
    svg += conn(hfRx, hf1m, xFin, f34Y + boxH * .27, C.gold, true, .65, 1.8);
    svg += conn(hfRx, hf2m, xFin, f34Y + boxH * .73, C.gold, true, .65, 1.8);
    svg += arrow(xFin, f34Y + boxH * .27, C.gold, .7);
    svg += arrow(xFin, f34Y + boxH * .73, C.gold, .7);

    // Sieger SF3+SF4 → F56 Platz 5/6 (blau, durchgezogen)
    svg += conn(hfRx, hf3m, xFin, f56Y + boxH * .27, C.blue, false, .75, 2.2);
    svg += conn(hfRx, hf4m, xFin, f56Y + boxH * .73, C.blue, false, .75, 2.2);
    svg += arrow(xFin, f56Y + boxH * .27, C.blue);
    svg += arrow(xFin, f56Y + boxH * .73, C.blue);

    // Verlierer SF3+SF4 → F78 Platz 7/8 (grau, gestrichelt)
    svg += conn(hfRx, hf3m, xFin, f78Y + boxH * .27, C.dim, true, .5, 1.5);
    svg += conn(hfRx, hf4m, xFin, f78Y + boxH * .73, C.dim, true, .5, 1.5);
    svg += arrow(xFin, f78Y + boxH * .27, C.dim, .6);
    svg += arrow(xFin, f78Y + boxH * .73, C.dim, .6);

    // ── Platz-Labels (rechts der Finale-Boxen) ────────────────
    svg += placeLbl(xLab, f12Y, '🥇 Platz 1 / 2', C.gold,  true );
    svg += placeLbl(xLab, f34Y, '🥉 Platz 3 / 4', C.muted, false);
    svg += placeLbl(xLab, f56Y, '   Platz 5 / 6', C.blue,  false);
    svg += placeLbl(xLab, f78Y, '   Platz 7 / 8', C.dim,   false);

    // ── Legende ───────────────────────────────────────────────
    const legY = svgH - 10;
    const legItems = [
        { col: C.green, dash: false, txt: 'Sieger → Hauptfinale' },
        { col: C.gold,  dash: true,  txt: 'Verlierer → Platz 3/4' },
        { col: C.blue,  dash: false, txt: 'Sieger → Platz 5/6' },
        { col: C.dim,   dash: true,  txt: 'Verlierer → Platz 7/8' },
    ];
    let lx = xHF;
    legItems.forEach(li => {
        svg += `<line x1="${lx}" y1="${legY}" x2="${lx+20}" y2="${legY}"
            stroke="${li.col}" stroke-width="2" `
            + `${li.dash ? 'stroke-dasharray="5,3"' : ''} stroke-linecap="round"/>`;
        svg += `<text x="${lx+24}" y="${legY+4}" font-family="Barlow Condensed,sans-serif"
            font-size="8" font-weight="600" fill="${C.muted}">${li.txt}</text>`;
        lx += 140;
    });

    svg += `</svg>`;
    return svg;
}
