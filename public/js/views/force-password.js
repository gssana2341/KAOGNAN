import { api } from '../api.js';
import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { mascot } from '../mascot.js';
import { busy, formData, langButton, toast } from '../util.js';

// Shown right after login when the account still has a temporary/default password.
export default function forcePassword(el, { onDone }) {
  el.innerHTML = `
    <div class="login-wrap">
      ${langButton('login-lang')}
      <form class="card login-card">
        ${mascot('oops', 120)}
        <h2 style="margin-top:8px">${t('ตั้งรหัสผ่านใหม่ก่อนนะ')}</h2>
        <p class="muted" style="font-weight:600">${t('รหัสผ่านตอนนี้เป็นรหัสชั่วคราว เพื่อความปลอดภัยกรุณาตั้งรหัสผ่านของตัวเอง')}</p>
        <div class="form">
          <label class="field">${t('รหัสผ่านปัจจุบัน')}<span class="input-icon">${icon('lock', 18)}<input name="current" type="password" autocomplete="current-password" required></span></label>
          <label class="field">${t('รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)')}<span class="input-icon">${icon('key-round', 18)}<input name="next" type="password" autocomplete="new-password" minlength="6" required></span></label>
          <label class="field">${t('ยืนยันรหัสผ่านใหม่')}<span class="input-icon">${icon('shield-check', 18)}<input name="again" type="password" autocomplete="new-password" required></span></label>
          <div class="err" role="alert"></div>
          <button class="btn primary block">${icon('check', 18)}${t('บันทึกรหัสผ่าน')}</button>
        </div>
      </form>
    </div>`;
  const form = el.querySelector('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = formData(form);
    const err = form.querySelector('.err');
    if (d.next !== d.again) { err.textContent = t('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน'); return; }
    busy(form.querySelector('.btn'), async () => {
      try {
        await api.post('/me/password', { current: d.current, next: d.next });
        toast(t('เปลี่ยนรหัสผ่านแล้ว'));
        await onDone();
      } catch (ex) { err.textContent = ex.message; }
    });
  });
}
