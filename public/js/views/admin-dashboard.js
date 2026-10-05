import { api } from '../api.js';
import { mascot } from '../mascot.js';
import { esc, fmtDate, statusBadge } from '../util.js';
import { adminTabs, initial } from './admin-common.js';

export default function dashboard(el) {
  async function load() {
    const d = await api.get('/admin/dashboard');
    const c = d.counts;
    const order = { late: 0, present: 1, leave: 2, pending: 3 };
    const rows = [...d.rows].sort((a, b) => order[a.status] - order[b.status] || a.full_name.localeCompare(b.full_name, 'th'));
    el.innerHTML = `
      ${adminTabs('/admin')}
      <section class="card">
        <div class="card-title"><h2>วันนี้ · ${fmtDate(d.date)}</h2><a class="btn small" href="#/qr">🖥️ เปิดหน้าจอ QR</a></div>
        <div class="stats">
          <div class="stat"><b>${c.total}</b><span>พนักงานทั้งหมด</span></div>
          <div class="stat ok"><b>${c.present + c.late}</b><span>เข้างานแล้ว</span></div>
          <div class="stat warn"><b>${c.late}</b><span>มาสาย</span></div>
          <div class="stat info"><b>${c.leave}</b><span>ลา</span></div>
          <div class="stat bad"><b>${c.waiting}</b><span>ยังไม่มา</span></div>
        </div>
      </section>
      ${d.pending_leaves ? `<a class="banner warn" href="#/admin/leaves" style="text-decoration:none;color:inherit">⏳ มีใบลารออนุมัติ ${d.pending_leaves} ใบ — กดเพื่อดู</a>` : ''}
      <section class="card">
        <div class="card-title"><h3>สถานะรายคน</h3><span class="small muted">อัปเดตอัตโนมัติทุก 30 วินาที</span></div>
        <div class="list">
          ${rows.length ? rows.map((r) => `
            <div class="item">
              <div class="person grow"><div class="avatar">${initial(r)}</div><div><b>${esc(r.full_name)}</b>${r.emp_code ? `<div class="small muted">${esc(r.emp_code)}</div>` : ''}</div></div>
              <div class="times-line small">${r.check_in ?? ''}${r.check_out ? ` – ${r.check_out}` : ''}</div>
              ${statusBadge(r)}
            </div>`).join('') : `<div class="empty">${mascot('sleepy', 90)}<p>ยังไม่มีพนักงาน — ไปที่แท็บ “พนักงาน” เพื่อเพิ่มได้เลย</p></div>`}
        </div>
      </section>`;
  }
  load().catch((e) => { el.innerHTML = `${adminTabs('/admin')}<div class="card empty">${esc(e.message)}</div>`; });
  const t = setInterval(() => load().catch(() => {}), 30000);
  return () => clearInterval(t);
}
