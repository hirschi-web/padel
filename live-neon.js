// Neon-specific live-page guard. Public viewing remains anonymous; editing does not.
window.toggleEdit = async function toggleEditNeon() {
  if (!isEditing) {
    try {
      await window.phNeon.ensureAdmin();
      isEditing = true;
      sessionStorage.removeItem('isAdmin_' + tournamentId);
      document.getElementById('editToggle').innerText = '✏️ Bearbeiten';
      renderAll();
    } catch (e) {
      showToast('🔒 Bearbeiten nur für Admins', 'warning');
    }
  } else {
    isEditing = false;
    document.getElementById('editToggle').innerText = '🔒 Bearbeiten';
    renderAll();
  }
};

if (typeof window.__legacyLiveInit === 'function') window.__legacyLiveInit();