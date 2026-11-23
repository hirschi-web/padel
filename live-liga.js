(() => {
  'use strict';
  const id = new URLSearchParams(location.search).get('id') || '281126';
  const key = new URLSearchParams(location.hash.slice(1)).get('key');
  const app = document.getElementById('app');
  const status = document.getElementById('status');
  const drafts = new Map();
  const draftKey = 'padel-liga-drafts:' + id;
  if (key) {
    try {
      for (const [slot, draft] of JSON.parse(sessionStorage.getItem(draftKey) || '[]')) {
        if (Number.isInteger(slot) && slot >= 0 && slot < 18 &&
            Array.isArray(draft?.values) && draft.values.length === 2 &&
            draft.values.every(v => typeof v === 'string')) drafts.set(slot, draft);
      }
    } catch { /* Session storage can be unavailable in private browsing. */ }
  }
  function keepDrafts() {
    try {
      if (drafts.size) sessionStorage.setItem(draftKey, JSON.stringify([...drafts]));
      else sessionStorage.removeItem(draftKey);
    } catch { /* The current tab still has the in-memory draft. */ }
  }
  let event, state, busy = false, reading = false;

  function escape(value) {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function name(i) { return escape(event.players[i]); }
  function qualification(scores) {
    const rows = event.players.map((_, i) => ({i, points:0, games:0}));
    event.rounds.forEach((round,r) => round.matches.forEach((m,c) => {
      const score = scores[r*2+c];
      if (!score) return;
      [m.team1,m.team2].forEach((team,side) => team.forEach(i => {
        rows[i].games++;
        rows[i].points += score[side];
      }));
    }));
    return rows.sort((a,b) => b.points-a.points || event.lot.indexOf(a.i)-event.lot.indexOf(b.i));
  }
  function divisions(rows) {
    const resting = event.rounds[5].pause;
    return [0,6].map(offset => {
      const teams = [0,1,2].map(i => [rows[offset+i].i, rows[offset+5-i].i]);
      const repeats = team => team.filter(i => resting.includes(i)).length;
      const idle = [0,1,2].sort((a,b) => repeats(teams[a])-repeats(teams[b]) || a-b)[0];
      const [a,b] = [0,1,2].filter(i => i !== idle);
      return {teams, games:[[a,b],[idle,a],[b,idle]], offset};
    });
  }
  function scoreBox(slot, enabled) {
    const saved = state.scores[slot];
    if (!key || !enabled) return saved ? '<strong>'+saved.join(' : ')+'</strong>' : '';
    const values = drafts.get(slot)?.values || saved || ['',''];
    const field = side => '<input aria-label="Match '+(slot+1)+', Team '+(side+1)+'" inputmode="numeric" type="text" required pattern="[0-9]{1,2}" value="'+escape(values[side])+'">';
    return '<form data-slot="'+slot+'">'+field(0)+' : '+field(1)+' <button>Speichern</button><small class="draft-note">'+(drafts.has(slot)?'Ungespeichert':'')+'</small></form>';
  }
  function match(court,first,second,box) {
    return '<div class="card"><strong>'+court+'</strong><div>'+first+' <span class="muted">gegen</span> '+second+'</div>'+box+'</div>';
  }
  const pair = team => team.map(name).join(' / ');
  function table(headers,rows) {
    return '<table><thead><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+
      rows.map(r=>'<tr>'+r.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  }
  function render() {
    const rows = qualification(state.qualification || state.scores);
    const leagues = divisions(rows);
    const locked = !!state.qualification;
    const count = Object.keys(state.scores).filter(k => Number(k)<12).length;
    const open = app.querySelector('details')?.open ?? (count<12 && !locked);
    const qual = event.rounds.map((r,i) => '<article><h3>'+escape(r.time)+' · Runde '+(i+1)+'</h3><div class="grid">'+r.matches.map((m,j) =>
      match('Platz '+Number(m.court),pair(m.team1),pair(m.team2),scoreBox(i*2+j,true))).join('')+'</div><p class="muted">Pause · '+r.pause.map(name).join(', ')+'</p></article>').join('');
    const preview = leagues.map(({teams,offset},group) => {
      const stats = teams.map((team,i) => ({i,team,wonGames:0,matches:0}));
      leagues[group].games.forEach(([a,b],r) => {
        const score = state.scores[12+2*r+group];
        if (!score) return;
        [a,b].forEach((t,j) => {
          stats[t].matches++;
          stats[t].wonGames += score[j];
        });
      });
      if (locked) stats.sort((a,b)=>b.wonGames-a.wonGames || event.teamLot.indexOf(3*group+a.i)-event.teamLot.indexOf(3*group+b.i));
      return '<section class="card"><h3 class="'+(group?'silver':'gold')+'">'+(group?'Silver · Platz 3':'Gold · Platz 1')+'</h3>'+
        table(locked ? ['Team','Matches','Games'] : ['Setzung','Team laut Zwischenstand'],stats.map(t=>locked ?
          [pair(t.team),t.matches,t.wonGames] : [(offset+t.i+1)+' + '+(offset+6-t.i),count?pair(t.team):'–']))+'</section>';
    }).join('');
    const finals = event.finalTimes.map((time,r) => '<article><h3>'+escape(time)+' · Runde '+(r+7)+'</h3><div class="grid">'+leagues.map(({teams,games,offset},g)=>{
      const [a,b]=games[r];
      const label = i => locked ? pair(teams[i]) : 'Rang '+(offset+i+1)+' + '+(offset+6-i);
      const idle=[0,1,2].find(i=>i!==a && i!==b);
      return match(g?'Silver · Platz 3':'Gold · Platz 1',label(a),label(b),scoreBox(12+2*r+g,locked)+'<p class="muted">Pause · '+label(idle)+'</p>');
    }).join('')+'</div></article>').join('');
    const first = locked ? 12 : 0;
    const end = locked ? 18 : 12;
    let missing = first;
    while (missing < end && state.scores[missing]) missing++;
    let current;
    if (missing === end && locked) {
      current = '<section class="card"><strong>Turnier abgeschlossen</strong> · Alle Ligaergebnisse gespeichert.</section>';
    } else {
      const round = Math.floor(missing/2);
      const matches = locked ? leagues.map(({teams,games},g)=>{
        const [left,right] = games[round-6];
        return [g ? 3 : 1, teams[left], teams[right]];
      }) : event.rounds[round].matches.map(m=>[m.court,m.team1,m.team2]);
      const active = new Set(matches.flatMap(([,a,b])=>[...a,...b]));
      const pause = event.players.map((_,i)=>i).filter(i=>!active.has(i));
      const time = locked ? event.finalTimes[round-6] : event.rounds[round].time;
      current = '<section class="card"><h2>Runde '+(round+1)+' · '+escape(time)+'</h2>'+
        matches.map(([court,a,b])=>'<p><strong>Platz '+court+'</strong> · '+pair(a)+' gegen '+pair(b)+'</p>').join('')+
        '<p class="muted">Pause · '+pause.map(name).join(', ')+'</p></section>';
    }
    app.innerHTML=current+'<section id="qual"><h2>Americano · Vorrunde</h2><details '+(open?'open':'')+'><summary>'+count+' von 12 Ergebnissen gespeichert</summary>'+qual+'</details></section>'+
      '<section id="liga"><h2>'+(locked?'Gold &amp; Silver':'Gold &amp; Silver · Vorschau')+'</h2><p class="muted">'+
      (locked?'Teams fixiert · '+Object.keys(state.qualification).length+' Quali-Ergebnisse bei Ligastart. Alle gewonnenen Games zählen. Bei Gleichstand entscheidet das Los.':
        'Vorläufige Teams und Spielreihenfolge. Jedes gewonnene Game zählt. Bei Gleichstand entscheidet das Los.')+'</p><div class="grid">'+preview+'</div>'+
      (!locked && key?'<p class="muted">Offen: '+event.rounds.flatMap((round,r)=>round.matches.flatMap((m,c)=>state.scores[2*r+c]?[]:['R'+(r+1)+' · Platz '+m.court])).join(', ')+'</p><button id="override">Mit aktuellem Stand starten</button>':'')+finals+'</section>'+
      '<section id="ranking"><h2>Einzelwertung'+(locked?' bei Ligastart':'')+'</h2>'+
      table(['Rang','Spieler','Matches','Games'],rows.map((row,i)=>[i+1,name(row.i),row.games,row.points]))+'</section>';
    document.title = event.title+' · Gold & Silver';
    document.getElementById('title').textContent = event.title+' · Gold & Silver';
  }
  async function rpc(method,args) {
    let timer;
    try {
      return await Promise.race([request(method,args), new Promise((_,reject)=>{
        timer=setTimeout(()=>reject(Error('Zeitüberschreitung. Stand prüfen und erneut speichern.')),15000);
      })]);
    } finally {clearTimeout(timer);}
  }
  async function request(method,args) {
    const client = await window.phNeon.getClient();
    const result = await client.rpc(method,args);
    if (result.error) throw Error(result.error.message);
    if (!result.data) throw Error('Turnier nicht verfügbar.');
    return result.data;
  }
  async function refresh() {
    if (busy || reading || document.hidden || app.contains(document.activeElement) && document.activeElement.tagName==='INPUT') return;
    reading=true;
    try {
      const record=await rpc('padel_liga_read',{event_id:id});
      if (busy || (state && record.state.rev <= state.rev)) {
        if(status.dataset.offline){status.textContent='';delete status.dataset.offline;}
        return;
      }
      if (app.contains(document.activeElement) && document.activeElement.tagName==='INPUT') return;
      event=record; state=record.state;
      for (const [slot,draft] of drafts) {
        const saved=state.scores[slot];
        if(saved && draft.values.every((v,i)=>/^\d{1,2}$/.test(v) && Number(v)===saved[i])) drafts.delete(slot);
      }
      keepDrafts(); render(); status.textContent='';delete status.dataset.offline;
    } catch(e) {status.dataset.offline='1'; status.textContent=e.message==='Turnier nicht verfügbar.' ? e.message : 'Live-Verbindung unterbrochen. Angezeigter Stand kann veraltet sein. Neuer Versuch in wenigen Sekunden.';}
    finally {reading=false;}
  }
  app.addEventListener('input',e=>{
    const form=e.target.closest('form');
    if (!form) return;
    const slot=Number(form.dataset.slot);
    drafts.set(slot,{previous:drafts.has(slot) ? drafts.get(slot).previous : (state.scores[slot] ?? null),
      values:Array.from(form.querySelectorAll('input'),input=>input.value)});
    form.querySelector('.draft-note').textContent='Ungespeichert';
    keepDrafts();
  });
  async function write(slot,points,previous) {
    if(busy)return;
    busy=true;
    app.querySelectorAll('button,input').forEach(el=>el.disabled=true);
    const wasLocked=!!state.qualification;
    try {
      state=await rpc('padel_liga_write',{event_id:id,edit_key:key,slot,points,previous,seen_rev:state.rev});
      drafts.delete(slot); keepDrafts();
      render();
      const started=!wasLocked && !!state.qualification;
      status.textContent=started?'Gold & Silver gestartet.':'Ergebnis gespeichert.';
      if(started)document.getElementById('liga').scrollIntoView();
    } catch(e) {
      if(e.message.includes('inzwischen geändert') || e.message.includes('Stand aktualisieren')) {
        try {
          const record=await rpc('padel_liga_read',{event_id:id});
          event=record; state=record.state;
          if(slot>=0) drafts.delete(slot);
          keepDrafts();
        } catch { /* Preserve the draft until the next successful read. */ }
      }
      status.textContent=e.message+' · Bitte Eingabe prüfen.';
      render();
    } finally {busy=false;}
  }
  app.addEventListener('submit',e=>{
    e.preventDefault();
    const form=e.target,slot=Number(form.dataset.slot);
    const values=Array.from(form.querySelectorAll('input'),input=>input.value.trim());
    if(!values.every(s=>/^\d{1,2}$/.test(s)))return;
    write(slot,values.map(Number),drafts.has(slot)?drafts.get(slot).previous:state.scores[slot]??null);
  });
  app.addEventListener('click',e=>{
    if(e.target.id==='override' && confirm('Jetzt mit '+Object.keys(state.scores).length+' von 12 Ergebnissen starten? Die Teams bleiben anschließend fix.')) write(-1,null,null);
  });
  document.querySelector('nav').addEventListener('click',e=>{
    const link=e.target.closest('a');
    if (!link) return;
    e.preventDefault();
    document.querySelector(link.getAttribute('href'))?.scrollIntoView();
  });
  window.addEventListener('online',refresh);
  document.addEventListener('visibilitychange',refresh);
  refresh(); setInterval(refresh,5000);
})();
