// PADEL HIRSCH — Neon compatibility layer
// Safe bridge for the existing Supabase-style frontend calls.
(() => {
  'use strict';

  const AUTH_URL = 'https://ep-rough-fog-awwpb54i.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth';
  const DATA_API_URL = 'https://ep-rough-fog-awwpb54i.apirest.c-12.us-east-1.aws.neon.tech/neondb/rest/v1';
  const MODULE_URL = 'https://esm.sh/@neondatabase/neon-js@0.6.2-beta?bundle';

  let rawClientPromise;
  let adminReady = false;

  async function rawClient() {
    if (!rawClientPromise) {
      rawClientPromise = import(MODULE_URL).then(({ createClient }) => createClient({
        auth: { url: AUTH_URL },
        dataApi: { url: DATA_API_URL }
      }, {
        auth: { allowAnonymous: true }
      }));
    }
    return rawClientPromise;
  }

  async function signInOrCreateAccount() {
    const client = await rawClient();
    const email = (window.prompt('Neon Admin E-Mail:') || '').trim();
    if (!email) throw new Error('Anmeldung abgebrochen.');
    const password = window.prompt('Neon Admin Passwort:') || '';
    if (!password) throw new Error('Anmeldung abgebrochen.');
    let result = await client.auth.signIn.email({ email, password });
    if (result?.error) {
      const create = window.confirm('Für diese E-Mail wurde keine gültige Anmeldung gefunden. Neues Neon-Admin-Konto anlegen?');
      if (!create) throw new Error(result.error.message || 'Anmeldung fehlgeschlagen.');
      result = await client.auth.signUp.email({ email, password, name: 'Padel Admin' });
    }
    if (result?.error) throw new Error(result.error.message || 'Neon Auth Anmeldung fehlgeschlagen.');
    return true;
  }

  async function hasSession() { try { const client=await rawClient(); const result=await client.auth.getSession(); return !!result?.data?.session; } catch (_) { return false; } }
  async function isAdmin() { try { const client=await rawClient(); const result=await client.rpc('app_is_admin'); adminReady=!result?.error&&result?.data===true; return adminReady; } catch (_) { adminReady=false; return false; } }
  async function ensureSignedIn(){ if(await hasSession()) return true; await signInOrCreateAccount(); return true; }
  async function claimAdmin(code){ code=(code||'').trim(); if(!code) throw new Error('Admin-Code fehlt.'); await ensureSignedIn(); const client=await rawClient(); const result=await client.rpc('check_admin_code',{input_code:code}); if(result?.error||!Array.isArray(result?.data)||result.data.length===0) throw new Error(result?.error?.message||'Ungültiger Admin-Code oder Konto bereits anders verknüpft.'); adminReady=true; return result.data[0]; }
  async function ensureAdmin(){ if(adminReady||await isAdmin()) return true; await ensureSignedIn(); if(await isAdmin()) return true; const code=window.prompt('Einmaliger Padel Admin-Code zur Verknüpfung:'); if(code===null) throw new Error('Änderung abgebrochen.'); const client=await rawClient(); const result=await client.rpc('check_admin_code',{input_code:code.trim()}); if(result?.error||!Array.isArray(result?.data)||result.data.length===0) throw new Error(result?.error?.message||'Admin-Verknüpfung fehlgeschlagen.'); adminReady=true; return true; }

  function removeSecrets(value){ if(Array.isArray(value)) return value.map(removeSecrets); if(!value||typeof value!=='object') return value; const out={}; for(const [key,val] of Object.entries(value)){ const k=key.toLowerCase(); if(k==='password'||k==='pw'||k==='admin_password'||k==='adminpassword') continue; out[key]=removeSecrets(val); } return out; }
  function findSecretRecord(value){ const rows=Array.isArray(value)?value:[value]; for(const row of rows){ if(!row||typeof row!=='object') continue; const data=row.data&&typeof row.data==='object'?row.data:{}; const hasPassword=Object.prototype.hasOwnProperty.call(data,'password')||Object.prototype.hasOwnProperty.call(data,'pw'); if(row.id&&hasPassword) return {id:String(row.id),password:Object.prototype.hasOwnProperty.call(data,'password')?(data.password??''):(data.pw??'')}; } return null; }

  const MUTATIONS=new Set(['insert','upsert','update','delete']);
  const ADMIN_ONLY_TABLES=new Set(['mex_admins','mex_players','mex_player_level_history','mex_player_latest_level','mex_tournaments','mex_tournament_access','mex_tournament_players']);
  class DeferredQuery{
    constructor(table){this.table=table;this.ops=[];this.isMutation=false;this.tournamentSecret=null;}
    _op(name,...args){ if(MUTATIONS.has(name)){this.isMutation=true;if(this.table==='tournaments'&&name!=='delete'){const secret=args.length?findSecretRecord(args[0]):null;if(secret)this.tournamentSecret=secret;args=args.map(removeSecrets);}} this.ops.push([name,args]); return this; }
    select(...a){return this._op('select',...a)} insert(...a){return this._op('insert',...a)} upsert(...a){return this._op('upsert',...a)} update(...a){return this._op('update',...a)} delete(...a){return this._op('delete',...a)} eq(...a){return this._op('eq',...a)} neq(...a){return this._op('neq',...a)} gt(...a){return this._op('gt',...a)} gte(...a){return this._op('gte',...a)} lt(...a){return this._op('lt',...a)} lte(...a){return this._op('lte',...a)} is(...a){return this._op('is',...a)} in(...a){return this._op('in',...a)} contains(...a){return this._op('contains',...a)} like(...a){return this._op('like',...a)} ilike(...a){return this._op('ilike',...a)} order(...a){return this._op('order',...a)} limit(...a){return this._op('limit',...a)} range(...a){return this._op('range',...a)} single(...a){return this._op('single',...a)} maybeSingle(...a){return this._op('maybeSingle',...a)}
    async _run(){ if(this.isMutation||ADMIN_ONLY_TABLES.has(this.table)) await ensureAdmin(); const client=await rawClient(); let q=client.from(this.table); for(const [name,args] of this.ops){ if(typeof q[name]!=='function') throw new Error(`Nicht unterstützte DB-Operation: ${name}`); q=q[name](...args); } const result=await q; if(!result?.error&&this.tournamentSecret){ const secretResult=await client.rpc('set_tournament_password',{input_tournament_id:this.tournamentSecret.id,input_password:String(this.tournamentSecret.password??'')}); if(secretResult?.error||secretResult?.data!==true) return {...result,error:secretResult?.error||{message:'Turnier-Passwort konnte nicht sicher gespeichert werden.'}}; } return result; }
    then(resolve,reject){return this._run().then(resolve,reject)} catch(reject){return this._run().catch(reject)} finally(cb){return this._run().finally(cb)}
  }
  const compatClient={from(table){return new DeferredQuery(table)},async rpc(name,args={}){if(name==='check_admin_code'){try{const admin=await claimAdmin(args.input_code);return{data:[admin],error:null}}catch(e){return{data:null,error:{message:e.message}}}}const client=await rawClient();return client.rpc(name,args);},channel(){const noop={on(){return noop},subscribe(cb){if(cb)setTimeout(()=>cb('CHANNEL_ERROR'),0);return noop},unsubscribe(){return Promise.resolve()}};return noop},removeChannel(){return Promise.resolve()}};
  window.phNeon={getClient:rawClient,ensureAdmin,isAdmin,claimAdmin,login:signInOrCreateAccount,logout:async()=>{const client=await rawClient();try{await client.auth.signOut()}catch(_){}adminReady=false}};
  window.supabase={createClient(){return compatClient}};
})();