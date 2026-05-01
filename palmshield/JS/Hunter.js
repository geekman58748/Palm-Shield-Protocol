/**
 * Submit hunt, my hunts tab, leaderboard, realtime polling.
 */

let _realtimeStarted = false;

//Dashboard Init

async function goToHunter() {
  setScreen('screen-hunter');
  document.getElementById('hunter-wallet-display').textContent = state.walletShort;
  document.getElementById('hunter-wallet-full').textContent    = state.wallet || '';

  if (state.role === 'both') {
    document.getElementById('hunter-role-badge').textContent  = 'HUNTER + DAO';
    document.getElementById('hunter-role-badge').className    = 'nav-role-badge role-both';
    document.getElementById('hunter-dash-switch').style.display = 'flex';
  } else {
    document.getElementById('hunter-role-badge').textContent  = 'HUNTER';
    document.getElementById('hunter-role-badge').className    = 'nav-role-badge role-hunter';
    document.getElementById('hunter-dash-switch').style.display = 'none';
  }

  await loadSubmissions();
  await loadHunterBalance();
  renderMyHunts();
  renderLeaderboard();
  updateSidebarCounts();
  startRealtime();
}

function goHome() {
  if (state.role === 'dao') goToDAO();
  else goToHunter();
}

function updateHunterBalance() {
  document.getElementById('hunter-balance').textContent = state.hunterBalance.toLocaleString();
}

function updateSidebarCounts() {
  const mine      = state.submissions.filter(s => s.submitterWalletFull === state.wallet);
  const confirmed = mine.filter(s => s.status === 'confirmed').length;
  document.getElementById('sb-hunt-count').textContent = mine.length;
  document.getElementById('sb-active').textContent     = mine.filter(s => s.status === 'pending').length;
  document.getElementById('sb-confirmed').textContent  = confirmed;
}

//Tab Switching 

