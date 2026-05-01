/**
 * Handles wallet connect, SPL token staking, and on chain Anchor voting. i hope to upgrade to privy for seamless and multi wallets connect and also eliminate inapp connections 
 */

// Wallet Connection 

window.addEventListener('load', async () => {
  const provider = window.solana;
  if (provider && provider.isConnected && provider.publicKey) {
    await routeConnectedWallet(provider.publicKey.toString());
  }
});

async function connectWallet() {
  const provider = window.solana;
  if (!provider) {
    showToast('No Solana wallet found — install Phantom or any Solana wallet extension');
    setTimeout(() => window.open('https://phantom.app', '_blank'), 1400);
    return;
  }
  try {
    showToast('Approve in your wallet...');
    const resp   = await provider.connect({ onlyIfTrusted: false });
    const pubkey = resp.publicKey.toString();
    await routeConnectedWallet(pubkey);
  } catch (err) {
    if (err.code === 4001) {
      showToast('Rejected — please approve the connection in your wallet');
    } else {
      showToast('Could not connect: ' + (err.message || 'unknown error'));
    }
  }
}

async function routeConnectedWallet(pubkey) {
  state.wallet      = pubkey;
  state.walletShort = shortWallet(pubkey);
  try {
    const existing = await sb(
      `users?wallet_address=eq.${pubkey}&select=wallet_address,role,pusd_balance`
    );
    if (existing.length > 0) {
      state.role         = existing[0].role;
      state.hunterBalance = existing[0].pusd_balance || 0;
      showToast(`✓ Welcome back · ${pubkey.slice(0, 6)}...${pubkey.slice(-4)}`, true);
      setTimeout(() => {
        if (state.role === 'dao') goToDAO();
        else goToHunter();
      }, 600);
    } else {
      showToast(`✓ Connected · ${pubkey.slice(0, 6)}...${pubkey.slice(-4)}`, true);
      setTimeout(() => setScreen('screen-onboard'), 700);
    }
  } catch (e) {
    showToast('Connected but DB error: ' + e.message);
    setTimeout(() => setScreen('screen-onboard'), 700);
  }
}

// SPL Token Stake 

async function stakePUSD(amountUI) {
  if (!VAULT_ADDRESS || VAULT_ADDRESS.startsWith('PASTE')) {
    showToast(`⚠ Vault not set — skipping ${amountUI} PUSD stake for now`);
    await new Promise(r => setTimeout(r, 800));
    return 'dev-bypass';
  }

  if (typeof solanaWeb3 === 'undefined') {
    showToast('Solana library not loaded — please refresh the page');
    return null;
  }

  const { Connection, PublicKey, Transaction } = solanaWeb3;

  try {
    showToast(`Approve ${amountUI} PUSD stake in Phantom...`);
    const connection  = new Connection('https://api.devnet.solana.com', 'confirmed');
    const fromPubkey  = new PublicKey(state.wallet);
    const mintPubkey  = new PublicKey(PUSD_MINT);
    const vaultPubkey = new PublicKey(VAULT_ADDRESS);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      fromPubkey, { mint: mintPubkey }
    );
    if (!tokenAccounts.value.length) {
      showToast('No PUSD token account found — make sure you have PUSD on devnet');
      return null;
    }

    const fromATA      = tokenAccounts.value[0].pubkey;
    const fromBalance  = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;

    if (fromBalance < amountUI) {
      showToast(`Insufficient PUSD — need ${amountUI}, you have ${fromBalance.toFixed(2)}`);
      return null;
    }

    const vaultAccounts = await connection.getParsedTokenAccountsByOwner(
      vaultPubkey, { mint: mintPubkey }
    );
    if (!vaultAccounts.value.length) {
      showToast('Vault token account not found — send some PUSD to vault first');
      return null;
    }
    const toATA = vaultAccounts.value[0].pubkey;

    const decimals  = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.decimals;
    const amountRaw = Math.floor(amountUI * Math.pow(10, decimals));

    const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

    // Encode SPL transfer instruction (tag=3, u64 LE amount)
    const data = new Uint8Array(9);
    data[0] = 3;
    let amt = BigInt(amountRaw);
    for (let i = 0; i < 8; i++) {
      data[1 + i] = Number(amt & BigInt(0xff));
      amt >>= BigInt(8);
    }

    const transferIx = {
      programId: TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: fromATA,    isSigner: false, isWritable: true  },
        { pubkey: toATA,      isSigner: false, isWritable: true  },
        { pubkey: fromPubkey, isSigner: true,  isWritable: false },
      ],
      data,
    };

    const tx = new Transaction().add(transferIx);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = fromPubkey;

    const signed = await window.solana.signTransaction(tx);
    showToast('Sending transaction...');
    const sig = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    try {
      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight }, 'confirmed'
      );
    } catch (confirmErr) {
      const msg = confirmErr.message || '';
      if (!msg.includes('already been processed') && !msg.includes('already processed')) {
        throw confirmErr;
      }
    }

    showToast(`✓ ${amountUI} PUSD staked`, true);
    return sig;

  } catch (err) {
    const msg = err.message || '';
    if (err.code === 4001 || msg.includes('User rejected')) {
      showToast('Stake rejected — cancelled in wallet');
    } else if (msg.includes('already been processed') || msg.includes('already processed')) {
      showToast(`✓ ${amountUI} PUSD staked`, true);
      return 'already-processed';
    } else if (msg.includes('insufficient lamports') || msg.includes('insufficient funds')) {
      showToast('Insufficient SOL for fees — airdrop SOL on devnet first');
    } else {
      showToast('Stake failed: ' + msg);
      console.error('Stake error:', err);
    }
    return null;
  }
}

