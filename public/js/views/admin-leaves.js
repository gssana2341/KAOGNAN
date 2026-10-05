import { api } from '../api.js';
import { icon } from '../icons.js';
import { setPendingBadge } from '../main.js';
import { mascot } from '../mascot.js';
import {
  LEAVE_STATUS, LEAVE_TYPES, PART_LABEL, avatar, badge, busy, cardTitle, esc, fmtDateShort, fmtDays, formData, openModal, skeleton, toast,
} from '../util.js';
import { adminTabs } from './admin-common.js';

const FILTERS = [['pending', 'รออนุมัติ'], ['approved', 'อนุมัติแล้ว'], ['rejected', 'ไม่อนุมัติ'], ['', 'ทั้งหมด']];
const range = (l) => (l.start_date === l.end_date ? fmtDateShort(l.start_date) : `${fmtDateShort(l.start_date)} – ${fmtDateShort(l.end_date)}`);

export default function leaves(el) {
  let status = 'pending';
  let rows = [];

  async function load() {
    rows = (await api.get(`/admin/leaves${status ? `?status=${status}` : ''}`)).leaves;
    if (status === 'pending') setPendingBadge(rows.length);
    draw();
  }

  function draw() {
    el.innerHTML = `
      ${adminTabs('/admin/leaves')}
      <section class="card">
        ${cardTitle('calendar-check', 'mint', 'ใบลา')}
        <div class="chips">${FILTERS.map(([k, label]) => `<button data-f="${k}" class="${k === status ? 'active' : ''}">${label}</button>`).join('')}</div>
      </section>
      <section class="list">
        ${rows.length ? rows.map((l) => `
          <div class="item" style="align-items:flex-start">
            ${avatar(l)}
            <div class="grow">
              <div><b>${esc(l.full_name)}</b> ${l.emp_code ? `<span class="small muted">${esc(l.emp_code)}</span>` : ''}</div>
              <div>${icon(LEAVE_TYPES[l.type].icon, 15)} ${LEAVE_TYPES[l.type].label} · ${range(l)}${PART_LABEL[l.part]} · <b>${fmtDays(l.days)} วัน</b></div>
              ${l.reason ? `<div class="small muted">“${esc(l.reason)}”</div>` : ''}
              ${l.admin_note ? `<div class="small">${icon('message-circle', 13)} ${esc(l.admin_note)}</div>` : ''}
              <div class="row" style="margin-top:8px">
                ${l.status !== 'approved' && l.status !== 'cancelled' ? `<button class="btn small good" data-decide="${l.id}" data-to="approved">${icon('check', 15)}อนุมัติ</button>` : ''}
                ${l.status !== 'rejected' && l.status !== 'cancelled' ? `<button class="btn small danger" data-decide="${l.id}" data-to="rejected">${icon('x', 15)}ไม่อนุมัติ</button>` : ''}
              </div>
            </div>
            ${badge(LEAVE_STATUS[l.status].label, LEAVE_STATUS[l.status].cls, LEAVE_STATUS[l.status].icon)}
          </div>`).join('') : `<div class="card empty">${mascot('happy', 96)}<p>${status === 'pending' ? 'ไม่มีใบลารออนุมัติ เคลียร์หมดแล้ว' : 'ไม่มีรายการ'}</p></div>`}
      </section>`;
  }

  function decide(l, to) {
    const m = openModal(`
      <h2>${to === 'approved' ? 'อนุมัติใบลา' : 'ไม่อนุมัติใบลา'}</h2>
      <p><b>${esc(l.full_name)}</b> · ${LEAVE_TYPES[l.type].label} ${range(l)}${PART_LABEL[l.part]}</p>
      <form class="form">
        <label class="field">ข้อความถึงพนักงาน (ไม่บังคับ)<input name="note" maxlength="300" value="${esc(l.admin_note)}" placeholder="${to === 'approved' ? 'เช่น ขอให้พักผ่อนเยอะ ๆ นะ' : 'เช่น ช่วงนั้นงานเยอะ ขอเลื่อนได้ไหม'}"></label>
        <div class="row end"><button type="button" class="btn" data-close>ยกเลิก</button><button class="btn ${to === 'approved' ? 'good' : 'danger'}">${to === 'approved' ? 'อนุมัติ' : 'ไม่อนุมัติ'}</button></div>
      </form>`);
    const form = m.el.querySelector('form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      busy(form.querySelector('.btn:not([data-close])'), async () => {
        await api.put(`/admin/leaves/${l.id}`, { status: to, note: formData(form).note });
        m.close();
        toast(to === 'approved' ? 'อนุมัติแล้ว' : 'บันทึกว่าไม่อนุมัติแล้ว');
        await load();
      });
    });
  }

  el.addEventListener('click', (e) => {
    const fb = e.target.closest('[data-f]');
    if (fb) { status = fb.dataset.f; load().catch((er) => toast(er.message, 'bad')); return; }
    const d = e.target.closest('[data-decide]');
    if (d) decide(rows.find((r) => r.id === Number(d.dataset.decide)), d.dataset.to);
  });

  el.innerHTML = adminTabs('/admin/leaves') + skeleton(2);
  load().catch((e) => { el.innerHTML = `${adminTabs('/admin/leaves')}<div class="card empty">${esc(e.message)}</div>`; });
}
