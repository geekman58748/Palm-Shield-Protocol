/**
DAO Dashboard
 * Review queue, voting, history, payout trigger.
 */

//Dashboard Init 

async function goToDAO() {
  setScreen('screen-dao');
  document.getElementById('dao-wallet-display').textContent = state.walletShort;
  document.getElementById('dao-wallet-full').textContent    = state.wallet || '';

  if (state.role === 'both') {
    document.getElementById('dao-role-badge').textContent  = 'HUNTER + DAO';
    document.getElementById('dao-role-badge').className    = 'nav-role-badge role-both';
    document.getElementById('dao-dash-switch').style.display = 'flex';
  }

  document.getElementById('dao-feed').innerHTML = `<div class="empty">
    <div class="empty-icon" style="animation:pulse 1.5s infinite">⏳</div>
    <div class="empty-title">Loading submissions...</div>
  </div>`;

  await loadSubmissions();
  await loadMyVotes();
  renderDAOFeed();
  updateDaoPendingCount();
  startRealtime();
}

function updateDaoPendingCount() {
  const n = state.submissions.filter(s => s.status === 'pending').length;
  document.getElementById('dao-pending-count').textContent = n;
}

//Tab Switching

function switchDaoTab(tab, btn, from) {
  ['review', 'history'].forEach(t => hide('dtab-' + t));
  show('dtab-' + tab);

  if (!from) {
    document.querySelectorAll('#screen-dao .nav-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }

  if (tab === 'review')  renderDAOFeed();
  if (tab === 'history') renderDaoHistory();
}

//Render: DAO Feed 

function renderDAOFeed() {
  const feed      = document.getElementById('dao-feed');
  const pending   = state.submissions.filter(s => s.status === 'pending');
  const confirmed = state.submissions.filter(s => s.status === 'confirmed');

  const ps = document.getElementById('dao-stat-pending');
  const cs = document.getElementById('dao-stat-confirmed');
  if (ps) ps.textContent = pending.length;
  if (cs) cs.textContent = confirmed.length;

  feed.innerHTML = '';

  if (!state.submissions.length) {
    feed.innerHTML = `<div class="empty">
      <div class="empty-icon">🏛️</div>
      <div class="empty-title">No submissions yet</div>
      <div class="empty-desc">When hunters submit threat reports they'll appear here.</div>
    </div>`;
    return;
  }

  if (!pending.length) {
    feed.innerHTML = `<div class="empty">
      <div class="empty-icon">✅</div>
      <div class="empty-title">All caught up</div>
      <div class="empty-desc">No pending submissions right now. Check back soon.</div>
    </div>`;
    return;
  }

  pending.forEach(s => feed.appendChild(renderSubmissionCard(s, 'dao')));
  document.getElementById('dao-pending-count').textContent = pending.length;
}

// Render: Vote History 

function renderDaoHistory() {
  const feed  = document.getElementById('dao-history-feed');
  const voted = Object.keys(state.myVotes);

  if (!voted.length) {
    feed.innerHTML = `<div class="empty">
      <div class="empty-icon">🗳️</div>
      <div class="empty-title">No votes cast yet</div>
      <div class="empty-desc">Your voting history will appear here.</div>
    </div>`;
    return;
  }

  feed.innerHTML = '';
  voted.forEach(id => {
    const sub  = state.submissions.find(s => s.id === id);
    if (!sub) return;
    const vote = state.myVotes[id];
    const div  = document.createElement('div');
    div.className = 'submission';
    div.onclick   = () => openModal(id);
    div.innerHTML = `
      <div class="sub-stripe ${vote === 'confirm' ? 'stripe-review' : 'stripe-critical'}"></div>
      <div class="sub-body">
        <div class="sub-top">
          <div>
            <div class="sub-addr">${sub.targetWallet.slice(0, 8)}...${sub.targetWallet.slice(-6)}</div>
            <div class="sub-by">${sub.threatType} · ${sub.time}</div>
          </div>
          <span class="badge ${vote === 'confirm' ? 'badge-confirmed' : 'badge-critical'}">
            ${vote === 'confirm' ? '✓ Confirmed' : '✕ Denied'}
          </span>
        </div>
        <div style="font-family:var(--mono);font-size:10px;color:var(--muted)">
          Outcome: <strong style="color:${sub.status === 'confirmed' ? 'var(--green)' : 'var(--muted)'}">${sub.status}</strong>
        </div>
      </div>`;
    feed.appendChild(div);
  });
}

//Voting 

async function quickVote(id, dir, btn) {
  if (state.myVotes[id]) { showToast('Already voted on this submission'); return; }
  btn.disabled = true;
  try {
    await castVoteDB(id, dir);
    showToast(dir === 'confirm' ? '✓ Voted to confirm' : '✕ Voted to deny', dir === 'confirm');
    await loadSubmissions();
    await loadMyVotes();
    renderDAOFeed();
    renderDaoHistory();
    updateDaoPendingCount();
  } catch (e) {
    if (e.message !== 'Stake cancelled') showToast('Vote failed: ' + e.message);
    btn.disabled = false;
  }
}

async function castVoteDB(submissionId, dir) {
  // Step 1: SPL token stake
  const stakeSig = await stakePUSD(STAKE_VOTE);
  if (!stakeSig) throw new Error('Stake cancelled');

  // Step 2: on-chain Anchor vote
  showToast('Approve on-chain DAO vote in Phantom...');
  const chainVoteSig = await castVoteOnChain(submissionId, dir);

  // Step 3: persist to Supabase
  await sb('votes', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify({
      submission_id: submissionId,
      voter_wallet:  state.wallet,
      vote:          dir,
      stake_tx:      stakeSig === true ? null : stakeSig,
    }),
  });

  state.myVotes[submissionId] = dir;

  const sub = state.submissions.find(s => s.id === submissionId);
  if (sub) {
    if (dir === 'confirm') sub.confirms++;
    else sub.denies++;

    await sb(`submissions?id=eq.${submissionId}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: JSON.stringify({
        confirm_votes: sub.confirms,
        deny_votes:    sub.denies,
      }),
    });

    await checkQuorumDB(sub);
  }

  showToast(`✓ Vote stored on-chain: ${chainVoteSig.slice(0, 8)}...`, true);
}

async function checkQuorumDB(sub) {
  const total = sub.confirms + sub.denies;
  const pct   = total ? sub.confirms / total : 0;

  if (total >= QUORUM_VOTES && pct >= QUORUM_PCT && sub.status === 'pending') {
    await sb(`submissions?id=eq.${sub.id}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: JSON.stringify({ status: 'confirmed' }),
    });
    sub.status = 'confirmed';
    await triggerPayout(sub);
  }
}

