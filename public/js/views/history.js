import { api } from '../api.js';
import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { mascot } from '../mascot.js';
import {
  STATUS, dowShort, addDays, addMonths, dayNum, dow, esc, fmtDay, fmtDays, fmtHours, fmtMonth, iconChip, isWeekend, skeleton, statusBadge, todayStr,
} from '../util.js';

const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

export default function history(el) {
  const thisMonth = todayStr().slice(0, 7);
  let month = thisMonth;

  function calendar(d) {
    const byDate = new Map(d.rows.map((r) => [r.date, r]));
    const lead = (dow(d.from) + 6) % 7; // empty cells before the 1st (Monday first)
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<span class="c e"></span>');
    for (let date = d.from; date <= d.to; date = addDays(date, 1)) {
      const r = byDate.get(date);
      const cls = r && r.status !== 'pending' ? STATUS[r.status].cls : '';
      cells.push(`<${r ? 'button' : 'span'} class="c ${cls} ${r ? 'tap' : ''} ${date === todayStr() ? 'today' : ''}" ${r ? `data-date="${date}"` : ''}>${dayNum(date)}</${r ? 'button' : 'span'}>`);
    }
    return `<div class="cal">${MON_FIRST.map((i) => `<span class="h">${dowShort(i)}</span>`).join('')}${cells.join('')}</div>
      <div class="legend"><span><i style="background:var(--mint-l)"></i>${t('มาทำงาน')}</span><span><i style="background:var(--lemon-l)"></i>${t('สาย')}</span><span><i style="background:var(--sky-l)"></i>${t('ลา')}</span><span><i style="background:var(--red-l)"></i>${t('ขาด')}</span></div>`;
  }

  async function load() {
    el.innerHTML = skeleton(3);
    const d = await api.get(`/attendance?month=${month}`);
    const s = d.summary;
    el.innerHTML = `
      <section class="card month-nav">
        <button class="btn round" data-m="-1" aria-label="${t('เดือนก่อน')}">${icon('chevron-left', 20)}</button>
        <h2>${fmtMonth(month)}</h2>
        <button class="btn round" data-m="1" aria-label="${t('เดือนถัดไป')}" ${month >= thisMonth ? 'disabled' : ''}>${icon('chevron-right', 20)}</button>
      </section>
      ${s ? `<section class="card"><div class="stats">
        <div class="stat">${iconChip('circle-check', 'mint', 17)}<b>${s.present}</b><span>${t('วันที่มาทำงาน')}</span></div>
        <div class="stat">${iconChip('clock', 'lemon', 17)}<b>${s.late_count}</b><span>${t('มาสาย (ครั้ง)')}</span></div>
        <div class="stat">${iconChip('tree-palm', 'sky', 17)}<b>${fmtDays(s.leave_days)}</b><span>${t('วันลา')}</span></div>
        <div class="stat">${iconChip('circle-x', 'red', 17)}<b>${s.absent}</b><span>${t('วันขาด')}</span></div>
        <div class="stat">${iconChip('timer', 'lav', 17)}<b>${fmtHours(s.hours)}</b><span>${t('ชม.ทำงานรวม')}</span></div>
        <div class="stat">${iconChip('moon', 'lemon', 17)}<b>${fmtHours(s.ot_minutes / 60)}</b><span>${t('ชม.โอทีรวม')}</span></div>
      </div></section>` : ''}
      <section class="card">${calendar(d)}</section>
      <section class="list">
        ${d.rows.length ? d.rows.map((r) => `
          <div class="item s-${STATUS[r.status].cls} ${isWeekend(r.date) ? 'weekend' : ''}" data-row="${r.date}">
            <div class="date"><b>${dayNum(r.date)}</b><small>${fmtDay(r.date)}</small></div>
            <div class="grow">
              <div class="times-line">${r.check_in ? `${r.check_in} – ${r.check_out ?? `<span class="muted">${t('ยังไม่ออก')}</span>`}` : `<span class="muted">${t('ไม่มีเวลาสแกน')}</span>`}</div>
              ${r.hours != null ? `<div class="small muted">${t('ทำงาน {h} ชม.', { h: fmtHours(r.hours) })}${r.ot_minutes > 0 ? ` · ${t('โอที {h} ชม.', { h: fmtHours(r.ot_minutes / 60) })}` : ''}</div>` : r.check_in && !r.check_out && r.date < todayStr() ? `<div class="small muted">${t('ลืมสแกนออกหรือเปล่านะ? แจ้งแอดมินได้เลย')}</div>` : ''}
              ${r.note ? `<div class="small muted">${icon('message-circle', 13)} ${esc(r.note)}</div>` : ''}
            </div>
            ${statusBadge(r)}
          </div>`).join('') : `<div class="card empty">${mascot('sleepy', 96)}<p>${t('ยังไม่มีข้อมูลในเดือนนี้')}</p></div>`}
      </section>`;
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]');
    if (b) { month = addMonths(month, Number(b.dataset.m)); load().catch(() => {}); return; }
    const c = e.target.closest('[data-date]');
    if (c) {
      const row = el.querySelector(`[data-row="${c.dataset.date}"]`);
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row?.classList.remove('flash');
      void row?.offsetWidth;
      row?.classList.add('flash');
    }
  });
  load().catch((e) => { el.innerHTML = `<div class="card empty">${esc(e.message)}</div>`; });
}
