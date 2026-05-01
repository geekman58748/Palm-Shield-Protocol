/**
Role selection and protocol join flow.
 */

function selectRole(role) {
  state.role = role;
  ['hunter', 'dao', 'both'].forEach(r => {
    document.getElementById('rc-' + r).className = 'role-card';
  });
  document.getElementById('rc-' + role).className = 'role-card selected-' + role;
  document.getElementById('join-btn').disabled = false;
}

async function joinProtocol() {
  if (!state.role) return;
  const btn = document.getElementById('join-btn');
  btn.textContent = 'Registering...';
  btn.disabled = true;

  try {
    await sb('users', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: JSON.stringify({
        wallet_address: state.wallet,
        role:           state.role,
        pusd_balance:   0,
      }),
    });
    showToast('✓ Welcome to PalmShield!', true);
    setTimeout(() => {
      if (state.role === 'dao') goToDAO();
      else goToHunter();
    }, 600);
  } catch (e) {
    showToast('Error saving role: ' + e.message);
    btn.textContent = 'Join PalmShield →';
    btn.disabled = false;
  }
}