async function triggerPayout(sub) {
  try {
    const voteRows     = await sb(`votes?submission_id=eq.${sub.id}&select=voter_wallet`);
    const voterWallets = voteRows.map(v => v.voter_wallet);

    const res = await fetch(
      'https://iffyvycwlhgnsqotlckv.supabase.co/functions/v1/payout',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          submissionId:  sub.id,
          hunterWallet:  sub.submitterWalletFull,
          voterWallets,
          bounty:        sub.bounty,
        }),
      }
    );

    const result = await res.json();
    if (!result.success) throw new Error(result.error);

    await sb('payouts', {
      method: 'POST',
      prefer: 'return=minimal',
      body: JSON.stringify({
        submission_id:  sub.id,
        hunter_wallet:  sub.submitterWalletFull,
        amount:         sub.bounty,
        tx_signature:   result.sig,
      }),
    });

    if (sub.submitterWalletFull === state.wallet) {
      state.hunterBalance += sub.bounty + 100;
      updateHunterBalance();
      setTimeout(() => showToast(`🎉 ${sub.bounty + 100} PUSD sent to your wallet!`, true), 500);
    } else {
      setTimeout(() => showToast('✓ Quorum! Bounty + stakes refunded on-chain', true), 500);
    }

  } catch (e) {
    console.error('Payout error:', e);
    setTimeout(() => showToast('✓ Threat confirmed — payout error: ' + e.message), 500);
  }

  renderMyHunts();
  updateSidebarCounts();
}
