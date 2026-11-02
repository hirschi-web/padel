// PADEL HIRSCH — Neon production compatibility layer
(() => {
  'use strict';
  const AUTH_URL='https://ep-rough-fog-awwpb54i.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth';
  const DATA_API_URL='https://ep-rough-fog-awwpb54i.apirest.c-12.us-east-1.aws.neon.tech/neondb/rest/v1';
  const MODULE_URL='https://esm.sh/@neondatabase/neon-js@0.6.2-beta?bundle';
  const ADMIN_EMAIL='hirschi77@gmail.com';
  const CALLBACK_URL='https://hirschi-web.github.io/padel/setup.html';
  let rawClientPromise,adminReady=false;

  async function rawClient(){
    if(!rawClientPromise) rawClientPromise=import(MODULE_URL).then(({createClient})=>createClient({auth:{url:AUTH_URL,allowAnonymous:true},dataApi:{url:DATA_API_URL}}));
    return rawClientPromise;
  }
  async function authState(){try{const c=await rawClient();const r=await c.auth.getSession();if(r?.error)return{session:null,user:null,error:r.error};return{session:r?.data?.session||null,user:r?.data?.user||null,error:null}}catch(error){return{session:null,user:null,error}}}
  async function hasSession(){return !!(await authState()).session}
  async function isAdmin(){try{if(!(await hasSession())){adminReady=false;return false}const c=await rawClient();const r=await c.rpc('app_is_admin');adminReady=!r?.error&&r?.data===true;return adminReady}catch(_){adminReady=false;return false}}
  async function googleLogin(){const c=await rawClient();localStorage.setItem('padel_neon_oauth_pending','1');const r=await c.auth.signIn.social({provider:'google',callbackURL:CALLBACK_URL,loginHint:ADMIN_EMAIL});if(r?.error)throw new Error(r.error.message||'Google-Anmeldung konnte nicht gestartet werden.');return false}
  async function ensureSignedIn(){if(await hasSession())return true;await googleLogin();throw new Error('Google-Anmeldung wird geöffnet.')}
  async function claimGoogleAdmin(){await ensureSignedIn();const c=await rawClient();const r=await c.rpc('claim_admin_by_email',{input_email:ADMIN_EMAIL});if(r?.error)throw new Error(r.error.message||'Admin-Verknüpfung fehlgeschlagen.');adminReady=await isAdmin();return adminReady}
  async function ensureAdmin(){await ensureSignedIn();if(adminReady||await isAdmin())return true;if(await claimGoogleAdmin())return true;throw new Error('Das angemeldete Google-Konto besitzt keine Padel-Admin-Berechtigung.')}
  async function restoreOAuth(){if(!localStorage.getItem('padel_neon_oauth_pending'))return;for(let i=0;i<20;i++){if(await hasSession()){localStorage.removeItem('padel_neon_oauth_pending');try{await claimGoogleAdmin()}catch(e){console.error('[Neon Auth] Admin-Verknüpfung:',e)}return}await new Promise(r=>setTimeout(r,250))}}

  function removeSecrets(v){if(Array.isArray(v))return v.map(removeSecrets);if(!v||typeof v!=='object')return v;const o={};for(const[k,val]of Object.entries(v)){if(['password','pw','admin_password','adminpassword'].includes(k.toLowerCase()))continue;o[k]=removeSecrets(val)}return o}
  function findSecretRecord(v){for(const row of(Array.isArray(v)?v:[v])){if(!row||typeof row!=='object')continue;const d=row.data&&typeof row.data==='object'?row.data:{};if(!row.id)continue;let password;if(Object.prototype.hasOwnProperty.call(d,'password'))password=d.password;else if(Object.prototype.hasOwnProperty.call(d,'pw'))password=d.pw;else continue;if(password===null||password===undefined||String(password).trim()==='')return null;return{id:String(row.id),password:String(password)}}return null}

  const MUT=new Set(['insert','upsert','update','delete']);
  const ADMIN=new Set(['mex_admins','mex_players','mex_player_level_history','mex_player_latest_level','mex_tournaments','mex_tournament_access','mex_tournament_players']);
  class Q{
    constructor(t){this.table=t;this.ops=[];this.isMutation=false;this.secret=null}
    _op(n,...a){if(MUT.has(n)){this.isMutation=true;if(this.table==='tournaments'&&n!=='delete'){this.secret=findSecretRecord(a[0]);a=a.map(removeSecrets)}}this.ops.push([n,a]);return this}
    select(...a){return this._op('select',...a)} insert(...a){return this._op('insert',...a)} upsert(...a){return this._op('upsert',...a)} update(...a){return this._op('update',...a)} delete(...a){return this._op('delete',...a)} eq(...a){return this._op('eq',...a)} neq(...a){return this._op('neq',...a)} gt(...a){return this._op('gt',...a)} gte(...a){return this._op('gte',...a)} lt(...a){return this._op('lt',...a)} lte(...a){return this._op('lte',...a)} is(...a){return this._op('is',...a)} in(...a){return this._op('in',...a)} contains(...a){return this._op('contains',...a)} like(...a){return this._op('like',...a)} ilike(...a){return this._op('ilike',...a)} order(...a){return this._op('order',...a)} limit(...a){return this._op('limit',...a)} range(...a){return this._op('range',...a)} single(...a){return this._op('single',...a)} maybeSingle(...a){return this._op('maybeSingle',...a)}
    async _run(){if(this.isMutation||ADMIN.has(this.table))await ensureAdmin();const c=await rawClient();let q=c.from(this.table);for(const[n,a]of this.ops){if(typeof q[n]!=='function')return{data:null,error:{message:`Nicht unterstützte DB-Operation: ${n}`}};q=q[n](...a)}const r=await q;if(r?.error)return r;if(this.secret){const sr=await c.rpc('set_tournament_password',{input_tournament_id:this.secret.id,input_password:this.secret.password});if(sr?.error||sr?.data!==true)return{...r,error:sr?.error||{message:'Turnier-Passwort konnte nicht sicher gespeichert werden.'}}}return r}
    then(a,b){return this._run().then(a,b)} catch(a){return this._run().catch(a)} finally(a){return this._run().finally(a)}
  }
  const compat={from:t=>new Q(t),async rpc(n,a={}){const c=await rawClient();return c.rpc(n,a)},channel(){const x={on(){return x},subscribe(cb){if(cb)setTimeout(()=>cb('CHANNEL_ERROR'),0);return x},unsubscribe(){return Promise.resolve()}};return x},removeChannel(){return Promise.resolve()}};
  window.phNeon={getClient:rawClient,ensureAdmin,isAdmin,login:googleLogin,logout:async()=>{const c=await rawClient();try{await c.auth.signOut()}catch(_){}adminReady=false;localStorage.removeItem('padel_neon_oauth_pending')},sessionStatus:async()=>{const s=await authState();return{signedIn:!!s.session,email:s.user?.email||null,admin:await isAdmin()}}};
  window.supabase={createClient(){return compat}};
  restoreOAuth().catch(e=>console.error('[Neon Auth] OAuth restore:',e));
})();


/* --- bundle boundary --- */

const supabaseClient=supabase.createClient();

let tournamentId,tournamentData,isEditing=false,themes=[];
let isTyping=false,typingTimeout=null,isSaving=false,realtimeConnected=false;
let pendingSaves=[],pollInterval=null,retryInterval=null,dirtyMatches=new Set();

