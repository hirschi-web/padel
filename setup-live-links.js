(() => {
  'use strict';
  const generated = new Map();
  let currentId = 'new';
  let box, publicInput, adminInput, adminOpen, adminCopy, keyCopy, rotateBtn, status;

  function esc(v) { return String(v || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function publicUrl(id) { return `${location.origin}/padel/live.html?id=${encodeURIComponent(id)}`; }
  function adminUrl(id, key) { return `${publicUrl(id)}#key=${encodeURIComponent(key)}`; }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); }
    catch (_) { const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove(); }
    setStatus('✓ Kopiert', '#166534');
  }
  function setStatus(text, color) { if(status){status.textContent=text||'';status.style.color=color||'var(--muted)';} }

  function makeButton(label, onClick, primary=false) {
    const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=onClick;
    b.style.cssText=`border:${primary?'none':'1.5px solid #e2e8f0'};background:${primary?'var(--slate)':'#fff'};color:${primary?'#fff':'var(--slate)'};border-radius:9px;padding:9px 11px;font:700 11px Arial,sans-serif;cursor:pointer;white-space:nowrap`;
    return b;
  }

  function build() {
    if(box) return;
    const host=document.querySelector('.card.p-6');
    if(!host)return;
    const header=host.firstElementChild;
    box=document.createElement('div');
    box.id='liveLinkPanel';
    box.style.cssText='display:none;margin:-4px 0 20px;padding:14px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:14px;';
    box.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px"><div><div class="lbl" style="margin:0">Live-Seite</div><div id="liveLinkTournament" style="font-size:12px;font-weight:700;color:var(--slate)"></div></div><div id="liveLinkStatus" style="font-size:10px;color:var(--muted)"></div></div>
      <div style="display:grid;gap:10px">
        <div><div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:4px">ZUSCHAUER · NUR LESEN</div><div id="publicLiveRow" style="display:flex;gap:6px;align-items:center"></div></div>
        <div><div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:4px">BEARBEITEN · GEHEIMER KEY</div><div id="adminLiveRow" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"></div></div>
      </div>`;
    if(header?.nextSibling) host.insertBefore(box,header.nextSibling); else host.appendChild(box);
    status=box.querySelector('#liveLinkStatus');

    publicInput=document.createElement('input');publicInput.readOnly=true;publicInput.style.cssText='flex:1;min-width:180px;font-size:11px;padding:9px 10px;background:#fff';
    const pubOpen=makeButton('Öffnen',()=>window.open(publicInput.value,'_blank'));
    const pubCopy=makeButton('Link kopieren',()=>copyText(publicInput.value));
    box.querySelector('#publicLiveRow').append(publicInput,pubOpen,pubCopy);

    adminInput=document.createElement('input');adminInput.readOnly=true;adminInput.placeholder='Noch kein Bearbeiten-Key erzeugt';adminInput.style.cssText='flex:1;min-width:230px;font-size:11px;padding:9px 10px;background:#fff';
    rotateBtn=makeButton('Key erzeugen / rotieren',rotateKey,true);
    adminOpen=makeButton('Öffnen',()=>window.open(adminInput.value,'_blank'));
    adminCopy=makeButton('Link kopieren',()=>copyText(adminInput.value));
    keyCopy=makeButton('Key kopieren',()=>{const k=generated.get(currentId);if(k)copyText(k)});
    box.querySelector('#adminLiveRow').append(adminInput,rotateBtn,adminOpen,adminCopy,keyCopy);
    setAdminButtons(false);
  }

  function setAdminButtons(enabled){for(const b of [adminOpen,adminCopy,keyCopy]){if(!b)continue;b.disabled=!enabled;b.style.opacity=enabled?'1':'.45';b.style.cursor=enabled?'pointer':'not-allowed';}}

  function sync(id) {
    build(); if(!box)return;
    currentId=id||document.getElementById('tournamentSelect')?.value||'new';
    if(!currentId||currentId==='new'){box.style.display='none';return;}
    box.style.display='block';
    box.querySelector('#liveLinkTournament').textContent=currentId;
    publicInput.value=publicUrl(currentId);
    const key=generated.get(currentId);
    adminInput.value=key?adminUrl(currentId,key):'';
    setAdminButtons(!!key);
    setStatus(key?'Bearbeiten-Link bereit':'Key wird nur beim Erzeugen im Klartext gezeigt');
  }

  async function rotateKey(){
    if(!currentId||currentId==='new')return;
    rotateBtn.disabled=true;rotateBtn.style.opacity='.55';setStatus('Admin-Prüfung…');
    try{
      if(!window.phNeon?.ensureAdmin) throw new Error('Neon Admin noch nicht bereit');
      await window.phNeon.ensureAdmin();
      const c=await window.phNeon.getClient();
      const r=await c.rpc('rotate_tournament_live_key',{input_tournament_id:currentId});
      if(r?.error)throw new Error(r.error.message||'Key konnte nicht erzeugt werden');
      const key=typeof r?.data==='string'?r.data:null;
      if(!key)throw new Error('Kein Key zurückgegeben');
      generated.set(currentId,key);
      adminInput.value=adminUrl(currentId,key);
      setAdminButtons(true);
      setStatus('✓ Neuer Key aktiv', '#166534');
    }catch(e){setStatus(e?.message||String(e),'#991b1b');}
    finally{rotateBtn.disabled=false;rotateBtn.style.opacity='1';}
  }

  function install(){
    build();
    const sel=document.getElementById('tournamentSelect');
    if(sel){sel.addEventListener('change',()=>sync(sel.value));sync(sel.value);}
    const timer=setInterval(()=>{
      const fn=window.loadTournament;
      if(typeof fn!=='function'||fn.__liveLinksWrapped)return;
      const wrapped=async function(...args){const r=await fn.apply(this,args);sync(args[0]||document.getElementById('tournamentSelect')?.value);return r;};
      wrapped.__liveLinksWrapped=true;window.loadTournament=wrapped;clearInterval(timer);
    },200);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();