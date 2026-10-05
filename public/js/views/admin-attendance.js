import { api, download } from '../api.js';
import { icon } from '../icons.js';
import { mascot } from '../mascot.js';
import {
  addDays, addMonths, busy, cardTitle, confirmBox, esc, fmtDate, fmtDateShort, fmtDays, fmtHours, formData, monthRange, openModal, skeleton, statusBadge, toast, todayStr,
} from '../util.js';
import { adminTabs, loadUsers, userLabel } from './admin-common.js';

const MAX_ROWS = 500;

export default function attendance(el) {
  let f = { ...monthRange(todayStr().slice(0, 7)), user_id: '' };
  let users = [];
  let data = null;

  const qs = () => `from=${f.from}&to=${f.to}${f.user_id ? `&user_id=${f.user_id}` : ''}`;

  async function query() {
    el.querySelector('#result').innerHTML = skeleton(2);
    data = await api.get(`/admin/attendance?${qs()}`);
    drawResult();
  }

  function drawShell() {
    el.innerHTML = `
      ${adminTabs('/admin/attendance')}
      <section class="card">
        ${cardTitle('calendar-days', 'sky', 'เวลาเข้างาน', `<button class="btn good" id="export">${icon('download', 17)}ดาวน์โหลด Excel</button>`)}
        <form class="filters" id="filters">
          <label class="field">ตั้งแต่<input type="date" name="from" value="${f.from}" required></label>
          <label class="field">ถึง<input type="date" name="to" value="${f.to}" required></label>
          <label class="field">พนักงาน<select name="user_id"><option value="">ทุกคน</option>${users.map((u) => `<option value="${u.id}" ${String(u.id) === String(f.user_id) ? 'selected' : ''}>${esc(userLabel(u))}</option>`).join('')}</select></label>
        </form>
        <div class="chips" style="margin-top:12px">
          <button data-range="today">วันนี้</button><button data-range="week">7 วันล่าสุด</button>
          <button data-range="month">เดือนนี้</button><button data-range="prev">เดือนที่แล้ว</button>
        </div>
      </section>
      <div id="result" class="stack"></div>`;
  }

  function drawResult() {
    const { rows, summary } = data;
    const shown = rows.slice(0, MAX_ROWS);
    el.querySelector('#result').innerHTML = `
      <section class="card">
        ${cardTitle('users', 'lav', 'สรุปรายคน', `<span class="small muted">${fmtDateShort(f.from)} – ${fmtDateShort(f.to)}</span>`)}
        <div class="scroll-x"><table class="table">
          <thead><tr><th>พนักงาน</th><th class="num">วันทำงาน</th><th class="num">มา</th><th class="num">สาย (ครั้ง)</th><th class="num">ลา</th><th class="num">ขาด</th><th class="num">ชม.รวม</th></tr></thead>
          <tbody>${summary.length ? summary.map((s) => `
            <tr><td><b>${esc(s.full_name)}</b>${s.emp_code ? ` <span class="muted small">${esc(s.emp_code)}</span>` : ''}</td>
              <td class="num">${s.expected_days}</td><td class="num">${s.present}</td><td class="num">${s.late_count}</td>
              <td class="num">${fmtDays(s.leave_days)}</td><td class="num">${s.absent || '–'}</td><td class="num">${fmtHours(s.hours)}</td></tr>`).join('') : '<tr><td colspan="7" class="empty">ไม่มีข้อมูล</td></tr>'}</tbody>
        </table></div>
      </section>
      <section class="card">
        ${cardTitle('list-checks', 'mint', 'รายวัน', `<span class="small muted">${icon('pencil', 13)} กดที่แถวเพื่อแก้ไขเวลา (เช่น ลืมสแกน)</span>`)}
        ${rows.length ? `<div class="scroll-x" style="max-height:60vh"><table class="table">
          <thead><tr><th>วันที่</th><th>พนักงาน</th><th>เข้า</th><th>ออก</th><th class="num">ชม.</th><th>สถานะ</th><th>หมายเหตุ</th></tr></thead>
          <tbody>${shown.map((r, i) => `
            <tr class="clickable" data-i="${i}"><td>${fmtDate(r.date)}</td><td>${esc(r.full_name)}</td><td>${r.check_in ?? '–'}</td><td>${r.check_out ?? '–'}</td>
              <td class="num">${r.hours != null ? fmtHours(r.hours) : '–'}</td><td>${statusBadge(r)}</td><td class="small muted">${esc(r.note)}</td></tr>`).join('')}</tbody>
        </table></div>
        ${rows.length > MAX_ROWS ? `<p class="small muted">แสดง ${MAX_ROWS} แถวแรกจาก ${rows.length} — ดาวน์โหลด Excel เพื่อดูทั้งหมด</p>` : ''}`
    : `<div class="empty">${mascot('sleepy', 90)}<p>ไม่มีข้อมูลในช่วงนี้</p></div>`}
      </section>`;
  }

  function editRow(r) {
    const m = openModal(`
      <h2>แก้ไขเวลา</h2>
      <p><b>${esc(r.full_name)}</b><br><span class="muted">${fmtDate(r.date)}</span></p>
      <form class="form">
        <div class="two keep">
          <label class="field">เวลาเข้า<input type="time" name="check_in" value="${r.check_in ?? ''}"></label>
          <label class="field">เวลาออก<input type="time" name="check_out" value="${r.check_out ?? ''}"></label>
        </div>
        <label class="field">หมายเหตุ<input name="note" maxlength="200" value="${esc(r.note)}" placeholder="เช่น ลืมสแกนออก / ทำงานนอกสถานที่"></label>
        <p class="small muted">เว้นเวลาเข้าว่าง = ลบรายการของวันนี้ (สายคำนวณใหม่ตามเวลาเข้าที่ใส่)</p>
        <div class="err" role="alert"></div>
        <div class="row end"><button type="button" class="btn" data-close>ยกเลิก</button><button class="btn primary">${icon('check', 17)}บันทึก</button></div>
      </form>`);
    const form = m.el.querySelector('form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = formData(form);
      const err = form.querySelector('.err');
      busy(form.querySelector('.btn.primary'), async () => {
        try {
          if (!d.check_in && r.record_id && !(await confirmBox('ลบรายการเข้างานของวันนี้ใช่ไหม?', 'ลบ'))) return;
          await api.put('/admin/attendance', { user_id: r.user_id, work_date: r.date, ...d });
          m.close();
          toast('บันทึกแล้ว');
          await query();
        } catch (ex) { err.textContent = ex.message; }
      });
    });
  }

  const setRange = (kind) => {
    const t = todayStr();
    if (kind === 'today') f = { ...f, from: t, to: t };
    if (kind === 'week') f = { ...f, from: addDays(t, -6), to: t };
    if (kind === 'month') f = { ...f, ...monthRange(t.slice(0, 7)) };
    if (kind === 'prev') f = { ...f, ...monthRange(addMonths(t.slice(0, 7), -1)) };
    el.querySelector('[name=from]').value = f.from;
    el.querySelector('[name=to]').value = f.to;
    query().catch((e) => toast(e.message, 'bad'));
  };

  el.addEventListener('click', (e) => {
    const rg = e.target.closest('[data-range]');
    if (rg) return setRange(rg.dataset.range);
    const tr = e.target.closest('tr[data-i]');
    if (tr) return editRow(data.rows[Number(tr.dataset.i)]);
    const ex = e.target.closest('#export');
    if (ex) busy(ex, async () => { await download(`/admin/export.xlsx?${qs()}`, `attendance_${f.from}_${f.to}.xlsx`); toast('ดาวน์โหลดไฟล์ Excel แล้ว'); });
  });
  el.addEventListener('change', (e) => {
    const form = e.target.closest('#filters');
    if (!form) return;
    const d = formData(form);
    if (!d.from || !d.to) return;
    if (d.to < d.from) { toast('วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น', 'bad'); return; }
    f = { from: d.from, to: d.to, user_id: d.user_id };
    query().catch((err) => toast(err.message, 'bad'));
  });

  el.innerHTML = adminTabs('/admin/attendance') + skeleton(2);
  loadUsers().then((u) => { users = u.filter((x) => x.track); drawShell(); return query(); })
    .catch((e) => { el.innerHTML = `${adminTabs('/admin/attendance')}<div class="card empty">${esc(e.message)}</div>`; });
}
