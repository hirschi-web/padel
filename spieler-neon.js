// Secure Neon login shim for spieler.html
window.init = async function initNeonPlayerAdmin() {
  const qs = new URLSearchParams(window.location.search);
  let code = qs.get('code') || '';

  try {
    if (!code) code = window.prompt('Admin-Code:') || '';
    if (!code) { showAccessDenied(); return; }

    const admin = await window.phNeon.claimAdmin(code);
    currentAdmin = admin;

    // Do not persist the admin code; remove legacy ?code= links from the bar.
    if (qs.has('code')) {
      qs.delete('code');
      const q = qs.toString();
      history.replaceState(null, '', window.location.pathname + (q ? '?' + q : '') + window.location.hash);
    }
    sessionStorage.removeItem('ph_admin_code');

    document.getElementById('adminNameLabel').textContent = currentAdmin.name;
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('accessDenied').classList.add('hidden');

    await loadPlayers();
    await loadActiveAdmins();
    renderPlayerList();
  } catch (e) {
    console.error(e);
    showAccessDenied();
  }
};

window.logout = async function logoutNeonPlayerAdmin() {
  sessionStorage.removeItem('ph_admin_code');
  try { await window.phNeon.logout(); } catch (_) {}
  window.location.href = window.location.pathname;
};

window.init();