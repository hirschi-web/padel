// PADEL HIRSCH — Neon compatibility layer
(() => {
  'use strict';
  const AUTH_URL='https://ep-rough-fog-awwpb54i.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth';
  const DATA_API_URL='https://ep-rough-fog-awwpb54i.apirest.c-12.us-east-1.aws.neon.tech/neondb/rest/v1';
  const MODULE_URL='https://esm.sh/@neondatabase/neon-js@0.6.2-beta?bundle';
  const ADMIN_EMAIL='hirschi77@gmail.com';
  const CALLBACK_URL='https://hirschi-web.github.io/padel/neon-preview/setup.html';
  let rawClientPromise,adminReady=false;

  async function rawClient(){
    if(!rawClientPromise) rawClientPromise=import(MODULE_URL).then(({createClient})=>createClient({
      auth:{url:AUTH_URL,allowAnonymous:true},
      dataApi:{url:DATA_API_URL}
    }));
    return rawClientPromise;
  }

  async function authState(){
    try{
      const c=await rawClient();
      const r=await c.auth.getSession();
      if(r?.error) return {session:null,user:null,error:r.error};
      return {session:r?.data?.session||null,user:r?.data?.user||null,error:null};
    }catch(error){return {session:null,user:null,error};}
  }
  async function hasSession(){return !!(await authState()).session;}

  async function isAdmin(){
    try{
      if(!(await hasSession())){adminReady=false;return false;}
      const c=await rawClient();
      const r=await c.rpc('app_is_admin');
      adminReady=!r?.error&&r?.data===true;
      return adminReady;
    }catch(_){adminReady=false;return false;}
  }

  async function googleLogin(){
    const c=await rawClient();
    localStorage.setItem('padel_neon_oauth_pending','1');
    const r=await c.auth.signIn.social({provider:'google',callbackURL:CALLBACK_URL,loginHint:ADMIN_EMAIL});
    if(r?.error) throw new Error(r.error.message||'Google-Anmeldung konnte nicht gestartet werden.');
    return false;
  }

  async function ensureSignedIn(){
    if(await hasSession()) return true;
    await googleLogin();
    throw new Error('Google-Anmeldung wird geöffnet.');
  }

  // No client-side identity decision here. The DB function verifies the
  // authenticated Neon user and allowed email server-side.
  async function claimGoogleAdmin(){
    await ensureSignedIn();
    const c=await rawClient();
    const r=await c.rpc('claim_admin_by_email',{input_email:ADMIN_EMAIL});
    if(r?.error) throw new Error(r.error.message||'Admin-Verknüpfung fehlgeschlagen.');
    adminReady=await isAdmin();
    return adminReady;
  }

  async function ensureAdmin(){
    await ensureSignedIn();
    if(adminReady||await isAdmin()) return true;
    if(await claimGoogleAdmin()) return true;
    throw new Error('Das angemeldete Google-Konto besitzt keine Padel-Admin-Berechtigung.');
  }

  async function restoreOAuth(){
    if(!localStorage.getItem('padel_neon_oauth_pending')) return;
    for(let i=0;i<20;i++){
      if(await hasSession()){
        localStorage.removeItem('padel_neon_oauth_pending');
        try{await claimGoogleAdmin();}catch(e){console.error('[Neon Auth] Admin-Verknüpfung:',e);}
        return;
      }
      await new Promise(r=>setTimeout(r,250));
    }
  }

  function removeSecrets(v){
    if(Array.isArray(v)) return v.map(removeSecrets);
    if(!v||typeof v!=='object') return v;
    const o={};
    for(const[k,val]of Object.entries(v)){
      if(['password','pw','admin_password','adminpassword'].includes(k.toLowerCase())) continue;
      o[k]=removeSecrets(val);
    }
    return o;
  }
  function findSecretRecord(v){
    for(const row of(Array.isArray(v)?v:[v])){
      if(!row||typeof row!=='object') continue;
      const d=row.data&&typeof row.data==='object'?row.data:{};
      if(row.id&&(Object.prototype.hasOwnProperty.call(d,'password')||Object.prototype.hasOwnProperty.call(d,'pw'))){
        return {id:String(row.id),password:Object.prototype.hasOwnProperty.call(d,'password')?(d.password??''):(d.pw??'')};
      }
    }
    return null;
  }

  const MUT=new Set(['insert','upsert','update','delete']);
  const ADMIN=new Set(['mex_admins','mex_players','mex_player_level_history','mex_player_latest_level','mex_tournaments','mex_tournament_access','mex_tournament_players']);

  class Q{
    constructor(t){this.table=t;this.ops=[];this.isMutation=false;this.secret=null;}
    _op(n,...a){
      if(MUT.has(n)){
        this.isMutation=true;
        if(this.table==='tournaments'&&n!=='delete'){
          this.secret=findSecretRecord(a[0]);
          a=a.map(removeSecrets);
        }
      }
      this.ops.push([n,a]);return this;
    }
    select(...a){return this._op('select',...a)} insert(...a){return this._op('insert',...a)} upsert(...a){return this._op('upsert',...a)} update(...a){return this._op('update',...a)} delete(...a){return this._op('delete',...a)}
    eq(...a){return this._op('eq',...a)} neq(...a){return this._op('neq',...a)} gt(...a){return this._op('gt',...a)} gte(...a){return this._op('gte',...a)} lt(...a){return this._op('lt',...a)} lte(...a){return this._op('lte',...a)} is(...a){return this._op('is',...a)} in(...a){return this._op('in',...a)} contains(...a){return this._op('contains',...a)} like(...a){return this._op('like',...a)} ilike(...a){return this._op('ilike',...a)} order(...a){return this._op('order',...a)} limit(...a){return this._op('limit',...a)} range(...a){return this._op('range',...a)} single(...a){return this._op('single',...a)} maybeSingle(...a){return this._op('maybeSingle',...a)}
    async _run(){
      if(this.isMutation||ADMIN.has(this.table)) await ensureAdmin();
      const c=await rawClient();
      let q=c.from(this.table);
      for(const[n,a]of this.ops){
        if(typeof q[n]!=='function') return {data:null,error:{message:`Nicht unterstützte DB-Operation: ${n}`}};
        q=q[n](...a);
      }
      const r=await q;
      if(r?.error) return r;
      if(this.secret){
        const sr=await c.rpc('set_tournament_password',{input_tournament_id:this.secret.id,input_password:String(this.secret.password??'')});
        if(sr?.error||sr?.data!==true) return {...r,error:sr?.error||{message:'Turnier-Passwort konnte nicht sicher gespeichert werden.'}};
      }
      return r;
    }
    then(a,b){return this._run().then(a,b)} catch(a){return this._run().catch(a)} finally(a){return this._run().finally(a)}
  }

  const compat={
    from:t=>new Q(t),
    async rpc(n,a={}){const c=await rawClient();return c.rpc(n,a)},
    channel(){const x={on(){return x},subscribe(cb){if(cb)setTimeout(()=>cb('CHANNEL_ERROR'),0);return x},unsubscribe(){return Promise.resolve()}};return x},
    removeChannel(){return Promise.resolve()}
  };

  window.phNeon={
    getClient:rawClient,
    ensureAdmin,
    isAdmin,
    login:googleLogin,
    logout:async()=>{const c=await rawClient();try{await c.auth.signOut()}catch(_){}adminReady=false;localStorage.removeItem('padel_neon_oauth_pending');},
    sessionStatus:async()=>{const s=await authState();return{signedIn:!!s.session,email:s.user?.email||null,admin:await isAdmin()};}
  };
  window.supabase={createClient(){return compat}};
  restoreOAuth().catch(e=>console.error('[Neon Auth] OAuth restore:',e));
})();