function switchHunterTab(tab, btn, from) {
  ['submit', 'my-hunts', 'leaderboard'].forEach(t => hide('htab-' + t));
  show('htab-' + tab);

  if (!from) {
    document.querySelectorAll('#screen-hunter .nav-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }

  document.querySelectorAll('#screen-hunter .sidebar-item').forEach(i => i.classList.remove('active'));
  if (from === 'sidebar') event.currentTarget.classList.add('active');

  if (tab === 'my-hunts')    renderMyHunts();
  if (tab === 'leaderboard') renderLeaderboard();
}

// Submit Hunt 
function selectThreat(el, type, bounty) {
  document.querySelectorAll('.threat-opt').forEach(o => o.classList.remove('sel'));
  el.classList.add('sel');
  state.selectedThreat = type;
  state.bountyAmt      = bounty;
  document.getElementById('bounty-display').textContent = bounty + ' PUSD';
}

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  state.uploadedFile = file;

  const reader = new FileReader();
  reader.onload = ev => {
    state.uploadedImage = ev.target.result;
    const preview = document.getElementById('upload-preview');
    preview.src           = ev.target.result;
    preview.style.display = 'block';
    document.querySelector('.upload-zone .upload-icon').textContent = '✓';
    document.querySelector('.upload-zone .upload-text').innerHTML   =
      file.name + '<br/><span style="opacity:.5">Click to change</span>';
  };
  reader.readAsDataURL(file);
}

let _submitting = false;

async function submitHunt() {
  if (_submitting) return;
  const wallet = document.getElementById('sub-wallet').value.trim();
  const remark = document.getElementById('sub-remark').value.trim();

  if (!wallet)               { showToast('⚠ Paste the target wallet address'); return; }
  if (!state.selectedThreat) { showToast('⚠ Select a threat type');            return; }
  if (!remark)               { showToast('⚠ Add your evidence / observation');  return; }

  _submitting = true;
  const btn = document.querySelector('.btn-submit');
  btn.textContent = `Staking ${STAKE_SUBMIT} PUSD...`;
  btn.disabled    = true;

  const stakeSig = await stakePUSD(STAKE_SUBMIT);
  if (!stakeSig) {
    btn.textContent = 'Submit to DAO →';
    btn.disabled    = false;
    _submitting     = false;
    return;
  }

  btn.textContent = 'Submitting...';

  try {
    let imageUrl = null;
    if (state.uploadedFile) {
      imageUrl = await uploadEvidence(state.uploadedFile, state.wallet);
      if (!imageUrl) showToast('⚠ Image upload failed — submitting without image');
    }

    const si = getSeverityInfo(state.selectedThreat);
    await sb('submissions', {
      method: 'POST',
      body: JSON.stringify({
        submitter_wallet: state.wallet,
        target_wallet:    wallet,
        threat_type:      state.selectedThreat,
        remark,
        image_url:        imageUrl,
        bounty:           state.bountyAmt,
        severity:         si.sev,
        status:           'pending',
        confirm_votes:    0,
        deny_votes:       0,
        stake_tx:         stakeSig === true ? null : stakeSig,
      }),
    });

    showToast('✓ Submitted! DAO review starts shortly.', true);
    _resetSubmitForm();
    await loadSubmissions();
    renderDAOFeed();
    renderMyHunts();
    updateDaoPendingCount();
    updateSidebarCounts();

  } catch (e) {
    showToast('Submit failed: ' + e.message);
  } finally {
    btn.textContent = 'Submit to DAO →';
    btn.disabled    = false;
    _submitting     = false;
  }
}

function _resetSubmitForm() {
  document.getElementById('sub-wallet').value = '';
  document.getElementById('sub-remark').value = '';
  document.querySelectorAll('.threat-opt').forEach(o => o.classList.remove('sel'));
  document.getElementById('bounty-display').textContent    = '250 PUSD';
  document.getElementById('upload-preview').style.display  = 'none';
  document.querySelector('.upload-zone .upload-icon').textContent = '📎';
  document.querySelector('.upload-zone .upload-text').innerHTML   =
    'Click to upload or drag & drop<br/><span style="opacity:.5">PNG, JPG, WEBP · max 5MB</span>';
  state.selectedThreat = null;
  state.uploadedFile   = null;
  state.uploadedImage  = null;
}

// ── Render: My Hunts ────────────────────────────────────────

function renderMyHunts() {
  const feed = document.getElementById('my-hunts-feed');
  const mine = state.submissions.filter(s => s.submitterWalletFull === state.wallet);
  feed.innerHTML = '';

  if (!mine.length) {
    feed.innerHTML = `<div class="empty">
      <div class="empty-icon">🎯</div>
      <div class="empty-title">No hunts yet</div>
      <div class="empty-desc">Submit your first threat report to get started.<br/>Confirmed hunts pay out instantly in PUSD.</div>
    </div>`;
    return;
  }

  mine.forEach(s => feed.appendChild(renderSubmissionCard(s, 'hunter')));

  const confirmed = mine.filter(s => s.status === 'confirmed').length;
  const earned    = mine.filter(s => s.status === 'confirmed').reduce((a, s) => a + s.bounty, 0);

  document.getElementById('h-total').textContent = mine.length;
  document.getElementById('h-conf').textContent  = confirmed;
  document.getElementById('h-earned').textContent = earned + ' PUSD';
  if (earned > 0) document.getElementById('h-earned-delta').textContent = '↑ Paid out to wallet';
}

//Render: Leaderboard 

async function renderLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  list.innerHTML = '<div style="font-family:var(--mono);font-size:10px;color:var(--muted);padding:12px">Loading...</div>';

  try {
    const rows = await sb('users?select=wallet_address,pusd_balance,role&order=pusd_balance.desc&limit=10');
    list.innerHTML = '';

    if (!rows.length) {
      list.innerHTML = '<div style="font-family:var(--mono);font-size:10px;color:var(--muted);padding:12px">No hunters yet — be the first.</div>';
      return;
    }

    rows.forEach((h, i) => {
      const short    = shortWallet(h.wallet_address);
      const isMe     = h.wallet_address === state.wallet;
      const myHunts  = state.submissions.filter(s => s.submitterWalletFull === h.wallet_address).length;
      const div      = document.createElement('div');
      div.className  = 'lb-row';
      div.innerHTML  = `
        <span class="lb-rank${i === 0 ? ' gold' : ''}">#${i + 1}</span>
        <span class="lb-wallet">${short}${isMe ? ' <span style="color:var(--green);font-size:9px">(you)</span>' : ''}</span>
        <span class="lb-hunts">${myHunts} hunts</span>
        <span class="lb-earned">${(h.pusd_balance || 0).toLocaleString()} PUSD</span>`;
      list.appendChild(div);
    });
  } catch (e) {
    list.innerHTML = '<div style="font-family:var(--mono);font-size:10px;color:var(--muted);padding:12px">Could not load leaderboard.</div>';
  }
}

// Realtime Polling

function startRealtime() {
  if (_realtimeStarted) return;
  _realtimeStarted = true;

  setInterval(async () => {
    await loadSubmissions();
    await loadMyVotes();
    const hunterActive = document.getElementById('screen-hunter').classList.contains('active');
    const daoActive    = document.getElementById('screen-dao').classList.contains('active');
    if (hunterActive) { renderMyHunts(); updateSidebarCounts(); }
    if (daoActive)    { renderDAOFeed(); updateDaoPendingCount(); }
  }, 8000);
}