function parseTournamentId(){const p=new URLSearchParams(window.location.search);return p.get('id')||p.get('name')||null}

async function init(){
    tournamentId=parseTournamentId();
    if(!tournamentId){document.getElementById('tournamentTitle').innerText='Fehler: Keine Turnier-ID';return}
    await loadThemes();
    await loadTournament();
    setupFocus();
    setupRealtime();
    setupVisibility();
    setTimeout(()=>{if(!realtimeConnected){console.warn('[Init] Realtime timeout, starte Polling');startPolling()}},60000);
}

async function loadThemes(){
    try{
        const r=await fetch('live-themes.json');
        const d=await r.json();
        themes=d.themes||[];
        const current=localStorage.getItem('theme')||'navy';
        renderThemeButtons(current);
        applyTheme(current);
    }catch(e){console.warn('themes.json fehlt, nutze navy');applyTheme('navy')}
}

function renderThemeButtons(current){
    const area=document.getElementById('themeButtons');
    if(!themes.length)return;
    area.innerHTML=themes.map(t=>`<button class="theme-btn ${t.id===current?'active':''}" onclick="switchTheme('${t.id}')">${t.name}<br><span style="font-size:10px;opacity:.7">${t.desc}</span></button>`).join('');
}

function switchTheme(id){localStorage.setItem('theme',id);applyTheme(id);renderThemeButtons(id)}

function applyTheme(id){
    const t=themes.find(x=>x.id===id);
    if(!t)return;
    Object.entries(t.vars).forEach(([k,v])=>{
        const cssVar=k.replace(/([A-Z])/g,'-$1').toLowerCase();
        document.documentElement.style.setProperty('--'+cssVar,v);
    });
}

async function loadTournament(){
    try{
        const{data,error}=await supabaseClient.from('tournaments').select('*').eq('id',tournamentId);
        
        if(error)throw error;
        if(!data||!data[0]){showToast('Turnier nicht gefunden','error');return}
        
        // Check expiry date
        if(data[0].expiry_date){
            const expiry=new Date(data[0].expiry_date);
            if(expiry<new Date()){
                document.getElementById('matchesArea').innerHTML='<div style="text-align:center;padding:60px 20px"><div style="font-size:48px;margin-bottom:16px">⏰</div><div style="font-size:18px;font-weight:700;margin-bottom:8px">Turnier abgelaufen</div><div style="color:var(--text-muted)">Dieses Turnier ist nicht mehr verfügbar</div></div>';
                return;
            }
        }
        
        // Check tournament type and route
        const tournamentType=data[0].tournament_type||data[0].data?.tournamentType||'roundrobin';
        
        if(tournamentType==='knockout'||tournamentType==='ko'){
            initKnockout(data[0]);
            return;
        }
        
        // Round-Robin (default)
        tournamentData=data[0].data;
        if (typeof window.__padelApplyLiveScores === 'function') {
            window.__padelApplyLiveScores(data[0].live_data || {});
        }
        document.getElementById('tournamentTitle').innerText=data[0].id.toUpperCase();
        document.getElementById('offlineWarning').style.display='none';
        
        const pw=tournamentData.password||tournamentData.pw||null;
        const wasUnlocked=sessionStorage.getItem('isAdmin_'+tournamentId)==='true';
        
        if(pw===null||pw===undefined){
            // Kein PW → standardmäßig LOCKED, User muss entsperren
            if(wasUnlocked){
                isEditing=true;
                document.getElementById('editToggle').innerText='✏️ Bearbeiten';
            }else{
                isEditing=false;
                document.getElementById('editToggle').innerText='🔓 Bearbeiten';
            }
        }else{
            // PW vorhanden → nur unlocked wenn sessionStorage sagt true
            if(wasUnlocked){
                isEditing=true;
                document.getElementById('editToggle').innerText='✏️ Bearbeiten';
            }else{
                isEditing=false;
                document.getElementById('editToggle').innerText='🔒 Bearbeiten';
            }
        }
        
        renderAll();
    }catch(e){
        console.error('DB Load failed:',e);
        const backup=localStorage.getItem('backup_'+tournamentId);
        if(backup){
            const cached=JSON.parse(backup);
            tournamentData=cached.data;
            document.getElementById('tournamentTitle').innerText='OFFLINE';
            document.getElementById('offlineWarning').style.display='block';
            renderAll();
        }else{
            document.getElementById('tournamentTitle').innerText='Fehler beim Laden';
            showToast('❌ Keine Verbindung und kein Backup','error');
        }
    }
}

function setupFocus(){
    const sel=document.getElementById('playerFocus');
    const saved=localStorage.getItem('focus_'+tournamentId);
    if(tournamentData.isTeam||tournamentData.type==='team'){
        for(let i=0;i<tournamentData.p.length;i+=2){
            const n=`${tournamentData.p[i]} + ${tournamentData.p[i+1]}`;
            sel.add(new Option(n,n));
        }
    }else{tournamentData.p.forEach(n=>sel.add(new Option(n,n)))}
    if(saved)sel.value=saved;
}

function saveFocus(){
    const v=document.getElementById('playerFocus').value;
    if(v)localStorage.setItem('focus_'+tournamentId,v);
    else localStorage.removeItem('focus_'+tournamentId);
    renderAll();
}

function setupRealtime(){
    supabaseClient.channel('t-'+tournamentId).on('postgres_changes',{event:'UPDATE',schema:'public',table:'tournaments',filter:`id=eq.${tournamentId}`},async(payload)=>{
        realtimeConnected=true;
        tournamentData=payload.new.data;
        if(!isTyping&&!isSaving){renderAll()}
        else{console.log('[Realtime] Update pending, user typing');setTimeout(()=>{if(!isTyping&&!isSaving)renderAll()},3000)}
    }).subscribe(status=>{if(status==='SUBSCRIBED'){realtimeConnected=true;console.log('[Realtime] Connected')}});
}

function setupVisibility(){
    document.addEventListener('visibilitychange',async()=>{if(!document.hidden)await safeRefresh('Visibility')});
}

async function safeRefresh(source){
    if(isTyping||isSaving){console.log(`[${source}] Blocked - typing/saving`);return false}
    console.log(`[${source}] Refreshing`);
    await loadTournament();
    return true;
}

function startPolling(){
    if(pollInterval)return;
    console.log('[Polling] Started');
    pollInterval=setInterval(async()=>{
        if(realtimeConnected){console.log('[Polling] Realtime OK, skip');return}
        await safeRefresh('Polling');
    },30000);
}

async function manualRefresh(){
    const icon=document.getElementById('refreshIcon');
    icon.classList.add('spin');
    await loadTournament();
    setTimeout(()=>icon.classList.remove('spin'),1000);
    showToast('✓ Aktualisiert','success');
}

function toggleEdit(){
    const pw=tournamentData.password||tournamentData.pw||null;
    if(!isEditing){
        if(pw!==null&&pw!==undefined){
            const inp=prompt('Passwort eingeben:');
            if(inp===null)return; // Abbruch → nichts tun
            if(inp===pw){isEditing=true;sessionStorage.setItem('isAdmin_'+tournamentId,'true');document.getElementById('editToggle').innerText='✏️ Bearbeiten';renderAll()}
            else{showToast('❌ Falsches Passwort','error');return}
        }else{
            // Kein PW → direkt entsperren
            isEditing=true;sessionStorage.setItem('isAdmin_'+tournamentId,'true');document.getElementById('editToggle').innerText='✏️ Bearbeiten';renderAll()
        }
    }else{
        // Sperren
        isEditing=false;sessionStorage.removeItem('isAdmin_'+tournamentId);
        document.getElementById('editToggle').innerText=pw?'🔒 Bearbeiten':'🔓 Bearbeiten';
        renderAll()
    }
}

