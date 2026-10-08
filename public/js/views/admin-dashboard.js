import { api } from '../api.js';
import { getLang, t } from '../i18n.js';
import { icon } from '../icons.js';
import { mascot } from '../mascot.js';
import { avatar, cardTitle, esc, fmtDate, iconChip, skeleton, statusBadge } from '../util.js';
import { adminTabs } from './admin-common.js';

export default function dashboard(el) {
  async function load() {
    const d = await api.get('/admin/dashboard');
    const c = d.counts;
    const order = { late: 0, present: 1, leave: 2, pending: 3 };
    const rows = [...d.rows].sort((a, b) => order[a.status] - order[b.status] || a.full_name.localeCompare(b.full_name, getLang()));
    const inCount = c.present + c.late;
    const pct = c.total ? Math.round((inCount / c.total) * 100) : 0;
    el.innerHTML = `
      ${adminTabs('/admin')}
      <section class="card">
        ${cardTitle('layout-dashboard', 'sky', t('วันนี้ · {date}', { date: fmtDate(d.date) }), `<a class="btn small" href="#/qr">${icon('monitor', 15)}${t('เปิดหน้าจอ QR')}</a>`)}
        <div class="admin-hero">
          <div class="donut" style="--p:${pct}"><div><b>${inCount}/${c.total}</b><small>${t('เข้างานแล้ว')}</small></div></div>
          <div class="stats">
            <div class="stat">${iconChip('clock', 'lemon', 16)}<b>${c.late}</b><span>${t('มาสาย')}</span></div>
            <div class="stat">${iconChip('tree-palm', 'sky', 16)}<b>${c.leave}</b><span>${t('ลา')}</span></div>
            <div class="stat">${iconChip('hourglass', 'red', 16)}<b>${c.waiting}</b><span>${t('ยังไม่มา')}</span></div>
          </div>
        </div>
      </section>
      ${d.pending_leaves ? `<a class="banner warn" href="#/admin/leaves" style="text-decoration:none;color:inherit">${icon('hourglass', 22)}<span>${t('มีใบลารออนุมัติ {n} ใบ — กดเพื่อดู', { n: d.pending_leaves })}</span></a>` : ''}
      <section class="card">
        ${cardTitle('users', 'pink', t('สถานะรายคน'), `<span class="small muted">${t('อัปเดตทุก 30 วินาที')}</span>`)}
        <div class="list">
          ${rows.length ? rows.map((r) => `
            <div class="item">
              <div class="person grow">${avatar(r)}<div><b>${esc(r.full_name)}</b>${r.emp_code ? `<div class="small muted">${esc(r.emp_code)}</div>` : ''}</div></div>
              <div class="times-line small">${r.check_in ?? ''}${r.check_out ? ` – ${r.check_out}` : ''}</div>
              ${statusBadge(r)}
            </div>`).join('') : `<div class="empty">${mascot('sleepy', 96)}<p>${t('ยังไม่มีพนักงาน — ไปที่แท็บ “พนักงาน” เพื่อเพิ่มได้เลย')}</p></div>`}
        </div>
      </section>`;
  }
  el.innerHTML = adminTabs('/admin') + skeleton(2);
  load().catch((e) => { el.innerHTML = `${adminTabs('/admin')}<div class="card empty">${esc(e.message)}</div>`; });
  const timer = setInterval(() => load().catch(() => {}), 30000);
  return () => clearInterval(timer);
}
