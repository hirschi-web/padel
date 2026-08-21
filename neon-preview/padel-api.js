// PADEL HIRSCH — Neon compatibility layer
(() => {
  'use strict';
  const AUTH_URL='https://ep-rough-fog-awwpb54i.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth';
  const DATA_API_URL='https://ep-rough-fog-awwpb54i.apirest.c-12.us-east-1.aws.neon.tech/neondb/rest/v1';
  const MODULE_URL='https://esm.sh/@neondatabase/neon-js@0.6.2-beta?bundle';
  const ADMIN_EMAIL_KEY='padel_neon_admin_email';
  let rawClientPromise,adminReady=false;

  async function rawClient(){if(!rawClientPromise)rawClientPromise=import(MODULE_URL).then(({createClient})=>createClient({auth:{url:AUTH_URL,allowAnonymous:true},dataApi:{url:DATA_API_URL}}));return rawClientPromise;}
  async function hasSession(){try{const c=await rawClient(),r=await c.auth.getSession();return!!r?.data?.session}catch{return false}}
  async function isAdmin(){try{const c=await rawClient(),r=await c.rpc('app_is_admin');adminReady=!r?.error&&r?.data===true;return adminReady}catch{adminReady=false;return false}}

  async function signInOrCreateAccount(){
    const client=await rawClient();
    const remembered=(localStorage.getItem(ADMIN_EMAIL_KEY)||'').trim();
    const email=(prompt('Neon Admin E-Mail:',remembered)||'').trim();
    if(!email)throw new Error('Anmeldung abgebrochen.');
    const password=prompt('Neon Admin Passwort:')||'';
    if(!password)throw new Error('Anmeldung abgebrochen.');
    let r=await client.auth.signIn.email({email,password,rememberMe:true});
    if(r?.error){if(!confirm('Anmeldung fehlgeschlagen. Neues Neon-Admin-Konto anlegen?'))throw new Error(r.error.message||'Anmeldung fehlgeschlagen.');r=await client.auth.signUp.email({email,password,name:'Padel Admin'});}
    if(r?.error)throw new Error(r.error.message||'Neon Auth Anmeldung fehlgeschlagen.');
    localStorage.setItem(ADMIN_EMAIL_KEY,email);
    return true;
  }
  async function ensureSignedIn(){if(await hasSession())return true;return signInOrCreateAccount()}
  async function claimAdmin(code){code=(code||'').trim();if(!code)throw new Error('Admin-Code fehlt.');await ensureSignedIn();const c=await rawClient(),r=await c.rpc('check_admin_code',{input_code:code});if(r?.error||!Array.isArray(r?.data)||!r.data.length)throw new Error(r?.error?.message||'Ungültiger Admin-Code oder Konto bereits anders verknüpft.');adminReady=true;return r.data[0]}
  async function ensureAdmin(){if(adminReady||await isAdmin())return true;await ensureSignedIn();if(await isAdmin())return true;const code=prompt('Einmaliger Padel Admin-Code zur Verknüpfung:');if(code===null)throw new Error('Änderung abgebrochen.');await claimAdmin(code);return true}

  function removeSecrets(v){if(Array.isArray(v))return v.map(removeSecrets);if(!v||typeof v!=='object')return v;const o={};for(const[k,val]of Object.entries(v)){if(['password','pw','admin_password','adminpassword'].includes(k.toLowerCase()))continue;o[k]=removeSecrets(val)}return o}
  function findSecretRecord(v){for(const row of(Array.isArray(v)?v:[v])){if(!row||typeof row!=='object')continue;const d=row.data&&typeof row.data==='object'?row.data:{};if(row.id&&(Object.prototype.hasOwnProperty.call(d,'password')||Object.prototype.hasOwnProperty.call(d,'pw')))return{id:String(row.id),password:Object.prototype.hasOwnProperty.call(d,'password')?(d.password??''):(d.pw??'')}}return null}
  const MUT=new Set(['insert','upsert','update','delete']);const ADMIN=new Set(['mex_admins','mex_players','mex_player_level_history','mex_player_latest_level','mex_tournaments','mex_tournament_access','mex_tournament_players']);
  class Q{constructor(t){this.table=t;this.ops=[];this.isMutation=false;this.secret=null}_op(n,...a){if(MUT.has(n)){this.isMutation=true;if(this.table==='tournaments'&&n!=='delete'){this.secret=findSecretRecord(a[0]);a=a.map(removeSecrets)}}this.ops.push([n,a]);return this}select(...a){return this._op('select',...a)}insert(...a){return this._op('insert',...a)}upsert(...a){return this._op('upsert',...a)}update(...a){return this._op('update',...a)}delete(...a){return this._op('delete',...a)}eq(...a){return this._op('eq',...a)}neq(...a){return this._op('neq',...a)}gt(...a){return this._op('gt',...a)}gte(...a){return this._op('gte',...a)}lt(...a){return this._op('lt',...a)}lte(...a){return this._op('lte',...a)}is(...a){return this._op('is',...a)}in(...a){return this._op('in',...a)}contains(...a){return this._op('contains',...a)}like(...a){return this._op('like',...a)}ilike(...a){return this._op('ilike',...a)}order(...a){return this._op('order',...a)}limit(...a){return this._op('limit',...a)}range(...a){return this._op('range',...a)}single(...a){return this._op('single',...a)}maybeSingle(...a){return this._op('maybeSingle',...a)}async _run(){if(this.isMutation||ADMIN.has(this.table))await ensureAdmin();const c=await rawClient();let q=c.from(this.table);for(const[n,a]of this.ops)q=q[n](...a);const r=await q;if(!r?.error&&this.secret){const sr=await c.rpc('set_tournament_password',{input_tournament_id:this.secret.id,input_password:String(this.secret.password??'')});if(sr?.error||sr?.data!==true)return{...r,error:sr?.error||{message:'Turnier-Passwort konnte nicht sicher gespeichert werden.'}}}return r}then(a,b){return this._run().then(a,b)}catch(a){return this._run().catch(a)}finally(a){return this._run().finally(a)}}
  const compat={from:t=>new Q(t),async rpc(n,a={}){if(n==='check_admin_code'){try{return{data:[await claimAdmin(a.input_code)],error:null}}catch(e){return{data:null,error:{message:e.message}}}}const c=await rawClient();return c.rpc(n,a)},channel(){const x={on(){return x},subscribe(cb){if(cb)setTimeout(()=>cb('CHANNEL_ERROR'),0);return x},unsubscribe(){return Promise.resolve()}};return x},removeChannel(){return Promise.resolve()}};
  window.phNeon={getClient:rawClient,ensureAdmin,isAdmin,claimAdmin,login:signInOrCreateAccount,logout:async()=>{const c=await rawClient();try{await c.auth.signOut()}catch{}adminReady=false},sessionStatus:async()=>({signedIn:await hasSession(),admin:await isAdmin()})};
  window.supabase={createClient(){return compat}};
})();