function onInputFocus(){isTyping=true;clearTimeout(typingTimeout)}
function onInputBlur(){typingTimeout=setTimeout(()=>isTyping=false,1000)}
function onInputChange(){isTyping=true;clearTimeout(typingTimeout);typingTimeout=setTimeout(()=>isTyping=false,5000)}

function onScoreInput(rIdx,mIdx){
    onInputChange();
    dirtyMatches.add(`${rIdx}-${mIdx}`);
    updateFloatingButton();
}

function updateFloatingButton(){
    const btn=document.getElementById('floatingBtn');
    if(dirtyMatches.size>0){
        btn.innerHTML=`💾 Speichern (${dirtyMatches.size})`;
        btn.style.display='block';
    }else{btn.style.display='none'}
}

async function saveAllDirty(){
    if(dirtyMatches.size===0)return;
    isSaving=true;
    const saves=Array.from(dirtyMatches);
    
    for(const key of saves){
        const[rIdx,mIdx]=key.split('-').map(Number);
        const v0=document.getElementById(`s-${rIdx}-${mIdx}-0`).value.trim();
        const v1=document.getElementById(`s-${rIdx}-${mIdx}-1`).value.trim();
        
        if(!v0&&!v1){tournamentData.s_new[rIdx].matches[mIdx].score=["",""]}
        else{
            const s0=parseInt(v0)||0,s1=parseInt(v1)||0;
            tournamentData.s_new[rIdx].matches[mIdx].score=[String(s0),String(s1)];
        }
    }
    
    localStorage.setItem('backup_'+tournamentId,JSON.stringify({data:tournamentData,timestamp:Date.now()}));
    
    try{
        await supabaseClient.from('tournaments').update({data:tournamentData}).eq('id',tournamentId);
        dirtyMatches.clear();
        updateFloatingButton();
        renderAll();
        showToast('💾 Alle Ergebnisse gespeichert','success');
    }catch(e){
        pendingSaves.push({data:JSON.parse(JSON.stringify(tournamentData)),retries:0});
        showToast('⚠️ Offline - wird synchronisiert','warning');
        startRetryQueue();
    }finally{isSaving=false}
}

function startRetryQueue(){
    if(retryInterval)return;
    retryInterval=setInterval(async()=>{
        if(pendingSaves.length===0){clearInterval(retryInterval);retryInterval=null;return}
        const save=pendingSaves[0];
        try{
            await supabaseClient.from('tournaments').update({data:save.data}).eq('id',tournamentId);
            pendingSaves.shift();
            showToast('✅ Synchronisiert','success');
        }catch(e){
            save.retries++;
            if(save.retries>5){pendingSaves.shift();showToast('❌ Sync fehlgeschlagen - Backup gespeichert','error')}
        }
    },10000);
}

function showToast(msg,type='info'){
    const toast=document.getElementById('toast');
    const colors={success:'#4ade80',warning:'#fbbf24',error:'#f87171',info:'#60a5fa'};
    toast.innerHTML=`<div style="background:${colors[type]};color:#000;padding:14px 20px;border-radius:14px;font-size:14px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.2)">${msg}</div>`;
    toast.classList.add('show');
    setTimeout(()=>toast.classList.remove('show'),3000);
}

function renderAll(){
    fillFinaleMatches();
    const area=document.getElementById('matchesArea');
    const isTeam=tournamentData.isTeam||tournamentData.type==='team';
    const focus=document.getElementById('playerFocus').value;
    const cls=isEditing?'is-editing':'';
    
    let html='';
    tournamentData.s_new.forEach((r,rIdx)=>{
        html+=`<div style="display:flex;align-items:center;gap:10px;margin:28px 0 14px"><span class="round-time">Runde ${r.id}${r.time?' · '+r.time:''}</span><div style="flex:1;height:1px;background:var(--border)"></div></div>`;
        
        r.matches.forEach((m,mIdx)=>{
            const t1N=isTeam?`${tournamentData.p[m.team1[0]]} + ${tournamentData.p[m.team1[1]]}`:tournamentData.p[m.team1[0]];
            const t2N=isTeam?`${tournamentData.p[m.team2[0]]} + ${tournamentData.p[m.team2[1]]}`:tournamentData.p[m.team2[0]];
            const hasScore=m.score&&m.score[0]!==""&&m.score[0]!==null;
            let focusPlayerIds=[];
            if(focus){
                if(isTeam){
                    for(let i=0;i<tournamentData.p.length;i+=2){
                        if(`${tournamentData.p[i]} + ${tournamentData.p[i+1]}`===focus){
                            focusPlayerIds=[i,i+1];
                            break;
                        }
                    }
                }else{
                    const idx=tournamentData.p.findIndex(p=>p===focus);
                    if(idx!==-1)focusPlayerIds=[idx];
                }
            }
            const allMatchPlayers=[m.team1[0],m.team1[1],m.team2[0],m.team2[1]].filter(id=>id!==null&&id!==undefined);
            const isFocus=focusPlayerIds.some(fid=>allMatchPlayers.includes(fid));
            const chk=pIdx=>tournamentData.p[pIdx]===focus?'text-focus':'';
            let w=0;
            if(hasScore){const s1=parseInt(m.score[0])||0,s2=parseInt(m.score[1])||0;if(s1>s2)w=1;else if(s2>s1)w=2}
            
            html+=`<div class="card ${isFocus?'card-focus':''} ${cls}" style="padding:16px;margin-bottom:12px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                    <span style="font-size:11px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:.06em">Court ${m.court||(mIdx+1)}</span>
                    ${hasScore?'<span style="font-size:16px">'+(w===1?'✅':w===2?'✅':'—')+'</span>':''}
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
                    <div style="flex:1;text-align:left;${w===1?'opacity:1':'opacity:'+(w===2?'.4':'1')}">
                        <div style="font-size:13px;font-weight:800;text-transform:uppercase;color:var(--text);line-height:1.3;${chk(m.team1[0])}">${m.team1[0]!==null&&m.team1[0]!==undefined?tournamentData.p[m.team1[0]]:"Virtuell"}</div>
                        ${m.team1[1]!==undefined&&m.team1[1]!==null?`<div style="font-size:13px;font-weight:700;text-transform:uppercase;color:var(--text-muted);line-height:1.3;${chk(m.team1[1])}">${tournamentData.p[m.team1[1]]||"Virtuell"}</div>`:''}
                    </div>
                    <div style="display:flex;align-items:center;gap:10px">
                        <input id="s-${rIdx}-${mIdx}-0" type="number" inputmode="numeric" value="${m.score?.[0]??''}" min="0" max="99" ${!isEditing?'disabled':''} onfocus="onInputFocus()" onblur="onInputBlur()" oninput="onScoreInput(${rIdx},${mIdx})" class="score-box">
                        <span style="font-size:18px;font-weight:700;color:var(--text-muted)">:</span>
                        <input id="s-${rIdx}-${mIdx}-1" type="number" inputmode="numeric" value="${m.score?.[1]??''}" min="0" max="99" ${!isEditing?'disabled':''} onfocus="onInputFocus()" onblur="onInputBlur()" oninput="onScoreInput(${rIdx},${mIdx})" class="score-box">
                    </div>
                    <div style="flex:1;text-align:right;${w===2?'opacity:1':'opacity:'+(w===1?'.4':'1')}">
                        <div style="font-size:13px;font-weight:800;text-transform:uppercase;color:var(--text);line-height:1.3;${chk(m.team2[0])}">${m.team2[0]!==null&&m.team2[0]!==undefined?tournamentData.p[m.team2[0]]:"Virtuell"}</div>
                        ${m.team2[1]!==undefined&&m.team2[1]!==null?`<div style="font-size:13px;font-weight:700;text-transform:uppercase;color:var(--text-muted);line-height:1.3;${chk(m.team2[1])}">${tournamentData.p[m.team2[1]]||"Virtuell"}</div>`:''}
                    </div>
                </div>
            </div>`;
        });
        
        if(r.pause&&r.pause.length>0){
            const pauseNames=r.pause.map(pIdx=>tournamentData.p[pIdx]).filter(Boolean).join(', ');
            if(pauseNames){
                html+=`<div style="padding:12px;background:var(--bg-card);border-radius:12px;margin-top:8px;border-left:3px solid var(--accent)"><span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:700;letter-spacing:.06em">⏸️ Pause:</span><span style="font-size:13px;font-weight:700;color:var(--text);margin-left:8px">${pauseNames}</span></div>`;
            }
        }
    });
    area.innerHTML=html;
    updateRanking();
}

