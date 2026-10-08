import { api } from '../api.js';
import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { busy, cardTitle, confirmBox, dowShort, esc, fitQr, formData, skeleton, toast } from '../util.js';
import { adminTabs } from './admin-common.js';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first (0 = Sunday)

export default function settings(el) {
  let stopFit = () => {};
  async function load() {
    const [{ settings: s }, qr] = await Promise.all([api.get('/admin/settings'), api.get('/admin/qr')]);
    el.innerHTML = `
      ${adminTabs('/admin/settings')}
      <section class="card">
        ${cardTitle('building-2', 'lav', t('ตั้งค่าที่ทำงาน'))}
        <form class="form" id="settings-form">
          <label class="field">${t('ชื่อบริษัท / ร้าน')}<input name="company_name" value="${esc(s.company_name)}" maxlength="80" required></label>
          <div class="two keep">
            <label class="field">${t('เริ่มงาน')}<input type="time" name="work_start" value="${s.work_start}" required></label>
            <label class="field">${t('เลิกงาน')}<input type="time" name="work_end" value="${s.work_end}" required></label>
          </div>
          <label class="field">${t('ผ่อนผันมาสายได้ (นาที)')}<input type="number" name="late_grace_min" min="0" max="180" value="${s.late_grace_min}" required></label>
          <div><b style="font-size:.9rem">${t('วันทำงาน')}</b>
            <div class="seg" style="margin-top:7px">${WEEK_ORDER.map((n) => `<input type="checkbox" name="wd" id="wd${n}" value="${n}" ${s.workdays.includes(n) ? 'checked' : ''}><label for="wd${n}">${dowShort(n)}</label>`).join('')}</div>
          </div>
          <div><b style="font-size:.9rem">${t('รูปแบบ QR ที่ทำงาน')}</b>
            <div class="seg" style="margin-top:7px">
              <input type="radio" name="qr_mode" id="m-static" value="static" ${s.qr_mode === 'static' ? 'checked' : ''}><label for="m-static">${icon('printer', 16)}${t('QR ติดผนัง (พิมพ์)')}</label>
              <input type="radio" name="qr_mode" id="m-rot" value="rotating" ${s.qr_mode === 'rotating' ? 'checked' : ''}><label for="m-rot">${icon('refresh-cw', 16)}${t('QR เปลี่ยนทุกครั้ง (แสดงบนจอ)')}</label>
            </div>
            <p class="small muted" style="margin-top:7px">${t('แบบเปลี่ยนทุกครั้งกันการถ่ายรูป QR ส่งให้เพื่อนสแกนจากที่บ้านได้ดีกว่า ต้องตั้งแท็บเล็ต/จอไว้ที่ทำงาน')}</p>
          </div>
          <label class="field" id="rot-box" ${s.qr_mode === 'rotating' ? '' : 'hidden'}>${t('เปลี่ยน QR ทุก (วินาที)')}<input type="number" name="qr_rotate_sec" min="15" max="600" value="${s.qr_rotate_sec}"></label>
          <div class="err" role="alert"></div>
          <button class="btn primary">${icon('check', 17)}${t('บันทึกการตั้งค่า')}</button>
        </form>
      </section>

      <section class="card center">
        ${cardTitle('qr-code', 'pink', t('QR ของที่ทำงาน'))}
        <div class="qr-box"><div class="qr-slot">${qr.svg}</div></div>
        <p class="muted small" style="margin-top:10px">${qr.mode === 'rotating' ? t('โหมดเปลี่ยนทุกครั้ง — ให้เปิดหน้าจอ QR ค้างไว้ที่ทำงาน') : t('พิมพ์ไปติดที่ทำงานได้เลย พนักงานสแกนเข้า/ออกด้วย QR เดียวกัน')}</p>
        <div class="row" style="justify-content:center">
          <a class="btn primary" href="#/qr">${icon('monitor', 17)}${t('เปิดหน้าจอ QR / พิมพ์')}</a>
          <button class="btn danger" id="regen">${icon('refresh-cw', 16)}${t('สร้าง QR ใหม่')}</button>
        </div>
        <p class="small muted" style="margin-top:10px">${t('“สร้าง QR ใหม่” จะทำให้ QR ที่พิมพ์ไว้เดิมใช้ไม่ได้ทันที (ใช้เมื่อ QR รั่วไหล)')}</p>
      </section>`;
    stopFit();
    stopFit = fitQr(el.querySelector('.qr-slot'));
    wire();
  }

  function wire() {
    const form = el.querySelector('#settings-form');
    form.addEventListener('change', () => { el.querySelector('#rot-box').hidden = form.elements.qr_mode.value !== 'rotating'; });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = formData(form);
      const err = form.querySelector('.err');
      err.textContent = '';
      const workdays = [...form.querySelectorAll('[name=wd]:checked')].map((c) => Number(c.value));
      const body = {
        company_name: d.company_name, work_start: d.work_start, work_end: d.work_end, late_grace_min: Number(d.late_grace_min), workdays, qr_mode: d.qr_mode,
        ...(d.qr_mode === 'rotating' ? { qr_rotate_sec: Number(d.qr_rotate_sec) } : {}),
      };
      busy(form.querySelector('.btn.primary'), async () => {
        try { await api.put('/admin/settings', body); toast(t('บันทึกการตั้งค่าแล้ว')); await load(); } catch (ex) { err.textContent = ex.message; }
      });
    });
    el.querySelector('#regen').addEventListener('click', async (e) => {
      if (!(await confirmBox(t('QR เดิมที่พิมพ์/ติดไว้จะใช้ไม่ได้ทันที ต้องพิมพ์ใหม่ ยืนยันสร้าง QR ใหม่?'), t('สร้างใหม่')))) return;
      busy(e.currentTarget, async () => { await api.post('/admin/qr/regenerate'); toast(t('สร้าง QR ใหม่แล้ว')); await load(); });
    });
  }

  el.innerHTML = adminTabs('/admin/settings') + skeleton(2);
  load().catch((e) => { el.innerHTML = `${adminTabs('/admin/settings')}<div class="card empty">${esc(e.message)}</div>`; });
  return () => stopFit();
}
