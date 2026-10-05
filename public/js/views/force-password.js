import { api } from '../api.js';
import { mascot } from '../mascot.js';
import { busy, formData, toast } from '../util.js';

// Shown right after login when the account still has a temporary/default password.
export default function forcePassword(el, { onDone }) {
  el.innerHTML = `
    <div class="login-wrap">
      <form class="card login-card">
        ${mascot('oops', 100)}
        <h2>ตั้งรหัสผ่านใหม่ก่อนนะ</h2>
        <p class="muted">รหัสผ่านปัจจุบันเป็นรหัสชั่วคราว เพื่อความปลอดภัยกรุณาตั้งรหัสผ่านของตัวเอง</p>
        <div class="form">
          <label class="field">รหัสผ่านปัจจุบัน<input name="current" type="password" autocomplete="current-password" required></label>
          <label class="field">รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)<input name="next" type="password" autocomplete="new-password" minlength="6" required></label>
          <label class="field">ยืนยันรหัสผ่านใหม่<input name="again" type="password" autocomplete="new-password" required></label>
          <div class="err" role="alert"></div>
          <button class="btn primary block">บันทึกรหัสผ่าน</button>
        </div>
      </form>
    </div>`;
  const form = el.querySelector('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = formData(form);
    const err = form.querySelector('.err');
    if (d.next !== d.again) { err.textContent = 'รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน'; return; }
    busy(form.querySelector('.btn'), async () => {
      try {
        await api.post('/me/password', { current: d.current, next: d.next });
        toast('เปลี่ยนรหัสผ่านแล้ว 🎉');
        await onDone();
      } catch (ex) { err.textContent = ex.message; }
    });
  });
}