function calculateQualificationRanking(){
    const isTeam=tournamentData.isTeam||tournamentData.type==='team';
    let stats=[];
    if(isTeam){for(let i=0;i<tournamentData.p.length;i+=2)stats.push({name:`${tournamentData.p[i]} + ${tournamentData.p[i+1]}`,ids:[i,i+1],points:0,diff:0,wins:0,draws:0,losses:0,played:0,history:[]})}
    else{stats=tournamentData.p.map((n,i)=>({name:n,ids:[i],points:0,diff:0,wins:0,draws:0,losses:0,played:0,history:[]}))}
    const qualRounds=tournamentData.s_new.filter(r=>!r.isFinale&&!r.isBalance);
    qualRounds.forEach(r=>{
        r.matches.forEach(m=>{
            if(m.score&&m.score[0]!==""&&m.score[0]!==null){
                const s1=parseInt(m.score[0])||0,s2=parseInt(m.score[1])||0;
                const t1N=isTeam?`${tournamentData.p[m.team1[0]]} + ${tournamentData.p[m.team1[1]]}`:tournamentData.p[m.team1[0]];
                const t2N=isTeam?`${tournamentData.p[m.team2[0]]} + ${tournamentData.p[m.team2[1]]}`:tournamentData.p[m.team2[0]];
                stats.forEach(e=>{
                    if(e.ids.some(id=>m.team1.includes(id))){e.points+=s1;e.diff+=(s1-s2);e.played++;if(s1>s2)e.wins++;else if(s1<s2)e.losses++;else e.draws++;e.history.push({opp:t2N,scored:s1,conceded:s2,diff:s1-s2})}
                    if(e.ids.some(id=>m.team2.includes(id))){e.points+=s2;e.diff+=(s2-s1);e.played++;if(s2>s1)e.wins++;else if(s2<s1)e.losses++;else e.draws++;e.history.push({opp:t1N,scored:s2,conceded:s1,diff:s2-s1})}
                })
            }
        })
    });
    stats.sort((a,b)=>b.points-a.points||b.diff-a.diff);
    return stats;
}

function fillFinaleMatches(){
    tournamentData.s_new.forEach(r=>{
        if(!r.isFinale)return;
        const needsFill=r.matches.length===0||typeof r.matches[0]?.team1[0]==='string';
        if(!needsFill)return;
        const qualStats=calculateQualificationRanking();
        const top4=qualStats.slice(0,4);
        if(top4.length>=4){
            const existingScore=r.matches[0]?.score||["",""];
            r.matches=[{court:1,team1:[top4[0].ids[0],top4[3].ids[0]],team2:[top4[1].ids[0],top4[2].ids[0]],score:existingScore}];
        }
    });
}

function updateRanking(){
    const isTeam=tournamentData.isTeam||tournamentData.type==='team';
    let stats=[];
    if(isTeam){for(let i=0;i<tournamentData.p.length;i+=2)stats.push({name:`${tournamentData.p[i]} + ${tournamentData.p[i+1]}`,ids:[i,i+1],points:0,diff:0,wins:0,draws:0,losses:0,played:0,history:[]})}
    else{stats=tournamentData.p.map((n,i)=>({name:n,ids:[i],points:0,diff:0,wins:0,draws:0,losses:0,played:0,history:[]}))}
    
    let totalMatches=0,playedMatches=0;
    tournamentData.s_new.filter(r=>!r.isFinale&&!r.isBalance).forEach(r=>{
        totalMatches+=r.matches.length;
        r.matches.forEach(m=>{
            if(m.score&&m.score[0]!==""&&m.score[0]!==null){
                playedMatches++;
                const s1=parseInt(m.score[0])||0,s2=parseInt(m.score[1])||0;
                
                if(r.isFinale){
                    [m.team1[0],m.team1[1]].forEach(playerId=>{
                        if(playerId===null||playerId===undefined)return;
                        const team=stats.find(st=>st.ids.includes(playerId));
                        if(team){
                            team.points+=s1;team.diff+=(s1-s2);team.played++;
                            if(s1>s2)team.wins++;else if(s1<s2)team.losses++;else team.draws++;
                            team.history.push({opp:"(Finale)",scored:s1,conceded:s2,diff:s1-s2});
                        }
                    });
                    [m.team2[0],m.team2[1]].forEach(playerId=>{
                        if(playerId===null||playerId===undefined)return;
                        const team=stats.find(st=>st.ids.includes(playerId));
                        if(team){
                            team.points+=s2;team.diff+=(s2-s1);team.played++;
                            if(s2>s1)team.wins++;else if(s2<s1)team.losses++;else team.draws++;
                            team.history.push({opp:"(Finale)",scored:s2,conceded:s1,diff:s2-s1});
                        }
                    });
                }else{
                    const t1N=isTeam?`${tournamentData.p[m.team1[0]]} + ${tournamentData.p[m.team1[1]]}`:tournamentData.p[m.team1[0]];
                    const t2N=isTeam?`${tournamentData.p[m.team2[0]]} + ${tournamentData.p[m.team2[1]]}`:tournamentData.p[m.team2[0]];
                    stats.forEach(e=>{
                        if(e.ids.some(id=>m.team1.includes(id))){e.points+=s1;e.diff+=(s1-s2);e.played++;if(s1>s2)e.wins++;else if(s1<s2)e.losses++;else e.draws++;e.history.push({opp:t2N,scored:s1,conceded:s2,diff:s1-s2})}
                        if(e.ids.some(id=>m.team2.includes(id))){e.points+=s2;e.diff+=(s2-s1);e.played++;if(s2>s1)e.wins++;else if(s2<s1)e.losses++;else e.draws++;e.history.push({opp:t1N,scored:s2,conceded:s1,diff:s2-s1})}
                    })
                }
            }
        })
    });
    
    stats.sort((a,b)=>b.points-a.points||b.diff-a.diff);
    const focus=document.getElementById('playerFocus').value;
    
    document.getElementById('rankingTable').innerHTML=stats.map((s,i)=>{
        const isGold=i===0&&s.points>0;
        const isFocus=s.name===focus;
        return `<tr class="${isGold?'rank-gold':''} ${isFocus?'!bg-blue-500/10':''}" style="border-bottom:1.5px solid var(--border)">
            <td style="padding:14px 16px;font-size:13px;font-weight:800;color:${isGold?'var(--gold)':'var(--text-muted)'}">${isGold?'👑':'#'+(i+1)}</td>
            <td style="padding:14px 10px;font-size:13px;font-weight:700;text-transform:uppercase;color:var(--text);${isFocus?'font-weight:800':''}">${s.name}</td>
            <td style="padding:14px 10px;text-align:center;font-size:12px;font-weight:600;color:var(--text-muted)">${s.wins}/${s.draws}/${s.losses}</td>
            <td style="padding:14px 10px;text-align:center;font-size:16px;font-weight:800;font-family:Space Mono,monospace;color:var(--text)">${s.points}</td>
            <td style="padding:14px 16px;text-align:center;font-size:13px;font-weight:700;font-family:Space Mono,monospace;color:${s.diff>0?'var(--green)':s.diff<0?'var(--red)':'var(--text-muted)'}">${s.diff>0?'+':''}${s.diff}</td>
        </tr>`;
    }).join('');
    
    updateBot(stats,totalMatches,playedMatches,focus);
}

