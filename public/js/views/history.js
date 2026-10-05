import { api } from '../api.js';
import { mascot } from '../mascot.js';
import { addMonths, dayNum, esc, fmtDay, fmtDays, fmtHours, fmtMonth, isWeekend, statusBadge } from '../util.js';

export default function history(el) {
  const thisMonth = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
  let month = thisMonth;

  async function load() {
    el.innerHTML = `<div class="card empty">กำลังโหลด…</div>`;
    const d = await api.get(`/attendance?month=${month}`);
    const s = d.summary;
    el.innerHTML = `
      <section class="card month-nav">
        <button class="btn round" data-m="-1" aria-label="เดือนก่อน">‹</button>
        <h2>${fmtMonth(month)}</h2>
        <button class="btn round" data-m="1" aria-label="เดือนถัดไป" ${month >= thisMonth ? 'disabled' : ''}>›</button>
      </section>
      ${s ? `<section class="card"><div class="stats">
        <div class="stat ok"><b>${s.present}</b><span>วันที่มาทำงาน</span></div>
        <div class="stat warn"><b>${s.late_count}</b><span>มาสาย (ครั้ง)</span></div>
        <div class="stat info"><b>${fmtDays(s.leave_days)}</b><span>วันลา</span></div>
        <div class="stat bad"><b>${s.absent}</b><span>วันขาด</span></div>
        <div class="stat"><b>${fmtHours(s.hours)}</b><span>ชม.ทำงานรวม</span></div>
      </div></section>` : ''}
      <section class="list">
        ${d.rows.length ? d.rows.map((r) => `
          <div class="item ${isWeekend(r.date) ? 'weekend' : ''}">
            <div class="date"><b>${dayNum(r.date)}</b><small>${fmtDay(r.date)}</small></div>
            <div class="grow">
              <div class="times-line">${r.check_in ? `${r.check_in} – ${r.check_out ?? '<span class="muted">ยังไม่ออก</span>'}` : '<span class="muted">ไม่มีเวลาสแกน</span>'}</div>
              ${r.hours != null ? `<div class="small muted">ทำงาน ${fmtHours(r.hours)} ชม.</div>` : r.check_in && !r.check_out && r.date < thisDate() ? '<div class="small muted">ลืมสแกนออกหรือเปล่านะ? แจ้งแอดมินได้เลย</div>' : ''}
              ${r.note ? `<div class="small muted">📝 ${esc(r.note)}</div>` : ''}
            </div>
            ${statusBadge(r)}
          </div>`).join('') : `<div class="card empty">${mascot('sleepy', 90)}<p>ยังไม่มีข้อมูลในเดือนนี้</p></div>`}
      </section>`;
  }

  const thisDate = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]');
    if (b) { month = addMonths(month, Number(b.dataset.m)); load().catch(() => {}); }
  });
  load().catch((e) => { el.innerHTML = `<div class="card empty">${esc(e.message)}</div>`; });
}
