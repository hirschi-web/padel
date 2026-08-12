// PADEL HIRSCH — Neon compatibility layer
// Replaces Supabase data access without exposing database credentials.
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

  async function sha256Hex(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function authenticateAdmin(code) {
    code = (code || '').trim();
    if (!code) throw new Error('Admin-Code fehlt.');

    const client = await rawClient();
    const hash = await sha256Hex(code);
    const email = `padel-${hash.slice(0, 24)}@example.com`;
    const password = `PH!${code}#2026`;

    let result = await client.auth.signIn.email({ email, password });
    if (result?.error) {
      result = await client.auth.signUp.email({ email, password, name: 'Padel Admin' });
    }
    if (result?.error) throw new Error(result.error.message || 'Anmeldung fehlgeschlagen.');

    const claim = await client.rpc('check_admin_code', { input_code: code });
    if (claim?.error || !claim?.data?.length) {
      try { await client.auth.signOut(); } catch (_) {}
      throw new Error('Ungültiger oder bereits anders verknüpfter Admin-Code.');
    }

    sessionStorage.setItem('ph_admin_code', code);
    adminReady = true;
    return claim.data[0];
  }

  async function ensureAdmin() {
    if (adminReady) return true;
    let code = sessionStorage.getItem('ph_admin_code') || '';
    if (!code) code = window.prompt('Admin-Code für Änderungen:') || '';
    if (!code) throw new Error('Änderung abgebrochen: kein Admin-Code.');
    await authenticateAdmin(code);
    return true;
  }

  const MUTATIONS = new Set(['insert', 'upsert', 'update', 'delete']);

  class DeferredQuery {
    constructor(table) {
      this.table = table;
      this.ops = [];
      this.isMutation = false;
    }
    _op(name, ...args) {
      if (MUTATIONS.has(name)) this.isMutation = true;
      this.ops.push([name, args]);
      return this;
    }
    select(...a){ return this._op('select', ...a); }
    insert(...a){ return this._op('insert', ...a); }
    upsert(...a){ return this._op('upsert', ...a); }
    update(...a){ return this._op('update', ...a); }
    delete(...a){ return this._op('delete', ...a); }
    eq(...a){ return this._op('eq', ...a); }
    neq(...a){ return this._op('neq', ...a); }
    gt(...a){ return this._op('gt', ...a); }
    gte(...a){ return this._op('gte', ...a); }
    lt(...a){ return this._op('lt', ...a); }
    lte(...a){ return this._op('lte', ...a); }
    is(...a){ return this._op('is', ...a); }
    in(...a){ return this._op('in', ...a); }
    contains(...a){ return this._op('contains', ...a); }
    like(...a){ return this._op('like', ...a); }
    ilike(...a){ return this._op('ilike', ...a); }
    order(...a){ return this._op('order', ...a); }
    limit(...a){ return this._op('limit', ...a); }
    range(...a){ return this._op('range', ...a); }
    single(...a){ return this._op('single', ...a); }
    maybeSingle(...a){ return this._op('maybeSingle', ...a); }

    async _run() {
      if (this.isMutation) await ensureAdmin();
      const client = await rawClient();
      let q = client.from(this.table);
      for (const [name, args] of this.ops) {
        if (typeof q[name] !== 'function') throw new Error(`Nicht unterstützte DB-Operation: ${name}`);
        q = q[name](...args);
      }
      return await q;
    }
    then(resolve, reject) { return this._run().then(resolve, reject); }
    catch(reject) { return this._run().catch(reject); }
    finally(cb) { return this._run().finally(cb); }
  }

  const compatClient = {
    from(table) { return new DeferredQuery(table); },
    async rpc(name, args = {}) {
      if (name === 'check_admin_code') {
        try {
          const admin = await authenticateAdmin(args.input_code);
          return { data: [admin], error: null };
        } catch (e) {
          return { data: null, error: { message: e.message } };
        }
      }
      const client = await rawClient();
      return client.rpc(name, args);
    },
    channel() {
      const noop = {
        on() { return noop; },
        subscribe(cb) { if (cb) setTimeout(() => cb('CHANNEL_ERROR'), 0); return noop; },
        unsubscribe() { return Promise.resolve(); }
      };
      return noop;
    },
    removeChannel() { return Promise.resolve(); }
  };

  window.phNeon = {
    ensureAdmin,
    authenticateAdmin,
    getClient: rawClient,
    logout: async () => {
      const client = await rawClient();
      try { await client.auth.signOut(); } catch (_) {}
      sessionStorage.removeItem('ph_admin_code');
      adminReady = false;
    }
  };

  // Existing application files call supabase.createClient(...).
  // Keep that API shape, but ignore the legacy Supabase URL/key completely.
  window.supabase = {
    createClient() { return compatClient; }
  };
})();