function updateBot(stats,totalMatches,playedMatches,focus){
    const bot=document.getElementById('botText'),status=document.getElementById('botStatus');
    const progress=totalMatches>0?Math.round((playedMatches/totalMatches)*100):0;
    const allDone=playedMatches===totalMatches&&totalMatches>0;
    
    if(!focus){bot.innerHTML='<span style="opacity:.5">Wähle oben deinen Fokus für persönliche Analyse...</span>';status.innerText='Standby';return}
    
    const me=stats.find(s=>s.name===focus),myRank=stats.findIndex(s=>s.name===focus)+1;
    if(!me)return;
    
    let L=[];
    L.push(`<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">${playedMatches}/${totalMatches} Matches · ${progress}%</div>`);
    L.push(`<div style="width:100%;background:rgba(255,255,255,.1);border-radius:8px;height:6px;margin-bottom:16px"><div style="background:var(--bot-accent);height:6px;border-radius:8px;width:${progress}%;transition:width .5s"></div></div>`);
    
    if(allDone){
        L.push(`<div style="font-size:18px;font-weight:800;color:var(--bot-accent);margin-bottom:8px">🏁 Turnier beendet!</div>`);
        L.push(`<div style="font-size:14px;margin-bottom:12px">Platz <strong style="color:var(--bot-accent)">#${myRank}</strong> mit <strong>${me.points} Punkten</strong> (${me.wins}W/${me.draws}D/${me.losses}L)</div>`);
        if(myRank===1)L.push('<div style="font-size:16px">🏆 Glückwunsch zum Sieg!</div>');
        else L.push(`<div>Differenz zu Platz 1: ${stats[0].points-me.points} Pkt</div>`);
    }else{
        L.push(`<div style="font-size:16px;font-weight:700;margin-bottom:10px">Aktuell: Platz <span style="color:var(--bot-accent)">#${myRank}</span></div>`);
        L.push(`<div style="margin-bottom:12px">${me.points} Punkte · ${me.wins} Siege · ${me.draws} Unentschieden · ${me.losses} Niederlagen · Diff ${me.diff>0?'+':''}${me.diff}</div>`);
        
        const isTeam=tournamentData.isTeam||tournamentData.type==='team';
        const last3=me.history.slice(-3);
        if(last3.length>0){
            L.push(`<div style="display:flex;gap:6px;margin-bottom:12px">`);
            last3.forEach(g=>{
                const won=g.diff>0,draw=g.diff===0;
                L.push(`<div style="padding:6px 10px;border-radius:8px;background:${draw?'rgba(148,163,184,.15)':won?'rgba(74,222,128,.15)':'rgba(248,113,113,.15)'};color:${draw?'var(--text-muted)':won?'var(--green)':'var(--red)'};font-size:12px;font-weight:700">${draw?'D':won?'W':'L'}</div>`)
            });
            L.push('</div>');
            const form=last3.filter(g=>g.diff>0).length>=2?'🔥 Stark':last3.some(g=>g.diff>=0)?'📊 Ausgeglichen':'📉 Schwach';
            L.push(`<div style="font-size:13px;margin-bottom:10px">${isTeam?'Eure':'Deine'} Form: ${form}</div>`);
        }
        
        const next=stats.find(s=>s.name!==focus&&!me.history.some(h=>h.opp===s.name||h.opp==="(Finale)"));
        if(next){
            const nextLast3=next.history.slice(-3);
            const nextRecentWins=nextLast3.filter(g=>g.diff>0).length;
            const nextForm=nextRecentWins>=2?'🔥 Stark':nextLast3.some(g=>g.diff>=0)?'📊 Ausgeglichen':'📉 Schwach';
            L.push(`<div style="border-top:1px solid rgba(255,255,255,.1);padding-top:12px">
                <div style="font-size:13px;margin-bottom:6px">⚔️ Nächster Gegner: <strong>${next.name}</strong></div>
                <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">${next.points} Pkt · ${next.wins}W/${next.draws}D/${next.losses}L · Diff ${next.diff>0?'+':''}${next.diff}</div>
                <div style="font-size:13px">${isTeam?'Deren':'Ihre'} Form: ${nextForm}</div>
            </div>`)
        }
    }
    
    bot.innerHTML=L.join('');
    status.innerText=allDone?'Abgeschlossen':`${progress}% · Aktiv`;
}

function initKnockout(tournamentRecord){
    // Redirect to dedicated K.O. page
    window.location.href = `liveturnier.html?id=${encodeURIComponent(tournamentRecord.id)}`;
}

// Startup is owned by live-interface.js and live-access.js.



/* --- bundle boundary --- */

/* NEW Sites interface. Ranking and qualification rules remain in live-core.js;
   production match writes and retry rules remain in live-access.js. */
'use strict';
const LIVE_DEMO = new URLSearchParams(location.search).get('demo') === '1';
let lastLoadedAt = null;
let loadFailed = false;
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function updateSyncState() {
    const state = document.getElementById('syncState');
    if (LIVE_DEMO) { state.textContent = 'Demo · keine Live-Daten'; return; }
    if (isSaving) state.textContent = 'Ergebnisse werden gespeichert …';
    else if (dirtyMatches.size) state.textContent = `${dirtyMatches.size} Match${dirtyMatches.size === 1 ? '' : 'es'} ungespeichert`;
    else if (loadFailed) state.textContent = 'Verbindung unterbrochen';
    else if (lastLoadedAt) state.textContent = `Stand ${lastLoadedAt.toLocaleTimeString('de-AT', {hour:'2-digit',minute:'2-digit',second:'2-digit'})} · alle 30 s`;
    else state.textContent = 'Verbindung wird hergestellt …';
}

