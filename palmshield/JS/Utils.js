function showToast(msg, green = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast on' + (green ? ' toast-green' : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.className = 'toast', 3200);
}

function show(id) { document.getElementById(id).style.display = 'block'; }
function hide(id) { document.getElementById(id).style.display = 'none'; }

function setScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.scrollTop = 0;
  });
  const el = document.getElementById(id);
  el.classList.add('active');
  el.scrollTop = 0;
}

function shortWallet(w) {
  return w.slice(0, 4) + '...' + w.slice(-4);
}

function getSeverityInfo(type) {
  const map = {
    'Drain Bot':   { sev: 'critical', badge: 'badge-critical', stripe: 'stripe-critical' },
    'Rug Pull':    { sev: 'critical', badge: 'badge-critical', stripe: 'stripe-critical' },
    'Phishing':    { sev: 'high',     badge: 'badge-high',     stripe: 'stripe-high'     },
    'Scam':        { sev: 'high',     badge: 'badge-high',     stripe: 'stripe-high'     },
    'Wash Trade':  { sev: 'review',   badge: 'badge-review',   stripe: 'stripe-review'   },
    'Other':       { sev: 'review',   badge: 'badge-review',   stripe: 'stripe-review'   },
  };
  return map[type] || { sev: 'review', badge: 'badge-review', stripe: 'stripe-review' };
}

function timeAgo(iso) {
  if (!iso) return 'just now';
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

function normalizeRow(r) {
  return {
    id:                  r.id,
    submitterWallet:     shortWallet(r.submitter_wallet || '????????????????????'),
    submitterWalletFull: r.submitter_wallet,
    targetWallet:        r.target_wallet,
    threatType:          r.threat_type,
    remark:              r.remark,
    image:               r.image_url || null,
    bounty:              r.bounty,
    status:              r.status,
    confirms:            r.confirm_votes || 0,
    denies:              r.deny_votes || 0,
    severity:            r.severity || 'review',
    time:                timeAgo(r.created_at),
    comments: (r.comments || []).map(c => ({
      by:   shortWallet(c.author_wallet || '????????????????????'),
      time: timeAgo(c.created_at),
      text: c.text,
    })),
  };
}