// Anchor On-Chain DAO Vote 

function chainSubmissionId(id) {
  return String(id).replaceAll('-', '').slice(0, 32);
}

function concatBytes(...arrays) {
  const len = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(len);
  let offset = 0;
  arrays.forEach(a => { out.set(a, offset); offset += a.length; });
  return out;
}

function encodeAnchorString(str) {
  const bytes = new TextEncoder().encode(str);
  const out   = new Uint8Array(4 + bytes.length);
  new DataView(out.buffer).setUint32(0, bytes.length, true);
  out.set(bytes, 4);
  return out;
}

async function anchorDiscriminator(ixName) {
  const bytes = new TextEncoder().encode(`global:${ixName}`);
  const hash  = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(hash).slice(0, 8);
}

async function castVoteOnChain(submissionId, vote) {
  if (typeof solanaWeb3 === 'undefined') {
    throw new Error('Solana web3 library not loaded');
  }

  const { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } = solanaWeb3;
  const connection  = new Connection('https://api.devnet.solana.com', 'confirmed');
  const programId   = new PublicKey(PALMSHIELD_PROGRAM_ID);
  const voter       = new PublicKey(state.wallet);
  const cleanId     = chainSubmissionId(submissionId);

  const [voteRecord] = PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode('vote'),
      voter.toBytes(),
      new TextEncoder().encode(cleanId),
    ],
    programId
  );

  const data = concatBytes(
    await anchorDiscriminator('cast_vote'),
    encodeAnchorString(cleanId),
    encodeAnchorString(vote)
  );

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: voteRecord,              isSigner: false, isWritable: true  },
      { pubkey: voter,                   isSigner: true,  isWritable: true  },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx     = new Transaction().add(ix);
  const latest = await connection.getLatestBlockhash();
  tx.recentBlockhash = latest.blockhash;
  tx.feePayer        = voter;

  const signed = await window.solana.signTransaction(tx);
  const sig    = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight:        false,
    preflightCommitment: 'confirmed',
  });

  await connection.confirmTransaction(
    { signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
    'confirmed'
  );

  return sig;
}

//  Wallet Menu Utilities

function toggleWalletMenu(menuId) {
  const menu   = document.getElementById(menuId);
  const isOpen = menu.classList.contains('open');
  document.querySelectorAll('.wallet-menu').forEach(m => m.classList.remove('open'));
  if (!isOpen) menu.classList.add('open');
}

document.addEventListener('click', e => {
  if (!e.target.closest('.nav-wallet-wrap')) {
    document.querySelectorAll('.wallet-menu').forEach(m => m.classList.remove('open'));
  }
});

function copyWallet() {
  if (!state.wallet) return;
  navigator.clipboard.writeText(state.wallet)
    .then(() => showToast('✓ Address copied', true))
    .catch(() => showToast('Copy failed — try manually'));
  document.querySelectorAll('.wallet-menu').forEach(m => m.classList.remove('open'));
}

function openExplorer() {
  if (!state.wallet) return;
  window.open(`https://solscan.io/account/${state.wallet}?cluster=devnet`, '_blank');
  document.querySelectorAll('.wallet-menu').forEach(m => m.classList.remove('open'));
}

async function disconnect() {
  document.querySelectorAll('.wallet-menu').forEach(m => m.classList.remove('open'));
  try { if (window.solana?.disconnect) await window.solana.disconnect(); } catch (e) {}

  Object.assign(state, {
    wallet:         null,
    walletShort:    null,
    role:           null,
    submissions:    [],
    myVotes:        {},
    hunterBalance:  0,
    selectedThreat: null,
    uploadedFile:   null,
    uploadedImage:  null,
  });
  _realtimeStarted = false;

  ['hunter', 'dao', 'both'].forEach(r => {
    const el = document.getElementById('rc-' + r);
    if (el) el.className = 'role-card';
  });

  const jb = document.getElementById('join-btn');
  if (jb) { jb.textContent = 'Join PalmShield →'; jb.disabled = true; }

  showToast('Disconnected');
  setTimeout(() => setScreen('screen-connect'), 400);
}