window.loadTournament = async function () {
    try {
        const {data, error} = await supabaseClient.from('tournaments').select('*').eq('id', tournamentId);
        if (error) throw error;
        const record = data?.[0];
        if (!record) { document.getElementById('tournamentTitle').textContent = 'Turnier nicht gefunden'; document.getElementById('matchesArea').innerHTML = '<p class="empty-state">Prüfe bitte die Turnier-ID oder füge den vollständigen Live-Link auf der Startseite ein.</p>'; tournamentData = null; return; }
        if (record.expiry_date && new Date(record.expiry_date) < new Date()) {
            tournamentData = null;
            document.getElementById('tournamentTitle').textContent = 'Turnier abgelaufen';
            document.getElementById('matchesArea').innerHTML = '<p class="empty-state">Dieses Turnier ist nicht mehr verfügbar.</p>';
            return;
        }
        const type = record.tournament_type || record.data?.tournamentType || 'roundrobin';
        if (type === 'knockout' || type === 'ko') { initKnockout(record); return; }
        if (!Array.isArray(record.data?.p) || !Array.isArray(record.data?.s_new)) throw new Error('Kein unterstützter Americano-Spielplan vorhanden.');
        tournamentData = record.data;
        window.__padelApplyLiveScores?.(record.live_data || {});
        document.getElementById('tournamentTitle').textContent = record.id;
        document.getElementById('offlineWarning').hidden = true;
        document.getElementById('offlineWarning').style.display = 'none';
        lastLoadedAt = new Date(); loadFailed = false;
        renderAll(); updateSyncState();
        return true; // Full record includes live_data; no second score request needed.
    } catch (error) {
        loadFailed = true;
        const backup = localStorage.getItem('backup_' + tournamentId);
        if (backup) {
            try { tournamentData = JSON.parse(backup).data; } catch (_) { tournamentData = null; }
        }
        if (tournamentData?.p && tournamentData?.s_new) {
            document.getElementById('tournamentTitle').textContent = tournamentId;
            document.getElementById('offlineWarning').hidden = false;
            document.getElementById('offlineWarning').style.display = 'block';
            renderAll();
        } else {
            document.getElementById('tournamentTitle').textContent = 'Verbindung nicht möglich';
            document.getElementById('matchesArea').innerHTML = '<div class="empty-state">Das Turnier konnte nicht geladen werden. Bitte erneut aktualisieren.<br><small>' + escapeHTML(error.message || error) + '</small></div>';
        }
        updateSyncState();
    }
};

window.renderAll = function () {
    if (!tournamentData?.s_new || !tournamentData?.p) return;
    // A layout change (for example changing focus) must retain pending inputs.
    for (const key of dirtyMatches) {
        const [r, m] = key.split('-').map(Number);
        const a = document.getElementById(`s-${r}-${m}-0`), b = document.getElementById(`s-${r}-${m}-1`);
        if (a && b && tournamentData.s_new[r]?.matches[m]) tournamentData.s_new[r].matches[m].score = [a.value, b.value];
    }
    fillFinaleMatches();
    const focus = document.getElementById('playerFocus').value;
    const isTeam = tournamentData.isTeam || tournamentData.type === 'team';
    let focusIds = [];
    if (focus) {
        if (isTeam) { for (let i = 0; i < tournamentData.p.length; i += 2) if (`${tournamentData.p[i]} + ${tournamentData.p[i+1]}` === focus) focusIds = [i,i+1]; }
        else { const i = tournamentData.p.indexOf(focus); if (i >= 0) focusIds = [i]; }
    }
    const names = ids => ids.filter(id => id !== null && id !== undefined).map(id => `<span class="${focusIds.includes(id) ? 'focus-name' : ''}">${escapeHTML(tournamentData.p[id] || 'Virtuell')}</span>`).join('') || '<span>Virtuell</span>';
    let played = 0, total = 0;
    document.getElementById('matchesArea').innerHTML = tournamentData.s_new.map((round, rIdx) => {
        const matches = round.matches.map((match, mIdx) => {
            const hasScore = match.score && match.score[0] !== '' && match.score[0] !== null;
            if (!round.isFinale && !round.isBalance) { total++; if (hasScore) played++; }
            const score1 = parseInt(match.score?.[0]) || 0, score2 = parseInt(match.score?.[1]) || 0;
            const focused = [...match.team1, ...match.team2].some(id => focusIds.includes(id));
            const row = (team, side, winner) => `<div class="team-row ${winner ? 'winner' : ''}"><div class="team-names">${names(team)}</div><input id="s-${rIdx}-${mIdx}-${side}" class="score-box" placeholder="–" type="number" inputmode="numeric" min="0" max="99" value="${escapeHTML(match.score?.[side] ?? '')}" ${!isEditing ? 'disabled' : ''} aria-label="Runde ${escapeHTML(round.id)}, Court ${escapeHTML(match.court || mIdx+1)}, Team ${side+1}: Ergebnis" onfocus="onInputFocus()" onblur="onInputBlur()" oninput="onScoreInput(${rIdx},${mIdx})"></div>`;
            return `<article class="match-card ${focused ? 'card-focus' : ''} ${isEditing ? 'is-editing' : ''}"><div class="match-head"><span class="court-label"><i></i> COURT ${escapeHTML(match.court || mIdx+1)}</span><span class="match-status">${hasScore ? '✓ Ergebnis' : 'Offen'}</span></div><div class="match-body">${row(match.team1,0,hasScore && score1>score2)}${row(match.team2,1,hasScore && score2>score1)}</div></article>`;
        }).join('');
        const pause = (round.pause || []).map(id => tournamentData.p[id]).filter(Boolean);
        return `<section class="round"><div class="round-heading"><div class="round-label"><span class="round-number">${escapeHTML(round.id)}</span><strong>${round.isFinale ? 'Finale' : round.isBalance ? 'Ausgleichsrunde' : 'Runde ' + escapeHTML(round.id)}</strong></div><span>${escapeHTML(round.time || '')}</span></div><div class="matches-grid">${matches}</div>${pause.length ? `<div class="pause-row"><b>PAUSE</b><strong>${pause.map(escapeHTML).join(', ')}</strong></div>` : ''}</section>`;
    }).join('');
    document.getElementById('progressValue').textContent = `${played} / ${total}`;
    const progress = total ? Math.round(100 * played / total) : 0;
    document.getElementById('progressBar').style.width = progress + '%';
    document.getElementById('tournamentProgress').setAttribute('aria-valuenow', String(progress));
    document.getElementById('playerCount').textContent = tournamentData.p.length;
    document.getElementById('roundCount').textContent = tournamentData.s_new.length;
    document.getElementById('formatLabel').textContent = `${isTeam ? 'TEAM' : 'AMERICANO'} · LIVE TURNIER`;
    document.getElementById('rankingNameLabel').textContent = isTeam ? 'Team' : 'Spieler:in';
    const courts = new Set(tournamentData.s_new.flatMap(r => r.matches.map(m => m.court))).size;
    document.getElementById('tournamentMeta').textContent = `${tournamentData.s_new.length} Runden · ${courts} Court${courts === 1 ? '' : 's'} · Jeder Punkt zählt.`;
    updateRanking();
    updateSyncState();
};

