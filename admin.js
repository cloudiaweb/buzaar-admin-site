const SUPABASE_URL = 'https://cnnupclaojcholctijln.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GaxrD9HP5NVx7zCmMjylBw_Y24O9qze';

let _db = null;

function getDb() {
  if (!_db) _db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _db;
}

async function requireAdmin() {
  const db = getDb();

  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) {
    window.location.href = './index.html?err=no_session';
    return null;
  }

  const { data: profile } = await db
    .from('profiles')
    .select('id, display_name, is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    await db.auth.signOut();
    window.location.href = './index.html?err=not_admin&uid=' + user.id;
    return null;
  }
  return { user, profile };
}

async function renderNavWithBadges(active) {
  const db = getDb();
  const [
    { count: pendingOrg },
    { count: openReports },
    { count: unresolvedAlerts },
  ] = await Promise.all([
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('organizer_status', 'pending'),
    db.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('monitoring_alerts').select('*', { count: 'exact', head: true }).eq('resolved', false),
  ]);
  renderNav(active, {
    organizers: pendingOrg   || undefined,
    reports:    openReports  || undefined,
    monitoring: unresolvedAlerts || undefined,
  });
}

function renderNav(active, badges = {}) {
  const pages = [
    { href: './dashboard.html',     label: 'Dashboard',   key: 'dashboard' },
    { href: './organizers.html',    label: 'Organizers',  key: 'organizers',   badge: badges.organizers },
    { href: './users.html',         label: 'Users',       key: 'users' },
    { href: './bounties.html',      label: 'Chases',      key: 'bounties' },
    { href: './reports.html',       label: 'Reports',     key: 'reports',      badge: badges.reports },
    { href: './notifications.html', label: 'Notify',      key: 'notifications' },
    { href: './monitoring.html',    label: 'Monitoring',  key: 'monitoring',   badge: badges.monitoring },
  ];

  const nav = document.getElementById('nav');
  if (!nav) return;

  nav.innerHTML = `
    <div class="nav-brand">⚡ Buzaar Admin</div>
    <div class="nav-links">
      ${pages.map(p => `
        <a href="${p.href}" class="nav-link ${active === p.key ? 'active' : ''}">
          ${p.label}
          ${p.badge ? `<span style="background:var(--red);color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:800;line-height:1.4">${p.badge}</span>` : ''}
        </a>
      `).join('')}
    </div>
    <button class="btn btn-ghost btn-sm" id="logout-btn">Sign out</button>
  `;

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await getDb().auth.signOut();
    window.location.href = './index.html';
  });
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function showToast(msg, type = 'success') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3000);
}

function showLoading(el) {
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Loading…</div>';
}

function showEmpty(el, title, sub = '') {
  el.innerHTML = `<div class="empty-state"><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div>`;
}

function avatarInitial(name) {
  return (name || '?')[0].toUpperCase();
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function avatarBg(str) {
  const palette = ['#FF6B6B','#4ECDC4','#45B7D1','#96E6A1','#DDA0DD','#F7DC6F','#82E0AA','#FF9F43'];
  let h = 0;
  for (const c of (str || '')) h = (h * 31 + c.charCodeAt(0)) & 0xFFFFFFFF;
  return palette[Math.abs(h) % palette.length];
}

function drawBarChart(canvas, values, labels, hexColor) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const W  = rect.width;
  const H  = rect.height - 28;
  const n  = values.length;
  const mx = Math.max(...values, 1);
  const gap = 6;
  const bw  = (W - gap * (n + 1)) / n;

  ctx.clearRect(0, 0, W, rect.height);

  // Grid
  ctx.strokeStyle = '#3A3A3C';
  ctx.lineWidth = 0.5;
  ctx.setLineDash([3, 3]);
  [0.25, 0.5, 0.75].forEach(f => {
    const y = H * (1 - f);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  });
  ctx.setLineDash([]);

  // Baseline
  ctx.strokeStyle = '#3A3A3C'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, H); ctx.stroke();

  values.forEach((val, i) => {
    const x   = gap + i * (bw + gap);
    const bh  = val > 0 ? Math.max((val / mx) * H, 3) : 0;
    const y   = H - bh;
    const last = i === n - 1;

    // Bar
    ctx.fillStyle = hexColor + (last ? 'FF' : '99');
    ctx.beginPath();
    ctx.moveTo(x + 3, y);
    ctx.lineTo(x + bw - 3, y);
    ctx.quadraticCurveTo(x + bw, y, x + bw, y + 3);
    ctx.lineTo(x + bw, y + bh);
    ctx.lineTo(x, y + bh);
    ctx.lineTo(x, y + 3);
    ctx.quadraticCurveTo(x, y, x + 3, y);
    ctx.closePath();
    ctx.fill();

    // Value label
    if (val > 0) {
      ctx.fillStyle = hexColor;
      ctx.font = `bold ${Math.max(8, Math.min(10, bw * 0.4))}px -apple-system,sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(val, x + bw / 2, y - 4);
    }

    // X label
    ctx.fillStyle = '#8E8E93';
    ctx.font = `${Math.max(8, Math.min(10, bw * 0.4))}px -apple-system,sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x + bw / 2, H + 18);
  });
}

function bucketByDay(rows, n) {
  const now = Date.now();
  const buckets = Array(n).fill(0);
  rows.forEach(({ created_at }) => {
    const diff = Math.floor((now - new Date(created_at).getTime()) / 86_400_000);
    if (diff >= 0 && diff < n) buckets[n - 1 - diff]++;
  });
  return buckets;
}

function bucketByWeek(rows, n) {
  const now = Date.now();
  const buckets = Array(n).fill(0);
  rows.forEach(({ created_at }) => {
    const diff = Math.floor((now - new Date(created_at).getTime()) / (86_400_000 * 7));
    if (diff >= 0 && diff < n) buckets[n - 1 - diff]++;
  });
  return buckets;
}

function bucketByMonth(rows, n) {
  const now = new Date();
  const buckets = Array(n).fill(0);
  rows.forEach(({ created_at }) => {
    const d = new Date(created_at);
    const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (diff >= 0 && diff < n) buckets[n - 1 - diff]++;
  });
  return buckets;
}

function dayLabels(n) {
  const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return Array.from({ length: n }, (_, i) => {
    if (i === n - 1) return 'Today';
    const d = new Date(Date.now() - (n - 1 - i) * 86_400_000);
    return names[d.getDay()];
  });
}

function weekLabels(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.now() - (n - 1 - i) * 7 * 86_400_000);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
}

function monthLabels(n) {
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (n - 1 - i));
    return names[d.getMonth()];
  });
}
