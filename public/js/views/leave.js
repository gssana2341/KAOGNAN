import { api } from '../api.js';
import { getLang, t } from '../i18n.js';
import { icon } from '../icons.js';
import { mascot } from '../mascot.js';
import {
  LEAVE_STATUS, LEAVE_TYPES, PART_LABEL, addDays, badge, busy, cardTitle, confirmBox, esc, fmtDateShort, fmtDays, formData, iconChip, skeleton, toast, todayStr,
} from '../util.js';

const range = (l) => (l.start_date === l.end_date ? fmtDateShort(l.start_date) : `${fmtDateShort(l.start_date)} – ${fmtDateShort(l.end_date)}`);

export default function leave(el) {
  let workdays = [1, 2, 3, 4, 5];

  async function load() {
    const [d, today] = await Promise.all([api.get('/leaves'), api.get('/today')]);
    workdays = today.settings.workdays;
    draw(d);
  }

  function draw({ leaves, used, year }) {
    const today = todayStr();
    const oldForm = el.querySelector('form');
    const keep = oldForm ? formData(oldForm) : {};
    el.innerHTML = `
      <section class="card">
        ${cardTitle('send', 'mint', t('ขอลาออนไลน์'))}
        <form class="form" id="leave-form">
          <div class="type-grid">${Object.entries(LEAVE_TYPES).map(([k, v]) => `
            <input type="radio" name="type" id="t-${k}" value="${k}" ${(keep.type ?? 'sick') === k ? 'checked' : ''}>
            <label class="type-tile" for="t-${k}">${iconChip(v.icon, v.tone, 22)}${v.label}</label>`).join('')}
          </div>
          <div class="two keep">
            <label class="field">${t('ตั้งแต่วันที่')}<input type="date" name="start_date" value="${keep.start_date ?? today}" min="${addDays(today, -60)}" required></label>
            <label class="field">${t('ถึงวันที่')}<input type="date" name="end_date" value="${keep.end_date ?? today}" min="${addDays(today, -60)}" required></label>
          </div>
          <div class="seg" id="part-box" hidden>
            <input type="radio" name="part" id="p-full" value="full" checked><label for="p-full">${t('เต็มวัน')}</label>
            <input type="radio" name="part" id="p-am" value="am"><label for="p-am">${t('ครึ่งวันเช้า')}</label>
            <input type="radio" name="part" id="p-pm" value="pm"><label for="p-pm">${t('ครึ่งวันบ่าย')}</label>
          </div>
          <label class="field">${t('เหตุผล (ไม่บังคับ)')}<textarea name="reason" maxlength="500" placeholder="${t('เช่น ไปพบแพทย์ / ธุระครอบครัว')}">${esc(keep.reason ?? '')}</textarea></label>
          <div class="row between"><span class="days-pill" id="days-info"></span><button class="btn primary">${icon('send', 17)}${t('ส่งใบลา')}</button></div>
        </form>
      </section>

      <section class="card">
        ${cardTitle('list-checks', 'lav', t('สรุปการลาปี {y}', { y: getLang() === 'th' ? Number(year) + 543 : year }))}
        <div class="stats">${Object.entries(LEAVE_TYPES).map(([k, v]) => `<div class="stat">${iconChip(v.icon, v.tone, 17)}<b>${fmtDays(used[k] ?? 0)}</b><span>${t('{label} (วัน)', { label: v.label })}</span></div>`).join('')}</div>
      </section>

      <section class="list">
        <h3 style="margin:6px 4px 0">${t('ใบลาของฉัน')}</h3>
        ${leaves.length ? leaves.map((l) => `
          <div class="item s-${{ approved: 'ok', rejected: 'bad', pending: 'warn', cancelled: '' }[l.status]}" style="align-items:flex-start">
            ${iconChip(LEAVE_TYPES[l.type].icon, LEAVE_TYPES[l.type].tone, 20)}
            <div class="grow">
              <div><b>${LEAVE_TYPES[l.type].label}</b> · ${range(l)}${PART_LABEL[l.part]} · ${t('{n} วัน', { n: fmtDays(l.days) })}</div>
              ${l.reason ? `<div class="small muted">${esc(l.reason)}</div>` : ''}
              ${l.admin_note ? `<div class="small" style="margin-top:2px">${icon('message-circle', 13)} ${esc(l.admin_note)}</div>` : ''}
            </div>
            <div class="stack" style="align-items:flex-end">
              ${badge(LEAVE_STATUS[l.status].label, LEAVE_STATUS[l.status].cls, LEAVE_STATUS[l.status].icon)}
              ${l.status === 'pending' ? `<button class="btn small danger" data-cancel="${l.id}">${t('ยกเลิก')}</button>` : ''}
            </div>
          </div>`).join('') : `<div class="card empty">${mascot('happy', 96)}<p>${t('ยังไม่เคยขอลา')}</p></div>`}
      </section>`;
    wire();
  }

  function wire() {
    const form = el.querySelector('#leave-form');
    const start = form.elements.start_date;
    const end = form.elements.end_date;
    const partBox = el.querySelector('#part-box');
    const info = el.querySelector('#days-info');

    function refresh() {
      if (end.value < start.value) end.value = start.value;
      end.min = start.value;
      const single = start.value === end.value;
      partBox.hidden = !single;
      if (!single) form.elements.part.value = 'full';
      let n = 0;
      for (let d = start.value; d <= end.value && n < 400; d = addDays(d, 1)) if (workdays.includes(new Date(d + 'T00:00:00Z').getUTCDay())) n++;
      if (single && form.elements.part.value !== 'full') n *= 0.5;
      info.innerHTML = n ? `${icon('hourglass', 15)}${t('รวม {n} วัน', { n: fmtDays(n) })}` : `${icon('calendar-x', 15)}${t('ช่วงนี้ไม่มีวันทำงาน')}`;
    }
    form.addEventListener('input', refresh);
    refresh();

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      busy(form.querySelector('.btn.primary'), async () => {
        const d = formData(form);
        await api.post('/leaves', { type: d.type, start_date: d.start_date, end_date: d.end_date, part: d.part, reason: d.reason });
        toast(t('ส่งใบลาแล้ว รอผู้ดูแลอนุมัตินะ'));
        el.querySelector('form').reset();
        await load();
      });
    });
    el.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmBox(t('ยกเลิกใบลานี้ใช่ไหม?'), t('ยกเลิกใบลา')))) return;
      busy(b, async () => { await api.del(`/leaves/${b.dataset.cancel}`); toast(t('ยกเลิกใบลาแล้ว')); await load(); });
    }));
  }

  el.innerHTML = skeleton(2);
  load().catch((e) => { el.innerHTML = `<div class="card empty">${esc(e.message)}</div>`; });
}