// Keep original ranking/analysis calculations; escape inserted names at the HTML boundary.
const originalUpdateRanking = window.updateRanking;
window.updateRanking = function () {
    const originals = tournamentData.p;
    const focusEl = document.getElementById('playerFocus');
    const focus = focusEl.value;
    const option = document.createElement('option');
    const safeFocus = escapeHTML(focus);
    tournamentData.p = originals.map(escapeHTML);
    if (focus && safeFocus !== focus) { option.value = safeFocus; option.hidden = true; focusEl.add(option); focusEl.value = safeFocus; }
    try { originalUpdateRanking(); }
    finally { tournamentData.p = originals; option.remove(); focusEl.value = focus; }
};

window.updateFloatingButton = function () {
    const count = dirtyMatches.size;
    document.getElementById('saveDock').hidden = count === 0;
    document.body.classList.toggle('has-dirty', count > 0);
    document.getElementById('dirtyCount').textContent = `${count} Match${count === 1 ? '' : 'es'} ungespeichert`;
    const btn = document.getElementById('floatingBtn');
    btn.style.display = count ? 'block' : 'none';
    btn.textContent = `Speichern (${count})`;
    updateSyncState();
};

window.loadThemes = async function () {
    try {
        const response = await fetch('live-themes.json');
        themes = (await response.json()).themes || [];
        const current = localStorage.getItem('theme') || 'court';
        renderThemeButtons(current); applyTheme(current);
    } catch (_) { /* The stylesheet includes the complete default theme. */ }
};

