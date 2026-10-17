window.init = function () {};
(async function () {
  'use strict';
  async function load(src) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(src + ' konnte nicht geladen werden'));
      document.head.appendChild(s);
    });
  }

  // Independent status/login button; does not touch forms, schedules or saving.
  let connectionButton, connectionBusy = false;
  function paintConnection(text, color, title) {
    if (!connectionButton) return;
    connectionButton.textContent = text;
    connectionButton.style.color = color;
    connectionButton.title = title || text;
    connectionButton.setAttribute('aria-label', title || text);
  }
  function installConnectionButton() {
    const select = document.getElementById('tournamentSelect');
    if (!select || document.getElementById('dbConnectionBtn')) return;
    connectionButton = document.createElement('button');
    connectionButton.id = 'dbConnectionBtn';
    connectionButton.type = 'button';
    connectionButton.style.cssText = 'font:600 12px Arial,sans-serif;padding:9px 12px;min-height:40px;border:1.5px solid #cbd5e1;border-radius:10px;background:#f8fafc;cursor:pointer;max-width:240px;white-space:normal;text-align:left;';
    select.insertAdjacentElement('afterend', connectionButton);
    select.parentElement.style.flexWrap = 'wrap';
    paintConnection('Verbindung prüfen', '#64748b');
    connectionButton.addEventListener('click', () => checkConnection(true));
  }
  async function checkConnection(allowLogin = false) {
    if (connectionBusy || !connectionButton) return;
    connectionBusy = true;
    connectionButton.disabled = true;
    paintConnection('Verbindung wird geprüft …', '#64748b');
    let timeout;
    try {
      const result = await Promise.race([
        (async () => {
          if (!window.phNeon) throw new Error('Verbindung wird noch geladen. Bitte erneut versuchen.');
          const client = await window.phNeon.getClient();
          const session = await client.auth.getSession();
          if (session?.error) throw new Error(session.error.message || 'Anmeldung konnte nicht geprüft werden.');
          const read = await client.from('tournaments').select('id').limit(1);
          if (read?.error) throw new Error(read.error.message || 'Datenbank nicht erreichbar.');
          const signedIn = !!session?.data?.session;
          let admin = false;
          if (signedIn) {
            const permission = await client.rpc('app_is_admin');
            if (permission?.error) throw new Error(permission.error.message || 'Berechtigung konnte nicht geprüft werden.');
            admin = permission?.data === true;
          }
          return {signedIn, admin, email: session?.data?.user?.email || session?.data?.session?.user?.email || ''};
        })(),
        new Promise((_, reject) => {timeout = setTimeout(() => reject(new Error('Zeitüberschreitung. Bitte Verbindung erneut prüfen.')), 12000);})
      ]);
      if (!result.signedIn) {
        if (allowLogin) {
          paintConnection('Google-Anmeldung wird geöffnet …', '#d97706');
          await window.phNeon.login();
        } else paintConnection('Mit Google anmelden', '#d97706', 'Datenbank erreichbar · Nicht angemeldet · Mit Google anmelden');
      } else if (result.admin) {
        paintConnection('● Verbunden', '#15803d', 'Datenbank erreichbar · ' + result.email + ' · Admin-Berechtigung bestätigt. Klicken zum erneuten Prüfen.');
      } else {
        paintConnection('Keine Schreibberechtigung', '#d97706', 'Angemeldet als ' + result.email + ' · Keine Admin-Berechtigung. Klicken für Google-Anmeldung.');
        if (allowLogin) await window.phNeon.login();
      }
    } catch (e) {
      paintConnection('Verbindung prüfen · Fehler', '#dc2626', e.message || 'Verbindung fehlgeschlagen.');
    } finally {
      clearTimeout(timeout);
      connectionBusy = false;
      connectionButton.disabled = false;
    }
  }

  async function boot() {
    installConnectionButton();
    await load('/padel/padel-api-prod.js?v=20260907-2');
    checkConnection(false);
    const client = await window.phNeon.getClient();
    const direct = await client.from('tournaments').select('id,data').order('id', { ascending: true });
    if (direct?.error) throw new Error(direct.error.message || 'Turniere konnten nicht geladen werden');
    const sel = document.getElementById('tournamentSelect');
    if (!sel) throw new Error('tournamentSelect fehlt');
    while (sel.options.length > 1) sel.remove(1);
    (direct.data || []).filter(t => t.id !== 'LIVE_CONFIG').forEach(t => sel.add(new Option(t.id, t.id)));
    await load('/padel/setup-functions.js?v=20261016-1');
    await window.init();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot().catch(console.error), { once: true });
  else boot().catch(console.error);
})();