function openFromInput(value) {
    const input = value.trim();
    if (!input) throw new Error('Bitte einen Live-Link oder eine Turnier-ID eingeben.');
    let id = input, key = '';
    if (/^(https?:\/\/|\/|\?)/i.test(input)) {
        const url = new URL(input, location.origin);
        id = url.searchParams.get('id') || url.searchParams.get('name');
        key = new URLSearchParams(url.hash.replace(/^#/, '')).get('key') || '';
    }
    if (!id) throw new Error('Im Link fehlt die Turnier-ID.');
    const target = new URL('/padel/live.html', location.origin);
    target.searchParams.set('id', id);
    if (key) target.hash = new URLSearchParams({key}).toString();
    location.assign(target.href);
}
document.getElementById('openTournament').addEventListener('submit', event => {
    event.preventDefault();
    try { openFromInput(document.getElementById('tournamentLink').value); }
    catch (error) { document.getElementById('openError').textContent = error.message; }
});
document.getElementById('copyViewer').addEventListener('click', async () => {
    const url = new URL('/padel/live.html', location.origin); url.searchParams.set('id', tournamentId);
    if (LIVE_DEMO) { url.search = '?demo=1'; }
    try { await navigator.clipboard.writeText(url.href); showToast('Zuschauer-Link kopiert', 'success'); }
    catch (_) { showToast('Kopieren nicht möglich. Nutze die Adresszeile ohne #key.', 'info'); }
});

window.__padelLegacyInit = async function () {
    tournamentId = parseTournamentId();
    if (!tournamentId && !LIVE_DEMO) { document.getElementById('welcome').hidden = false; document.getElementById('refreshBtn').hidden = true; document.getElementById('editToggle').hidden = true; return; }
    document.getElementById('app').hidden = false;
    void loadThemes(); // Theme fetching must not delay the tournament request.
    if (LIVE_DEMO) {
        tournamentId = 'demo';
        tournamentData = {p:['Bernhard','Alex','Julia','Max','Sophie','David'],s_new:[{id:1,time:'14:00',matches:[{court:1,team1:[0,2],team2:[1,3],score:['18','14']}],pause:[4,5]},{id:2,time:'14:20',matches:[{court:1,team1:[0,4],team2:[2,5],score:['12','20']}],pause:[1,3]},{id:3,time:'14:40',matches:[{court:1,team1:[1,4],team2:[3,5],score:['','']}],pause:[0,2]},{id:4,time:'15:00',matches:[{court:1,team1:[0,3],team2:[1,5],score:['','']}],pause:[2,4]}]};
        document.getElementById('tournamentTitle').textContent = 'Saturday Social';
        document.getElementById('demoWarning').hidden = false;
        document.getElementById('editToggle').textContent = 'Demo · Nur ansehen';
        document.getElementById('refreshBtn').hidden = true;
        setupFocus(); renderAll(); return;
    }
    await loadTournament();
    if (tournamentData?.p) { setupFocus(); renderAll(); }
    setupRealtime(); setupVisibility();
};


/* --- bundle boundary --- */

(() => {
  'use strict';
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const liveKey = (hashParams.get('key') || '').trim();
  const originalLoadTournament = window.loadTournament;
  const originalSafeRefresh = window.safeRefresh;

  function applyLiveScores(liveData, preserveDirty = true) {
    const scores = liveData && typeof liveData === 'object' ? liveData.roundrobin_scores : null;
    if (!scores || typeof tournamentData === 'undefined' || !tournamentData?.s_new) return;
    for (const [k, score] of Object.entries(scores)) {
      if (preserveDirty && typeof dirtyMatches !== 'undefined' && dirtyMatches?.has(k)) continue;
      const [r, m] = k.split('-').map(Number);
      if (!Number.isInteger(r) || !Number.isInteger(m)) continue;
      const match = tournamentData.s_new?.[r]?.matches?.[m];
      if (!match || !Array.isArray(score) || score.length < 2) continue;
      match.score = [String(score[0] ?? ''), String(score[1] ?? '')];
    }
  }

  window.__padelApplyLiveScores = applyLiveScores;

  function editStateKey() {
    return 'liveEditEnabled_' + (typeof tournamentId !== 'undefined' && tournamentId ? tournamentId : 'unknown');
  }

  function jobKey(job) {
    return `${job.rIdx}-${job.mIdx}`;
  }

  function readJob(rIdx, mIdx) {
    const el0 = document.getElementById(`s-${rIdx}-${mIdx}-0`);
    const el1 = document.getElementById(`s-${rIdx}-${mIdx}-1`);
    if (!el0 || !el1) return null;
    const v0 = el0.value.trim();
    const v1 = el1.value.trim();
    let s0 = null, s1 = null;
    if (v0 || v1) {
      s0 = parseInt(v0, 10) || 0;
      s1 = parseInt(v1, 10) || 0;
    }
    return { rIdx, mIdx, s0, s1 };
  }

  function sameScore(a, b) {
    return !!a && !!b && a.rIdx === b.rIdx && a.mIdx === b.mIdx && a.s0 === b.s0 && a.s1 === b.s1;
  }

  function isJobCurrent(job) {
    const key = jobKey(job);
    if (!dirtyMatches.has(key)) return false;
    return sameScore(job, readJob(job.rIdx, job.mIdx));
  }

  function markJobSaved(job) {
    const key = jobKey(job);
    if (isJobCurrent(job)) dirtyMatches.delete(key);
    for (let i = pendingSaves.length - 1; i >= 0; i--) {
      if (jobKey(pendingSaves[i]) === key && sameScore(pendingSaves[i], job)) pendingSaves.splice(i, 1);
    }
    updateFloatingButton();
  }

  function enqueueRetry(job) {
    const key = jobKey(job);
    for (let i = pendingSaves.length - 1; i >= 0; i--) {
      if (jobKey(pendingSaves[i]) === key) pendingSaves.splice(i, 1);
    }
    pendingSaves.push({ ...job, retries: 0 });
  }

  async function refreshLiveScores() {
    const { data, error } = await supabaseClient.from('tournaments').select('live_data').eq('id', tournamentId);
    if (error) throw error;
    applyLiveScores(data?.[0]?.live_data || {});
  }

  window.loadTournament = async function () {
    const fullRecordLoaded = await originalLoadTournament();
    if (typeof tournamentData === 'undefined' || !tournamentData) return;

    try {
      if (fullRecordLoaded !== true) await refreshLiveScores();
    } catch (e) {
      console.warn('[Neon Live] live_data konnte nicht geladen werden', e);
    }

    const btn = document.getElementById('editToggle');
    if (!btn) {
      if (typeof renderAll === 'function') renderAll();
      return;
    }

    if (liveKey) {
      const shouldEdit = sessionStorage.getItem(editStateKey()) === 'true';
      isEditing = shouldEdit;
      btn.disabled = false;
      btn.innerText = shouldEdit ? '✏️ Bearbeiten' : '🔒 Bearbeiten';
      btn.title = 'Bearbeiten mit Turnier-Key';
    } else {
      isEditing = false;
      btn.disabled = true;
      btn.innerText = '👁 Nur ansehen';
      btn.title = 'Dieser Link ist nur zum Ansehen';
    }

    if (typeof renderAll === 'function') renderAll();
  };

  window.toggleEdit = function () {
    if (!liveKey) {
      isEditing = false;
      showToast('👁 Dieser Link ist nur zum Ansehen', 'info');
      return;
    }
    isEditing = !isEditing;
    if (isEditing) sessionStorage.setItem(editStateKey(), 'true');
    else sessionStorage.removeItem(editStateKey());
    const btn = document.getElementById('editToggle');
    if (btn) btn.innerText = isEditing ? '✏️ Bearbeiten' : '🔒 Bearbeiten';
    renderAll();
  };

  async function saveScore(item) {
    const c = await window.phNeon.getClient();
    const r = await c.rpc('save_tournament_live_score', {
      input_tournament_id: tournamentId,
      input_live_key: liveKey,
      input_round_index: item.rIdx,
      input_match_index: item.mIdx,
      input_score1: item.s0,
      input_score2: item.s1
    });
    if (r?.error) throw new Error(r.error.message || 'Live-Score konnte nicht gespeichert werden.');
    if (r?.data == null) throw new Error('Live-Key ungültig oder Match nicht zulässig.');
    return r.data;
  }

  window.saveAllDirty = async function () {
    if (dirtyMatches.size === 0 || isSaving) return;
    if (!liveKey) { showToast('🔒 Kein Bearbeiten-Key vorhanden', 'error'); return; }

    const jobs = [];
    for (const key of Array.from(dirtyMatches)) {
      const [rIdx, mIdx] = key.split('-').map(Number);
      const job = readJob(rIdx, mIdx);
      if (!job) continue;
      if (job.s0 == null && job.s1 == null) tournamentData.s_new[rIdx].matches[mIdx].score = ['', ''];
      else tournamentData.s_new[rIdx].matches[mIdx].score = [String(job.s0), String(job.s1)];
      jobs.push(job);
    }
    if (jobs.length === 0) return;

    isSaving = true;
    localStorage.setItem('backup_' + tournamentId, JSON.stringify({ data: tournamentData, timestamp: Date.now() }));

    let saved = 0;
    let failed = 0;
    let invalidKey = false;
    try {
      for (const job of jobs) {
        if (!isJobCurrent(job)) continue;
        try {
          const latestLiveData = await saveScore(job);
          markJobSaved(job);
          applyLiveScores(latestLiveData);
          saved++;
        } catch (e) {
          if ((e.message || '').includes('ungültig')) {
            invalidKey = true;
            break;
          }
          enqueueRetry(job);
          failed++;
        }
      }

      updateFloatingButton();
      if (dirtyMatches.size === 0 && typeof renderAll === 'function') renderAll();

      if (invalidKey) {
        showToast('❌ Ungültiger Bearbeiten-Key', 'error');
      } else if (failed > 0) {
        startRetryQueue();
        showToast(`⚠️ ${saved} gespeichert · ${failed} wird synchronisiert`, 'warning');
      } else if (saved > 0) {
        showToast(saved === jobs.length ? '💾 Alle Ergebnisse gespeichert' : `💾 ${saved} Ergebnisse gespeichert`, 'success');
      }
    } finally {
      isSaving = false;
    }
  };

  window.startRetryQueue = function () {
    if (retryInterval || !liveKey) return;
    retryInterval = setInterval(async () => {
      if (isSaving) return;
      if (pendingSaves.length === 0) {
        clearInterval(retryInterval);
        retryInterval = null;
        return;
      }

      const save = pendingSaves[0];
      if (!isJobCurrent(save)) {
        pendingSaves.shift();
        return;
      }

      try {
        isSaving = true;
        const latestLiveData = await saveScore(save);
        pendingSaves.shift();
        markJobSaved(save);
        applyLiveScores(latestLiveData);
        if (dirtyMatches.size === 0 && typeof renderAll === 'function') renderAll();
        showToast('✅ Synchronisiert', 'success');
      } catch (e) {
        save.retries++;
        if ((e.message || '').includes('ungültig')) {
          pendingSaves.shift();
          showToast('❌ Ungültiger Bearbeiten-Key', 'error');
        } else if (save.retries > 5) {
          pendingSaves.shift();
          showToast('❌ Sync fehlgeschlagen - Eingabe bleibt ungespeichert', 'error');
        }
      } finally {
        isSaving = false;
        updateFloatingButton();
      }
    }, 10000);
  };

  if (typeof originalSafeRefresh === 'function') {
    window.safeRefresh = async function (source) {
      if (isSaving || dirtyMatches.size > 0) {
        console.log(`[${source}] Blocked - unsaved/saving`);
        return false;
      }
      return originalSafeRefresh(source);
    };
  }

  window.setupRealtime = function () {
    realtimeConnected = false;
    startPolling();
  };

  window.initKnockout = function (record) {
    const suffix = liveKey ? '#key=' + encodeURIComponent(liveKey) : '';
    window.location.href = `https://hirschi-web.github.io/padel/liveturnier.html?id=${encodeURIComponent(record.id)}${suffix}`;
  };

  if (typeof window.__padelLegacyInit === 'function') window.__padelLegacyInit();
})();


/* --- bundle boundary --- */

/* NEW presentation hooks installed after the unchanged production save rules. */
(() => {
    const save = window.saveAllDirty;
    window.saveAllDirty = async function () {
        const button = document.getElementById('floatingBtn');
        if (isSaving || !dirtyMatches.size) return;
        button.disabled = true;
        try { return await save(); }
        finally { button.disabled = false; updateFloatingButton(); }
    };
    // Scroll navigation must preserve #key in the address bar.
    for (const link of document.querySelectorAll?.('.section-nav a[data-section]') || []) {
        link.addEventListener('click', event => {
            event.preventDefault();
            const target = document.getElementById(link.dataset.section);
            target?.scrollIntoView({behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
            for (const item of document.querySelectorAll('.section-nav a')) item.classList.toggle('active', item === link);
        });
    }
    window.addEventListener('beforeunload', event => {
        if (!dirtyMatches.size) return;
        event.preventDefault();
        event.returnValue = '';
    });
})();

